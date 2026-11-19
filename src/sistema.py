"""MEI sem Medo - assistente textual (Citizen Assist AI / FIAP Global Solution).

Responde apenas com base em data/base.json, cita a fonte e admite quando nao sabe.
Uso: python src/sistema.py [--modelo A|B]
"""
import json
import re
import sys
import time
import unicodedata
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent / "data" / "base.json"
STOPWORDS = {"a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas",
             "um", "uma", "que", "para", "por", "com", "se", "eu", "meu", "minha", "ao", "pra", "qual",
             "quais", "como", "quando", "posso", "preciso", "tenho", "ser", "sao", "vai", "mais"}
LIMIAR = 3.0        # pontuacao minima para responder
MARGEM = 0.9        # 2o colocado >= 90% do 1o em outro tema => pergunta ambigua

# Dois modelos de prompt/resposta (documentados em docs/uso_ia.md)
MODELOS = {
    "A": "{resposta}\n\nFonte: {fonte} ({url})\nVerificado em {verificado}.{aviso}{veja}",
    "B": "Resumo: {titulo}\nExplicacao: {resposta}\nFonte oficial/consultada: {fonte} - {url}\n"
         "Confiabilidade: {confianca} (verificado em {verificado}).{aviso}{veja}",
}


def norm(txt):
    txt = unicodedata.normalize("NFKD", txt.lower())
    txt = "".join(c for c in txt if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9 ]", " ", txt)


def tokens(txt):
    return [t for t in norm(txt).split() if t not in STOPWORDS and len(t) > 1]


CAMPOS = ("id", "tema", "titulo", "palavras_chave", "resposta", "fonte", "url", "verificado", "confianca", "relacionados")
TEMAS = {"reforma": "Reforma tributária", "mei": "Obrigações do MEI", "consumidor": "Direitos do consumidor (CDC/Procon)",
         "split": "Split payment", "simples": "Simples Nacional: anexos e alíquotas", "creditos": "Recuperação de créditos",
         "abrir": "Abrir e formalizar o MEI", "diaadia": "Dia a dia do negócio", "preco": "Preço e lucro"}


class BaseInvalida(Exception):
    """Base ausente, vazia ou inconsistente."""


def carregar(caminho=BASE):
    """Le e valida a base. Levanta BaseInvalida com mensagem clara em qualquer problema."""
    try:
        with open(caminho, encoding="utf-8") as f:
            dados = json.load(f)
    except FileNotFoundError:
        raise BaseInvalida(f"Arquivo da base nao encontrado: {caminho}")
    except json.JSONDecodeError as e:
        raise BaseInvalida(f"Base com JSON invalido (linha {e.lineno}): {e.msg}")
    if not isinstance(dados, list) or not dados:
        raise BaseInvalida("Base vazia: precisa ser uma lista com ao menos 1 registro.")
    base = {}
    for n, r in enumerate(dados, 1):
        if not isinstance(r, dict):
            raise BaseInvalida(f"Registro #{n} nao e um objeto.")
        faltam = [c for c in CAMPOS if c not in r or r[c] in ("", None, [])]
        if faltam and faltam != ["relacionados"]:
            raise BaseInvalida(f"Registro #{n} ({r.get('id', '?')}) sem campo(s): {', '.join(faltam)}")
        if r["id"] in base:
            raise BaseInvalida(f"Identificador duplicado: {r['id']}")
        base[r["id"]] = r
    for r in base.values():
        r.setdefault("relacionados", [])
        r.setdefault("base_legal", [])
        for i in r["relacionados"]:
            if i not in base:
                raise BaseInvalida(f"Registro {r['id']} aponta para id inexistente: {i}")
    return base


def por_tema(base, tema):
    """Indice simples tema -> registros (lista dentro de dicionario)."""
    return [r for r in base.values() if r["tema"] == tema]


def pontuar(registro, toks, frase):
    chaves = {t for k in registro["palavras_chave"] for t in tokens(k)}
    titulo = set(tokens(registro["titulo"]))
    corpo = set(tokens(registro["resposta"]))
    s = sum(3 for t in toks if t in chaves) + sum(2 for t in toks if t in titulo) + sum(1 for t in toks if t in corpo)
    s += sum(4 for k in registro["palavras_chave"] if " " in k and norm(k) in frase)  # expressoes
    return s


def busca(base, pergunta):
    toks = list(dict.fromkeys(tokens(pergunta)))
    frase = norm(pergunta)
    ranking = sorted(((pontuar(r, toks, frase), r) for r in base.values()), key=lambda x: -x[0])
    return [(s, r) for s, r in ranking if s > 0]


def grafo(base, rid):
    """Topicos relacionados (vizinhos no grafo) de um registro: no maximo 3."""
    return [base[i] for i in base[rid]["relacionados"] if i in base][:3]


