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
    ("Como abrir MEI de graca?", "ok", "B1"),
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
    # abrir, dia a dia e preco (linguagem do empreendedor)
    ("quero abrir meu mei, por onde comeco?", "ok", "B1"),
    ("que atividades posso ter no mei?", "ok", "B2"),
    ("posso contratar funcionario com carteira assinada?", "ok", "D1"),
    ("posso abrir mei com um socio?", "ok", "D2"),
    ("esqueci de pagar o das, e agora?", "ok", "D4"),
    ("como emitir nota de servico pelo emissor nacional?", "ok", "D5"),
    ("como calcular o preco de venda do meu produto?", "ok", "P1"),
    ("qual a diferenca entre markup e margem de lucro?", "ok", "P2"),
    ("quanto preciso vender para pagar as contas?", "ok", "P3"),
    ("recebi um boleto falso de taxa de registro do mei", "ok", "B3"),
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
    import calculadora
    assert [calculadora.das_mei(a) for a in ("comercio", "servicos", "ambos")] == [82.05, 86.05, 87.05], "DAS-MEI diverge do registro M2"
    assert calculadora.analisar_mei("servicos", 12, 60000, 6, 6000)["status"] == "ate_20"
    assert calculadora.analisar_mei("servicos", 12, 70000, 6, 9000)["status"] == "acima_20"
    print("Calculadora MEI: DAS por atividade e faixas de excesso OK")
    p = calculadora.preco_produto(20, 1500, 100, 5, 0, 20, 40)   # (20 + 15) / 0,75
    assert p["preco_sugerido"] == 46.67 and p["markup_multiplicador"] == 1.3333 and p["preco_atual"]["status"] == "abaixo_da_meta"
    c = p["composicao"]
    assert abs(sum(c.values()) - p["preco_sugerido"]) < 0.02, "composicao do preco nao fecha"
    assert calculadora.preco_produto(20, 1500, 100, 5, 0, 20, 30)["preco_atual"]["status"] == "prejuizo"
    assert abs(calculadora.preco_produto(20, 1500, 100, 5, 0, 20, p["preco_minimo"])["preco_atual"]["lucro_unit"]) < 0.01
    ex = calculadora.preco_produto(100, 0, 1, 36.7, 0, 20)   # exemplo do Sebrae: despesas+lucro = 56,70% -> markup 2,3095 -> R$ 230,95
    assert ex["preco_sugerido"] == 230.95 and ex["markup_multiplicador"] == 2.3095, ex
    assert calculadora.preco_servico(3000, 800, 100, 2, 10, 0, 0, 10)["valor_hora"] == 38.0
    for ruim in [(10, 100, 10, 50, 30, 30), (10, 100, 0, 5, 0, 20), (-1, 100, 10, 5, 0, 20)]:
        try:
            calculadora.preco_produto(*ruim)
            raise AssertionError(f"aceitou entrada invalida {ruim}")
        except ValueError:
            pass
    print("Calculadora de preco: markup divisor, composicao, preco minimo e validacoes OK")
    # Simples puro x hibrido: Anexo III, RBT12 300 mil (2a faixa, efetiva 8,08%), receita 30 mil, compras 8 mil
    r = calculadora.simular_puro_hibrido("III", 300000, 30000, 2033, 8000, pct_b2b=50)
    assert r["puro"]["total"] == 2424.0 and r["hibrido"]["das"] == 1233.82, "DAS puro/hibrido 2033"
    assert (r["hibrido"]["debito"], r["hibrido"]["credito_compras"], r["hibrido"]["total"]) == (7950.0, 2120.0, 7063.82), "IBS/CBS 2033"
    assert calculadora.simular_puro_hibrido("III", 300000, 30000, 2027, 8000)["hibrido"]["total"] == 3945.5, "transicao 2027"
    assert calculadora.simular_puro_hibrido("III", 300000, 30000, 2026)["hibrido"] is None, "sem hibrido antes de 2027"
    f5 = calculadora.simular_puro_hibrido("III", 3000000, 250000, 2033)
    assert abs(f5["aliquota_efetiva"] * f5["parcela_icms_iss"] - 0.05) < 1e-12, "teto de 5% do ISS"
    assert set(calculadora.REPARTICAO) == set(calculadora.ANEXOS) and all(len(f) == 6 for f in calculadora.REPARTICAO.values()), "reparticao"
    hist = calculadora.meses_base_rbt12("2026-11", 300000)
    assert round(sum(m["receita"] for m in hist), 2) == 300000 and hist[0]["mes"] == "2025-11", "base do RBT12"
    hist.append({"mes": "2026-11", "receita": 42000, "compras": 0, "tipo": "previsao"})
    hist.append({"mes": "2026-12", "receita": 42000, "compras": 0, "tipo": "previsao"})
    linhas = calculadora.projetar_historico(hist, {"anexo": "I"})
    assert [ln["situacao"] for ln in linhas].count("base") == 12 and linhas[12]["rbt12"] == 300000.0, "RBT12 do 1o mes"
    assert linhas[13]["rbt12"] == 317000.0, "RBT12 rola: sai a media de 25 mil e entra 42 mil"
    print("Simples puro x hibrido: transicao 2026-2033, teto do ISS e historico do RBT12 OK")
    cmp = comparar_modelos(base)
    for m, (tam, comp, nn) in cmp.items():
        print(f"Modelo {m}: {comp}/{nn} respostas com fonte+data+aviso corretos; tamanho medio {tam:.0f} caracteres")
    sys.exit(0 if certos == n and vok == vn else 1)


if __name__ == "__main__":
    main()
