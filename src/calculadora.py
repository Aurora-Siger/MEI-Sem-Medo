"""Calculadoras do MEI sem Medo: DAS do Simples e simulacao de creditos de IBS/CBS.

Sao SIMULACOES didaticas. As aliquotas de IBS/CBS e a regulamentacao do Simples ainda
estao em definicao; todo parametro estimado e editavel e deve ser confirmado.
Uso: python src/calculadora.py
"""

# Tabelas do Simples Nacional (LC 123/2006, anexos I a V): (limite da faixa de RBT12, aliquota nominal %, parcela a deduzir)
ANEXOS = {
    "I": ("Comércio", [(180000, 4.0, 0), (360000, 7.3, 5940), (720000, 9.5, 13860),
                       (1800000, 10.7, 22500), (3600000, 14.3, 87300), (4800000, 19.0, 378000)]),
    "II": ("Indústria", [(180000, 4.5, 0), (360000, 7.8, 5940), (720000, 10.0, 13860),
                         (1800000, 11.2, 22500), (3600000, 14.7, 85500), (4800000, 30.0, 720000)]),
    "III": ("Serviços (geral)", [(180000, 6.0, 0), (360000, 11.2, 9360), (720000, 13.5, 17640),
                                 (1800000, 16.0, 35640), (3600000, 21.0, 125640), (4800000, 33.0, 648000)]),
    "IV": ("Serviços (construção, limpeza, vigilância)", [(180000, 4.5, 0), (360000, 9.0, 8100), (720000, 10.2, 12420),
                                                         (1800000, 14.0, 39780), (3600000, 22.0, 183780), (4800000, 33.0, 828000)]),
    "V": ("Serviços intelectuais/técnicos", [(180000, 15.5, 0), (360000, 18.0, 4500), (720000, 19.5, 9900),
                                             (1800000, 20.5, 17100), (3600000, 23.0, 62100), (4800000, 30.5, 540000)]),
}
LIMITE_SIMPLES = 4800000


def anexo_por_fator_r(anexo, folha12, rbt12):
    """Atividades sujeitas ao Fator R: Anexo V vira III se folha/receita >= 28%."""
    if anexo == "V" and rbt12 > 0 and folha12 / rbt12 >= 0.28:
        return "III"
    return anexo


def aliquota_efetiva(anexo, rbt12):
    """Retorna (aliquota efetiva em fracao, aliquota nominal %, faixa 1-6). Levanta ValueError se invalido."""
    if anexo not in ANEXOS:
        raise ValueError("Anexo deve ser I, II, III, IV ou V.")
    if rbt12 <= 0:
        raise ValueError("A receita dos últimos 12 meses (RBT12) deve ser maior que zero.")
    if rbt12 > LIMITE_SIMPLES:
        raise ValueError("RBT12 acima de R$ 4,8 milhões: fora do limite do Simples Nacional.")
    for n, (teto, nominal, deduzir) in enumerate(ANEXOS[anexo][1], 1):
        if rbt12 <= teto:
            return (rbt12 * nominal / 100 - deduzir) / rbt12, nominal, n


def calcular_das(anexo, rbt12, receita_mes, folha12=0.0):
    anexo = anexo_por_fator_r(anexo, folha12, rbt12)
    if receita_mes < 0:
        raise ValueError("A receita do mês não pode ser negativa.")
    ef, nominal, faixa = aliquota_efetiva(anexo, rbt12)
    return {"anexo": anexo, "faixa": faixa, "aliquota_nominal": nominal,
            "aliquota_efetiva": ef, "das": round(receita_mes * ef, 2)}