def formatar(base, r, modelo="A"):
    aviso = "\n[!] Esta informacao pode mudar ou as fontes divergem: confirme em canal oficial." if r["confianca"] == "confirmar" else ""
    rel = grafo(base, r["id"])
    veja = "\nVeja tambem: " + "; ".join(f"{x['titulo']} [{x['id']}]" for x in rel) if rel else ""
    return MODELOS[modelo].format(**r, aviso=aviso, veja=veja)


def perguntar(base, pergunta, modelo="A"):
    """Retorna dict: status (ok|vazia|invalida|ambigua|desconhecida), id, texto (e opcoes, se ambigua)."""
    if pergunta is None or not str(pergunta).strip():
        return {"status": "vazia", "id": None, "texto": "Você não digitou nada. Pergunte, por exemplo: “qual o limite do MEI?”"}
    pergunta = str(pergunta).strip()
    if len(pergunta) < 3 or not re.search(r"[A-Za-zÀ-ÿ]{2,}", pergunta):
        return {"status": "invalida", "id": None, "texto": "Não entendi. Escreva uma pergunta com palavras, por exemplo: “MEI precisa emitir nota fiscal?”"}
    if len(pergunta) > 300:
        return {"status": "invalida", "id": None, "texto": "Pergunta muito longa. Tente resumir em uma frase."}
    rank = busca(base, pergunta)
    if not rank or rank[0][0] < LIMIAR:
        return {"status": "desconhecida", "id": None,
                "texto": "Não encontrei isso na minha base verificada, então não vou chutar. "
                         "Confirme no Portal do Empreendedor (gov.br/empresas-e-negocios), na Receita Federal ou com um contador. "
                         "Temas que eu cubro: " + ", ".join(TEMAS.values()) + "."}
    topo = rank[0]
    if len(rank) > 1 and rank[1][0] >= MARGEM * topo[0] and rank[1][1]["tema"] != topo[1]["tema"]:
        a, b = topo[1], rank[1][1]
        return {"status": "ambigua", "id": None, "opcoes": [a["id"], b["id"]],
                "texto": f"Sua pergunta pode ser sobre dois assuntos. Qual você quer?\n  1) {a['titulo']} [{a['id']}]\n  2) {b['titulo']} [{b['id']}]"}
    return {"status": "ok", "id": topo[1]["id"], "texto": formatar(base, topo[1], modelo)}


def menu(base, modelo):
    """Menu: escolhe tema -> escolhe assunto -> mostra resposta com fonte."""
    temas = sorted({r["tema"] for r in base.values()})
    print("\nEscolha um tema:")
    for n, t in enumerate(temas, 1):
        print(f"  {n}) {TEMAS.get(t, t)}")
    esc = input("Numero do tema (Enter volta): ").strip()
    if not esc:
        return
    if not esc.isdigit() or not 1 <= int(esc) <= len(temas):
        print("Opcao inexistente. Digite um dos numeros listados.")
        return
    regs = por_tema(base, temas[int(esc) - 1])
    for n, r in enumerate(regs, 1):
        print(f"  {n}) {r['titulo']}")
    esc = input("Numero do assunto (Enter volta): ").strip()
    if not esc:
        return
    if not esc.isdigit() or not 1 <= int(esc) <= len(regs):
        print("Opcao inexistente. Digite um dos numeros listados.")
        return
    print("\nAssistente: " + formatar(base, regs[int(esc) - 1], modelo))


def main():
    modelo = "B" if "--modelo" in sys.argv and sys.argv[sys.argv.index("--modelo") + 1].upper() == "B" else "A"
    try:
        base = carregar()
    except BaseInvalida as e:
        print(f"Erro na base de conhecimento: {e}")
        sys.exit(1)
    print(f"MEI sem Medo (modelo {modelo}) - assistente informativo, NAO e canal oficial. Nao digite dados pessoais.")
    print("Comandos: 'menu' (escolher tema), 'topicos' (listar tudo), '2027' (estou pronto para 2027?), 'sair'.")
    print("Ou escreva sua pergunta.")
    while True:
        try:
            p = input("\nVoce: ")
        except (EOFError, KeyboardInterrupt):
            break
        cmd = p.strip().lower()
        if cmd == "sair":
            break
        if cmd == "menu":
            menu(base, modelo)
            continue
        if cmd == "2027":
            import checklist
            checklist.main(base)
            continue
        if cmd == "topicos":
            for r in base.values():
                print(f"  [{r['id']}] ({r['tema']}) {r['titulo']}")
            continue
        t0 = time.perf_counter()
        res = perguntar(base, p, modelo)
        print(f"\nAssistente: {res['texto']}\n(tempo: {(time.perf_counter() - t0) * 1000:.1f} ms)")


if __name__ == "__main__":
    main()
