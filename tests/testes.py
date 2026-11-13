"""Testes: 12+ perguntas, acuracia e tempo. Execute: python tests/testes.py"""
import statistics
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
import sistema  # noqa: E402

# (pergunta, status esperado, id esperado)
CASOS = [
    ("Qual o limite de faturamento do MEI?", "ok", "M1"),
    ("quanto custa o DAS em 2026?", "ok", "M2"),
    ("Ate quando entrego a declaracao anual DASN?", "ok", "M3"),
    ("MEI precisa emitir nota fiscal para pessoa fisica?", "ok", "M4"),
    ("O que acontece se eu ultrapassar o limite do MEI?", "ok", "M6"),
    ("Como abrir MEI de graca?", "ok", "M7"),
    ("O que sao CBS e IBS?", "ok", "R1"),
    ("O Pix vai ser taxado pela reforma?", "ok", "R6"),
    ("Posso optar pelo Simples Hibrido?", "ok", "R5"),
    ("Qual o prazo para o cliente reclamar de produto com defeito?", "ok", "C2"),
    ("O cliente tem direito de arrependimento em compra online?", "ok", "C3"),
    ("Sou obrigado a trocar roupa que nao serviu?", "ok", "C4"),
    ("Qual a diferenca entre garantia contratual e legal?", "ok", "C5"),
    ("", "vazia", None),
    ("   ", "vazia", None),
    ("?!?! 123", "invalida", None),
    ("receita de bolo de cenoura", "desconhecida", None),
    ("nota fiscal", "ambigua", None),
    # reformulacoes (mesma duvida, outras palavras)
    ("quanto o MEI pode faturar por ano?", "ok", "M1"),
    ("preciso dar nota quando vendo para um cliente comum?", "ok", "M4"),
    ("o cliente comprou na internet e quer devolver, pode?", "ok", "C3"),
    # fora dos temas / sem resposta confiavel
    ("como tirar passaporte?", "desconhecida", None),
    ("qual a previsao do tempo amanha", "desconhecida", None),
    ("a", "invalida", None),
    # novos temas: split payment, Simples, creditos
    ("o que e split payment?", "ok", "S1"),
    ("o split vai diminuir meu fluxo de caixa?", "ok", "S2"),
    ("quais as modalidades do split payment", "ok", "S3"),
    ("qual anexo do Simples eu me encaixo?", "ok", "A2"),
    ("como calcular a aliquota efetiva do Simples", "ok", "A4"),
    ("o que e o fator r?", "ok", "A5"),
    ("qual a diferenca entre MEI e microempresa?", "ok", "A7"),
    ("como recuperar creditos de imposto?", "ok", "K1"),
    ("empresa que compra de mim no Simples tem credito?", "ok", "K2"),
    ("vale a pena optar pelo regime regular de IBS e CBS?", "ok", "K3"),
]


def testar_validacao(tmp):
    """Base ausente, vazia e inconsistente devem gerar BaseInvalida (nunca travar)."""
    import json
    casos = {"ausente": tmp / "nao_existe.json", "vazia": tmp / "vazia.json",
             "sem_campo": tmp / "sem_campo.json", "aresta_invalida": tmp / "aresta.json"}
    casos["vazia"].write_text("[]", encoding="utf-8")
    reg = {c: "x" for c in sistema.CAMPOS}
    reg.update(palavras_chave=["x"], relacionados=[])
    casos["sem_campo"].write_text(json.dumps([{k: v for k, v in reg.items() if k != "fonte"}]), encoding="utf-8")
    casos["aresta_invalida"].write_text(json.dumps([dict(reg, relacionados=["ZZ"])]), encoding="utf-8")
    ok = 0
    for nome, caminho in casos.items():
        try:
            sistema.carregar(caminho)
            print(f"[FALHA] base {nome} foi aceita")
        except sistema.BaseInvalida as e:
            ok += 1
            print(f"[OK] base {nome}: {e}")
    return ok, len(casos)


def comparar_modelos(base):
    """Compara A e B nas perguntas respondidas: tamanho e presenca de fonte, data e aviso."""
    res = {}
    for m in ("A", "B"):
        tam, completos, n = [], 0, 0
        for perg, st, rid in CASOS:
            if st != "ok":
                continue
            r = sistema.perguntar(base, perg, m)
            if r["id"] is None:
                continue
            reg = base[r["id"]]
            t = r["texto"]
            n += 1
            tam.append(len(t))
            tem = reg["fonte"] in t and reg["verificado"] in t and (reg["confianca"] != "confirmar" or "confirme" in t)
            completos += tem
        res[m] = (statistics.mean(tam), completos, n)
    return res


def main():
    base = sistema.carregar()
    certos, tempos = 0, []
    for perg, st, rid in CASOS:
        t0 = time.perf_counter()
        r = sistema.perguntar(base, perg)
        tempos.append((time.perf_counter() - t0) * 1000)
        ok = r["status"] == st and r["id"] == rid
        certos += ok
        print(f"[{'OK' if ok else 'FALHA'}] {perg!r:62} -> {r['status']}/{r['id']} (esperado {st}/{rid})")
    n = len(CASOS)
    print(f"\nAcuracia: {certos}/{n} = {100 * certos / n:.0f}%")
    print(f"Tempo medio: {statistics.mean(tempos):.2f} ms | maximo: {max(tempos):.2f} ms")
    # integridade da base e do grafo
    temas = {r["tema"] for r in base.values()}
    ligacoes = sum(len(r["relacionados"]) for r in base.values())
    assert len(base) >= 15 and len(temas) >= 3, "base insuficiente"
    assert all(i in base for r in base.values() for i in r["relacionados"]), "aresta invalida no grafo"
    assert all(r["fonte"] and r["url"] for r in base.values()), "registro sem fonte"
    print(f"Base: {len(base)} registros, {len(temas)} temas, {ligacoes} arestas no grafo - integridade OK")
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        vok, vn = testar_validacao(Path(d))
    cmp = comparar_modelos(base)
    for m, (tam, comp, nn) in cmp.items():
        print(f"Modelo {m}: {comp}/{nn} respostas com fonte+data+aviso corretos; tamanho medio {tam:.0f} caracteres")
    sys.exit(0 if certos == n and vok == vn else 1)


if __name__ == "__main__":
    main()