def simular_creditos(vendas_b2b, vendas_consumidor, compras_com_credito, aliquota_ibs_cbs, das_total, parcela_ibs_cbs_no_das):
    """Compara, so para IBS+CBS, ficar no Simples x pagar IBS/CBS pelo regime regular (valores mensais).

    aliquota_ibs_cbs:        % combinada de IBS+CBS (ESTIMATIVA editavel; a aliquota final ainda nao e definitiva).
    parcela_ibs_cbs_no_das:  % do DAS que corresponde a IBS+CBS (ESTIMATIVA editavel).
    compras_com_credito:     compras no mes de fornecedores do regime regular (valor sem imposto).
    Retorna dict com tributo a pagar, credito que o cliente B2B recebe e credito aproveitado nas compras.
    """
    for nome, v in (("vendas B2B", vendas_b2b), ("vendas ao consumidor", vendas_consumidor),
                    ("compras com crédito", compras_com_credito), ("DAS", das_total)):
        if v < 0:
            raise ValueError(f"{nome} não pode ser negativo.")
    if not 0 <= aliquota_ibs_cbs <= 100 or not 0 <= parcela_ibs_cbs_no_das <= 100:
        raise ValueError("Percentuais devem estar entre 0 e 100.")
    a = aliquota_ibs_cbs / 100
    vendas = vendas_b2b + vendas_consumidor
    # Simples: paga a parcela de IBS/CBS dentro do DAS; cliente B2B so credita o que foi pago; sem credito nas compras
    ibs_no_das = round(das_total * parcela_ibs_cbs_no_das / 100, 2)
    simples = {"imposto_ibs_cbs": ibs_no_das, "credito_para_cliente_b2b": ibs_no_das * (vendas_b2b / vendas) if vendas else 0.0,
               "credito_das_compras": 0.0}
    simples["credito_para_cliente_b2b"] = round(simples["credito_para_cliente_b2b"], 2)
    # Regime regular: debito sobre vendas menos credito das compras; cliente B2B credita a aliquota cheia
    debito = round(vendas * a, 2)
    credito_compras = round(compras_com_credito * a, 2)
    regular = {"imposto_ibs_cbs": round(debito - credito_compras, 2),
               "credito_para_cliente_b2b": round(vendas_b2b * a, 2), "credito_das_compras": credito_compras}
    # Ficar no Simples mantem o resto do DAS; no regular o DAS cai pela parcela de IBS/CBS
    custo_simples = das_total
    custo_regular = round(das_total - ibs_no_das + regular["imposto_ibs_cbs"], 2)
    return {"simples": simples, "regular": regular, "custo_total_simples": custo_simples,
            "custo_total_regular": custo_regular, "diferenca": round(custo_regular - custo_simples, 2),
            # o que o Simples deixa na mesa: credito que o cliente B2B nao recebe e credito das suas compras nao aproveitado
            "credito_perdido_pelo_cliente": round(regular["credito_para_cliente_b2b"] - simples["credito_para_cliente_b2b"], 2),
            "credito_compras_nao_aproveitado": credito_compras}


def _num(msg, padrao=None):
    while True:
        txt = input(msg).strip().replace(".", "").replace(",", ".") if padrao is None else (input(msg).strip().replace(",", ".") or str(padrao))
        try:
            return float(txt)
        except ValueError:
            print("Digite um número, por exemplo 12000.")


def main():
    print("Calculadoras (simulação didática, NÃO é cálculo oficial). 1) DAS do Simples  2) Créditos IBS/CBS  Enter) sair")
    esc = input("Opção: ").strip()
    try:
        if esc == "1":
            anexo = input("Anexo (I a V): ").strip().upper()
            r = calcular_das(anexo, _num("Receita dos últimos 12 meses (RBT12): "), _num("Receita do mês: "),
                             _num("Folha de salários 12 meses (0 se não souber): "))
            print(f"Anexo {r['anexo']}, faixa {r['faixa']}, nominal {r['aliquota_nominal']}%, efetiva {r['aliquota_efetiva']*100:.2f}% -> DAS ≈ R$ {r['das']:.2f}")
        elif esc == "2":
            das = _num("DAS do mês (R$): ")
            r = simular_creditos(_num("Vendas do mês para empresas B2B (R$): "), _num("Vendas ao consumidor final (R$): "),
                                 _num("Compras do mês com crédito (R$): "), _num("Alíquota IBS+CBS estimada % [26.5]: ", 26.5),
                                 das, _num("% do DAS que é IBS/CBS (estimativa) [15]: ", 15))
            print(r)
    except ValueError as e:
        print(f"Dado inválido: {e}")


if __name__ == "__main__":
    main()
