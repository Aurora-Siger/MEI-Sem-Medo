"""Estou pronto para 2027? - checklist do MEI para a reforma tributaria.

As perguntas ficam em data/checklist2027.json e formam uma arvore de decisao simples:
perguntas de "perfil" (vende para empresa? presta servico?) liberam perguntas filhas
pelo campo "depende". Cada "tarefa" aponta para registros da base verificada.
Uso: python src/checklist.py
"""
import json
from pathlib import Path

from sistema import BaseInvalida, carregar

ARQUIVO = Path(__file__).resolve().parent.parent / "data" / "checklist2027.json"
RESPOSTAS = ("sim", "nao", "nao_sei")
NIVEIS = [(0.8, "pronto", "Você está bem encaminhado para 2027."),
          (0.5, "quase", "Quase lá: resolva os itens abaixo, começando pelos primeiros."),
          (0.0, "atencao", "Atenção: há pontos importantes para resolver antes de 2027.")]


def carregar_checklist(base, caminho=ARQUIVO):
    """Le e valida o checklist. Toda tarefa precisa citar registros que existem na base."""
    try:
        with open(caminho, encoding="utf-8") as f:
            itens = json.load(f)
    except FileNotFoundError:
        raise BaseInvalida(f"Checklist nao encontrado: {caminho}")
    except json.JSONDecodeError as e:
        raise BaseInvalida(f"Checklist com JSON invalido (linha {e.lineno}): {e.msg}")
    if not isinstance(itens, list) or not itens:
        raise BaseInvalida("Checklist vazio.")
    vistos = {}
    for q in itens:
        if not q.get("id") or not q.get("pergunta") or q.get("tipo") not in ("perfil", "tarefa"):
            raise BaseInvalida(f"Item do checklist incompleto: {q.get('id', '?')}")
        if q["id"] in vistos:
            raise BaseInvalida(f"Item duplicado no checklist: {q['id']}")
        for pai in q.get("depende", {}):
            if vistos.get(pai, {}).get("tipo") != "perfil":
                raise BaseInvalida(f"{q['id']} depende de {pai}, que precisa ser uma pergunta de perfil anterior")
        if q["tipo"] == "tarefa":
            if not q.get("dica") or not q.get("registros") or q.get("peso") not in (1, 2, 3):
                raise BaseInvalida(f"Tarefa {q['id']} precisa de dica, registros e peso de 1 a 3")
            for rid in q["registros"]:
                if rid not in base:
                    raise BaseInvalida(f"Tarefa {q['id']} cita registro inexistente: {rid}")
        vistos[q["id"]] = q
    return itens


def aplicavel(item, respostas):
    """Uma pergunta vale se todas as condicoes de 'depende' batem com as respostas dadas."""
    return all(respostas.get(pai) == valor for pai, valor in item.get("depende", {}).items())


def proxima(itens, respostas):
    """Proxima pergunta ainda nao respondida que se aplica a esta pessoa (ou None)."""
    for q in itens:
        if q["id"] not in respostas and aplicavel(q, respostas):
            return q
    return None


def avaliar(itens, respostas):
    """Pontua as tarefas aplicaveis: 'sim' soma o peso; 'nao' e 'nao_sei' viram pendencia.
    Pendencias saem ordenadas por peso (mais importante primeiro)."""
    tarefas = [q for q in itens if q["tipo"] == "tarefa" and aplicavel(q, respostas)]
    total = sum(q["peso"] for q in tarefas)
    pontos = sum(q["peso"] for q in tarefas if respostas.get(q["id"]) == "sim")
    pendencias = [dict(q, resposta=respostas.get(q["id"], "nao_sei")) for q in tarefas if respostas.get(q["id"]) != "sim"]
    pendencias.sort(key=lambda q: -q["peso"])  # sort estavel: empate mantem a ordem do arquivo
    pct = pontos / total if total else 0.0
    nivel, frase = next((n, f) for lim, n, f in NIVEIS if pct >= lim)
    return {"pontos": pontos, "total": total, "pct": round(pct, 4), "nivel": nivel, "frase": frase, "pendencias": pendencias}


def estado(itens, respostas):
    """Situacao do checklist para o site: limpa respostas que deixaram de valer (ex.: a pessoa voltou e
    mudou uma pergunta de perfil), diz a proxima pergunta e, quando acabou, o resultado."""
    validas = {}
    for q in itens:  
        if respostas.get(q["id"]) in RESPOSTAS and aplicavel(q, validas):
            validas[q["id"]] = respostas[q["id"]]
    prox = proxima(itens, validas)
    total = len(validas) + sum(1 for q in itens if q["id"] not in validas and aplicavel(q, validas))
    return {"respostas": validas, "proxima": prox, "feitas": len(validas), "total": total,
            "resultado": None if prox else avaliar(itens, validas)}


def ler_resposta(texto):
    """Converte o que a pessoa digitou em sim/nao/nao_sei (ou None se nao entendeu)."""
    t = texto.strip().lower()
    if t in ("s", "sim", "1"):
        return "sim"
    if t in ("n", "nao", "não", "2"):
        return "nao"
    if t in ("?", "nao sei", "não sei", "ns", "3"):
        return "nao_sei"
    return None


def main(base=None):
    try:
        base = base or carregar()
        itens = carregar_checklist(base)
    except BaseInvalida as e:
        print(f"Erro: {e}")
        return
    print("\nEstou pronto para 2027? Responda s (sim), n (nao) ou ? (nao sei). Enter vazio sai.")
    respostas = {}
    while (q := proxima(itens, respostas)) is not None:
        try:
            txt = input(f"\n{q['pergunta']} ")
        except (EOFError, KeyboardInterrupt):
            return
        if not txt.strip():
            return
        r = ler_resposta(txt)
        if r is None:
            print("Nao entendi. Responda s, n ou ?.")
            continue
        respostas[q["id"]] = r
    res = avaliar(itens, respostas)
    print(f"\nResultado: {res['pct'] * 100:.0f}% pronto ({res['pontos']} de {res['total']} pontos). {res['frase']}")
    for n, p in enumerate(res["pendencias"], 1):
        print(f"  {n}. {p['pergunta']}\n     -> {p['dica']} (veja: {', '.join(p['registros'])})")
    print("Isto e uma orientacao informativa, nao um servico oficial. Confirme com um contador.")


if __name__ == "__main__":
    main()
