"""Calculadoras do MEI sem Medo: DAS do Simples e simulacao de creditos de IBS/CBS.

Sao SIMULACOES didaticas. As aliquotas de IBS/CBS e a regulamentacao do Simples ainda
estao em definicao; todo parametro estimado e editavel e deve ser confirmado.
Uso: python src/calculadora.py
"""
import json
import math

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


# ---------------------------------------------------------------------------------------------
# Simples puro x Simples hibrido (a partir de 2027)
# Puro: tudo continua no DAS. Hibrido: a CBS (no lugar de PIS/Cofins) e o IBS (no lugar de ICMS/ISS)
# saem do DAS e sao pagos a parte, com debito sobre as vendas e credito das compras.
# ---------------------------------------------------------------------------------------------

# Reparticao dos tributos dentro do DAS (LC 123/2006, anexos I a V), em % do DAS, por faixa:
# (Cofins, PIS, ICMS ou ISS). O restante (IRPJ, CSLL, CPP, IPI) fica no DAS nos dois regimes.
# Na 6a faixa o ICMS/ISS ja e recolhido fora do Simples (sublimite de R$ 3,6 milhoes).
REPARTICAO = {
    "I": [(12.74, 2.76, 34.0), (12.74, 2.76, 34.0), (12.74, 2.76, 33.5), (12.74, 2.76, 33.5), (12.74, 2.76, 33.5), (28.27, 6.13, 0.0)],
    "II": [(11.51, 2.49, 32.0)] * 5 + [(20.96, 4.54, 0.0)],
    "III": [(12.82, 2.78, 33.5), (14.05, 3.05, 32.0), (13.64, 2.96, 32.5), (13.64, 2.96, 32.5), (12.82, 2.78, 33.5), (16.03, 3.47, 0.0)],
    "IV": [(17.67, 3.83, 44.5), (20.55, 4.45, 40.0), (19.73, 4.27, 40.0), (18.90, 4.10, 40.0), (18.08, 3.92, 40.0), (20.55, 4.45, 0.0)],
    "V": [(14.10, 3.05, 14.0), (14.10, 3.05, 17.0), (14.92, 3.23, 19.0), (15.74, 3.41, 21.0), (14.10, 3.05, 23.5), (16.44, 3.56, 0.0)],
}
ANEXOS_COM_ISS = ("III", "IV", "V")
ISS_MAXIMO = 0.05  # LC 123: ISS efetivo de no maximo 5%; a diferenca vai, proporcionalmente, aos tributos federais
ANO_INICIO_HIBRIDO = 2027
CONFIG_PADRAO = {"anexo": "III", "folha12": 0.0, "aliq_cbs": 8.8, "aliq_ibs": 17.7, "reducao_setor": 0.0, "pct_b2b": 0.0}


def _r2(x):
    """Arredonda para centavos igual ao Math.round do JavaScript (paridade com web/motor.js)."""
    return math.floor(x * 100 + 0.5) / 100


def regras_ano(ano):
    """Regras de transicao (EC 132/2023 e LC 214/2025) usadas na simulacao. None antes de 2027 (nao ha CBS/IBS).

    reducao_cbs: pontos a menos na CBS (2027-2028, compensando o IBS de teste).
    ibs_fixo:    aliquota de teste do IBS em 2027-2028 (0,05% estadual + 0,05% municipal).
    fracao_ibs:  parte do ICMS/ISS ja convertida em IBS (sobe 10% ao ano de 2029 a 2032; 100% em 2033).
    """
    if ano < ANO_INICIO_HIBRIDO:
        return None
    if ano <= 2028:
        return {"reducao_cbs": 0.1, "ibs_fixo": 0.1, "fracao_ibs": 0.0}
    if ano <= 2032:
        return {"reducao_cbs": 0.0, "ibs_fixo": None, "fracao_ibs": (ano - 2028) / 10}
    return {"reducao_cbs": 0.0, "ibs_fixo": None, "fracao_ibs": 1.0}


def parcelas_do_das(anexo, faixa, aliquota_efetiva):
    """Fracao do DAS que e PIS+Cofins (vira CBS) e ICMS/ISS (vira IBS), com o teto de 5% de ISS."""
    cofins, pis, icms_iss = REPARTICAO[anexo][faixa - 1]
    p_cbs, p_ibs = (cofins + pis) / 100, icms_iss / 100
    if anexo in ANEXOS_COM_ISS and aliquota_efetiva * p_ibs > ISS_MAXIMO:
        novo = ISS_MAXIMO / aliquota_efetiva
        p_cbs = p_cbs * (1 - novo) / (1 - p_ibs)
        p_ibs = novo
    return p_cbs, p_ibs


def simular_puro_hibrido(anexo, rbt12, receita_mes, ano, compras_com_credito=0.0, aliq_cbs=8.8, aliq_ibs=17.7,
                         reducao_setor=0.0, pct_b2b=0.0, folha12=0.0, saldo_credor=0.0):
    """Quanto a empresa paga no mes no Simples puro e no Simples hibrido (SIMULACAO didatica).

    compras_com_credito: compras do mes de fornecedores do regime regular, sem imposto (geram credito no hibrido).
    aliq_cbs, aliq_ibs:  aliquotas cheias de referencia, em % (ESTIMATIVAS editaveis).
    reducao_setor:       reducao da aliquota do setor, em % (0, 30 ou 60). Vale para as vendas, nao para as compras.
    pct_b2b:             % das vendas para empresas (so muda o credito que o cliente recebe).
    saldo_credor:        credito de IBS/CBS que sobrou de meses anteriores (abate o que pagar no hibrido).
    """
    for nome, v in (("A receita do mês", receita_mes), ("As compras com crédito", compras_com_credito),
                    ("A folha de salários", folha12), ("O saldo credor", saldo_credor)):
        if v < 0:
            raise ValueError(f"{nome} não pode ser negativa.")
    for nome, v in (("A alíquota da CBS", aliq_cbs), ("A alíquota do IBS", aliq_ibs),
                    ("A redução do setor", reducao_setor), ("O percentual de vendas B2B", pct_b2b)):
        if not 0 <= v <= 100:
            raise ValueError(f"{nome} deve estar entre 0 e 100%.")
    base = calcular_das(anexo, rbt12, receita_mes, folha12)
    das = base["das"]
    p_cbs, p_ibs = parcelas_do_das(base["anexo"], base["faixa"], base["aliquota_efetiva"])
    regra = regras_ano(int(ano))
    res = {**base, "ano": int(ano), "rbt12": rbt12, "parcela_pis_cofins": p_cbs, "parcela_icms_iss": p_ibs, "regra": regra}
    b2b = pct_b2b / 100
    if regra is None:  # antes de 2027: so existe o Simples de hoje
        res.update(puro={"das": das, "cbs_no_das": 0.0, "ibs_no_das": 0.0, "credito_cliente_b2b": 0.0, "total": das},
                   hibrido=None, diferenca=None)
        return res
    cbs_no_das = _r2(das * p_cbs)
    ibs_no_das = _r2(das * p_ibs * regra["fracao_ibs"])
    puro = {"das": das, "cbs_no_das": cbs_no_das, "ibs_no_das": ibs_no_das,
            "credito_cliente_b2b": _r2((cbs_no_das + ibs_no_das) * b2b), "total": das}
    cbs_cheia = max(0.0, aliq_cbs - regra["reducao_cbs"])
    ibs_cheia = regra["ibs_fixo"] if regra["ibs_fixo"] is not None else aliq_ibs * regra["fracao_ibs"]
    fator = 1 - reducao_setor / 100
    cbs_venda = _r2(receita_mes * cbs_cheia * fator / 100)
    ibs_venda = _r2(receita_mes * ibs_cheia * fator / 100)
    debito = _r2(cbs_venda + ibs_venda)
    credito = _r2(compras_com_credito * (cbs_cheia + ibs_cheia) / 100)
    disponivel = _r2(credito + saldo_credor)
    das_h = _r2(das - cbs_no_das - ibs_no_das)
    a_pagar = _r2(max(0.0, debito - disponivel))
    hibrido = {"das": das_h, "aliq_cbs": cbs_cheia * fator, "aliq_ibs": ibs_cheia * fator,
               "cbs_vendas": cbs_venda, "ibs_vendas": ibs_venda, "debito": debito, "credito_compras": credito,
               "saldo_credor_anterior": _r2(saldo_credor), "ibs_cbs_a_pagar": a_pagar,
               "saldo_credor_final": _r2(max(0.0, disponivel - debito)),
               "credito_cliente_b2b": _r2(receita_mes * b2b * (cbs_cheia + ibs_cheia) * fator / 100),
               "total": _r2(das_h + a_pagar)}
    res.update(puro=puro, hibrido=hibrido, diferenca=_r2(hibrido["total"] - puro["total"]))
    return res


# ----- Historico mes a mes do RBT12 -----

def _mes_idx(mes):
    """'2026-11' -> indice de mes (ano*12 + mes-1). Levanta ValueError se invalido."""
    try:
        ano, m = (int(x) for x in str(mes).split("-"))
    except ValueError:
        raise ValueError(f"Mês inválido: {mes!r}. Use o formato AAAA-MM, por exemplo 2026-11.") from None
    if not (2000 <= ano <= 2100 and 1 <= m <= 12):
        raise ValueError(f"Mês inválido: {mes!r}. Use o formato AAAA-MM, por exemplo 2026-11.")
    return ano * 12 + m - 1


def somar_meses(mes, n):
    i = _mes_idx(mes) + n
    return f"{i // 12:04d}-{i % 12 + 1:02d}"


def meses_base_rbt12(mes_referencia, rbt12):
    """Quando so se sabe o RBT12 total: cria os 12 meses anteriores a mes_referencia com a media (RBT12 / 12)."""
    if not rbt12 > 0:
        raise ValueError("Informe um RBT12 maior que zero.")
    media = _r2(rbt12 / 12)
    meses = [{"mes": somar_meses(mes_referencia, k - 12), "receita": media, "compras": 0.0, "tipo": "media"} for k in range(12)]
    meses[-1]["receita"] = _r2(rbt12 - media * 11)  # a soma fecha exatamente no RBT12 informado
    return meses


def projetar_historico(meses, config=None):
    """Calcula, mes a mes, o RBT12 (soma dos 12 meses anteriores) e o puro x hibrido de cada mes.

    meses:  lista de {"mes": "AAAA-MM", "receita": R$, "compras": R$ (opcional), "tipo": "real"|"previsao"|"media"}.
    config: anexo, folha12, aliq_cbs, aliq_ibs, reducao_setor, pct_b2b (faltando, usa CONFIG_PADRAO).
    O saldo credor do hibrido passa de um mes para o outro. Meses sem os 12 anteriores ficam como 'base'.
    """
    cfg = {**CONFIG_PADRAO, **(config or {})}
    por_idx = {}
    for m in meses:
        i = _mes_idx(m.get("mes"))
        if i in por_idx:
            raise ValueError(f"Mês repetido no histórico: {m['mes']}.")
        receita, compras = float(m.get("receita") or 0), float(m.get("compras") or 0)
        if receita < 0 or compras < 0:
            raise ValueError(f"Valores negativos em {m['mes']}.")
        por_idx[i] = {"mes": somar_meses(m["mes"], 0), "tipo": m.get("tipo", "real"), "receita": receita, "compras": compras}
    linhas, saldo = [], 0.0
    inicio = min(por_idx) if por_idx else 0
    for i in sorted(por_idx):
        m = por_idx[i]
        linha = {**m, "rbt12": None, "situacao": "ok", "erro": None, "resultado": None}
        janela = [por_idx.get(j) for j in range(i - 12, i)]
        if any(x is None for x in janela):
            linha["situacao"] = "base" if i - 12 < inicio else "lacuna"
            linha["erro"] = None if linha["situacao"] == "base" else "Faltam meses anteriores no histórico para fechar o RBT12."
            linhas.append(linha)
            continue
        rbt12 = 0.0
        for x in janela:
            rbt12 += x["receita"]
        linha["rbt12"] = _r2(rbt12)
        try:
            r = simular_puro_hibrido(cfg["anexo"], linha["rbt12"], m["receita"], i // 12, m["compras"], cfg["aliq_cbs"],
                                     cfg["aliq_ibs"], cfg["reducao_setor"], cfg["pct_b2b"], cfg["folha12"], saldo)
        except ValueError as e:
            linha.update(situacao="erro", erro=str(e))
            linhas.append(linha)
            continue
        if r["hibrido"]:
            saldo = r["hibrido"]["saldo_credor_final"]
        linha["resultado"] = r
        linhas.append(linha)
    return linhas


def carregar_historico(caminho):
    """Le um historico exportado pelo site (botao Exportar). Retorna (nome, config, meses)."""
    import json
    with open(caminho, encoding="utf-8") as f:
        dados = json.load(f)
    if not isinstance(dados, dict) or not isinstance(dados.get("meses"), list):
        raise ValueError("Arquivo não é um histórico do MEI sem Medo (falta a lista 'meses').")
    return dados.get("nome", "Histórico"), {**CONFIG_PADRAO, **(dados.get("config") or {})}, dados["meses"]


LIMITE_MEI = 81000.0
ATIVIDADES_MEI = {"comercio": ("Comércio / indústria", 1.0, "I"), "servicos": ("Serviços", 5.0, "III"), "ambos": ("Comércio e serviços", 6.0, "III")}


def das_mei(atividade, salario_minimo=1621.0):
    """DAS-MEI mensal: 5% do salario minimo (INSS) + R$ 1 de ICMS e/ou R$ 5 de ISS."""
    if atividade not in ATIVIDADES_MEI:
        raise ValueError("Atividade deve ser comercio, servicos ou ambos.")
    return round(salario_minimo * 0.05 + ATIVIDADES_MEI[atividade][1], 2)


def analisar_mei(atividade, meses_no_ano, faturado, meses_restantes, media_prevista, salario_minimo=1621.0):
    """Acompanha o limite do MEI no ano.

    meses_no_ano: meses de atividade neste ano (12 se abriu antes; proporcional no ano de abertura).
    faturado: total faturado no ano ate agora. meses_restantes: meses que faltam ate dezembro.
    media_prevista: faturamento mensal esperado nos meses restantes.
    """
    if not 1 <= meses_no_ano <= 12 or not 0 <= meses_restantes <= meses_no_ano:
        raise ValueError("Meses inválidos: use de 1 a 12, e meses restantes não pode passar dos meses de atividade no ano.")
    if faturado < 0 or media_prevista < 0:
        raise ValueError("Valores de faturamento não podem ser negativos.")
    das = das_mei(atividade, salario_minimo)
    limite = LIMITE_MEI / 12 * meses_no_ano
    projecao = faturado + media_prevista * meses_restantes
    excesso = max(0.0, projecao - limite)
    perc = excesso / limite
    status = "dentro" if excesso == 0 else ("ate_20" if perc <= 0.20 else "acima_20")
    folga = max(0.0, limite - faturado)
    nominal = ANEXOS["I" if ATIVIDADES_MEI[atividade][2] == "I" else "III"][1][0][1] / 100
    anual = projecao / meses_no_ano * 12
    try:
        me_anual = round(anual * aliquota_efetiva(ATIVIDADES_MEI[atividade][2], max(anual, 1))[0], 2)
    except ValueError:
        me_anual = None  # acima do limite do Simples
    return {"das_mensal": das, "limite_ano": round(limite, 2), "projecao": round(projecao, 2), "excesso": round(excesso, 2),
            "excesso_pct": perc, "status": status, "uso_pct": faturado / limite, "folga": round(folga, 2),
            "maximo_por_mes_restante": round(folga / meses_restantes, 2) if meses_restantes else 0.0,
            "das_complementar_estimado": round(excesso * nominal, 2) if status == "ate_20" else None,
            "custo_anual_mei": round(das * 12, 2), "custo_anual_microempresa": me_anual}


# ---------------- Formacao de preco (metodo do markup divisor, como ensina o Sebrae) ----------------
def _preco_comum(base_unit, var_pct, imposto_pct, lucro_pct, fixo_total, volume):
    """Nucleo: preco = (custo direto + custo fixo rateado) / (1 - (variaveis + impostos + lucro)).

    var_pct: comissao, taxa de maquininha/marketplace etc. (% do preco). imposto_pct: % do preco que vai de imposto
    (MEI: 0 e o DAS fixo entra nas despesas fixas). lucro_pct: lucro desejado (% do preco).
    """
    for nome, v in (("custo", base_unit), ("despesas fixas", fixo_total)):
        if v < 0:
            raise ValueError(f"{nome} não pode ser negativo.")
    for nome, v in (("variáveis", var_pct), ("impostos", imposto_pct), ("lucro", lucro_pct)):
        if not 0 <= v < 100:
            raise ValueError(f"O percentual de {nome} deve estar entre 0 e 99,99.")
    if volume <= 0:
        raise ValueError("A quantidade vendida por mês deve ser maior que zero.")
    soma = var_pct + imposto_pct + lucro_pct
    if soma >= 100:
        raise ValueError(f"Variáveis + impostos + lucro somam {soma:.2f}%: precisam ficar abaixo de 100%, senão nenhum preço fecha a conta.")
    fixo_unit = fixo_total / volume
    divisor = (100 - soma) / 100
    preco = (base_unit + fixo_unit) / divisor
    minimo = (base_unit + fixo_unit) / ((100 - var_pct - imposto_pct) / 100)   # lucro zero
    return preco, fixo_unit, divisor, minimo


def _resumo_preco(preco, base_unit, fixo_unit, var_pct, imposto_pct, volume, fixo_total, divisor, minimo, preco_atual):
    var_v, imp_v = preco * var_pct / 100, preco * imposto_pct / 100
    lucro_v = preco - base_unit - fixo_unit - var_v - imp_v
    mc = preco - base_unit - var_v - imp_v          # margem de contribuicao unitaria
    r = {"preco_sugerido": _r2(preco), "markup_multiplicador": round(1 / divisor, 4), "divisor": round(divisor, 4),
         "composicao": {"custo_direto": _r2(base_unit), "custo_fixo_rateado": _r2(fixo_unit), "variaveis": _r2(var_v), "impostos": _r2(imp_v), "lucro": _r2(lucro_v)},
         "margem_contribuicao_unit": _r2(mc),
         "ponto_equilibrio_unidades": round(fixo_total / mc, 1) if mc > 0 else None,
         "lucro_mensal_estimado": _r2(lucro_v * volume), "preco_minimo": _r2(minimo),
         "desconto_maximo_pct": round((1 - minimo / preco) * 100, 1) if preco > 0 else 0.0}
    if preco_atual is not None:
        if preco_atual <= 0:
            raise ValueError("O preço atual deve ser maior que zero.")
        lucro_atual = preco_atual * (1 - (var_pct + imposto_pct) / 100) - base_unit - fixo_unit
        r["preco_atual"] = {"valor": _r2(preco_atual), "lucro_unit": _r2(lucro_atual), "margem_pct": round(lucro_atual / preco_atual * 100, 1),
                            "lucro_mensal": _r2(lucro_atual * volume), "status": "prejuizo" if lucro_atual < 0 else ("abaixo_da_meta" if preco_atual < preco - 0.005 else "ok")}
    return r


def preco_produto(custo_unit, despesas_fixas_mes, volume_mes, var_pct, imposto_pct, lucro_pct, preco_atual=None):
    """Preco de venda de um produto. despesas_fixas_mes inclui aluguel, internet, o seu pro-labore e, no MEI, o DAS."""
    preco, fixo_unit, divisor, minimo = _preco_comum(custo_unit, var_pct, imposto_pct, lucro_pct, despesas_fixas_mes, volume_mes)
    return _resumo_preco(preco, custo_unit, fixo_unit, var_pct, imposto_pct, volume_mes, despesas_fixas_mes, divisor, minimo, preco_atual)


def preco_servico(renda_desejada_mes, despesas_fixas_mes, horas_produtivas_mes, horas_do_servico, materiais, var_pct, imposto_pct, lucro_pct, preco_atual=None):
    """Preco de um servico: valor da hora = (sua renda + despesas fixas) / horas realmente faturaveis no mes."""
    if horas_produtivas_mes <= 0 or horas_do_servico <= 0:
        raise ValueError("As horas produtivas do mês e as horas do serviço devem ser maiores que zero.")
    if renda_desejada_mes < 0:
        raise ValueError("A renda desejada não pode ser negativa.")
    hora = (renda_desejada_mes + despesas_fixas_mes) / horas_produtivas_mes
    # a renda e as despesas ja estao na hora; o 'lucro' aqui e margem extra sobre o preco
    preco, _, divisor, minimo = _preco_comum(materiais + hora * horas_do_servico, var_pct, imposto_pct, lucro_pct, 0.0, 1)
    r = _resumo_preco(preco, materiais + hora * horas_do_servico, 0.0, var_pct, imposto_pct, 1, 0.0, divisor, minimo, preco_atual)
    r.pop("ponto_equilibrio_unidades"), r.pop("lucro_mensal_estimado")   # nao fazem sentido para um servico avulso
    r["valor_hora"] = _r2(hora)
    r["valor_hora_com_encargos"] = _r2(hora / divisor) if divisor else None
    return r


def _num(msg, padrao=None):
    while True:
        txt = input(msg).strip().replace(".", "").replace(",", ".") if padrao is None else (input(msg).strip().replace(",", ".") or str(padrao))
        try:
            return float(txt)
        except ValueError:
            print("Digite um número, por exemplo 12000.")


def _imprimir_puro_hibrido(r):
    print(f"Anexo {r['anexo']}, faixa {r['faixa']}, efetiva {r['aliquota_efetiva']*100:.2f}% -> DAS (puro) R$ {r['puro']['das']:.2f}")
    h = r["hibrido"]
    if h is None:
        print("Antes de 2027 não há CBS/IBS: só existe o Simples atual.")
        return
    print(f"Híbrido: DAS R$ {h['das']:.2f} + IBS/CBS à parte R$ {h['ibs_cbs_a_pagar']:.2f} "
          f"(débito {h['debito']:.2f} - crédito {h['credito_compras']:.2f}) = R$ {h['total']:.2f}")
    print(f"Diferença (híbrido - puro): R$ {r['diferenca']:.2f}. Crédito ao cliente B2B: puro R$ {r['puro']['credito_cliente_b2b']:.2f}"
          f" x híbrido R$ {h['credito_cliente_b2b']:.2f}")


def main():
    print("Calculadoras (simulação didática, NÃO é cálculo oficial). 1) DAS do Simples  2) Créditos IBS/CBS  3) Limite do MEI\n"
          "4) Simples puro x híbrido (um mês)  5) Puro x híbrido mês a mês (histórico exportado do site)\n6) Formação de preço (produto)  7) Formação de preço (serviço)  Enter) sair")
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
        elif esc == "3":
            ativ = input("Atividade (comercio, servicos, ambos): ").strip().lower()
            meses = int(_num("Meses de atividade neste ano (12 se abriu antes): "))
            print(analisar_mei(ativ, meses, _num("Faturado no ano até agora (R$): "), int(_num("Meses que faltam até dezembro: ")),
                               _num("Faturamento mensal previsto (R$): ")))
        elif esc == "4":
            anexo = input("Anexo (I a V): ").strip().upper()
            r = simular_puro_hibrido(anexo, _num("RBT12 (receita dos 12 meses anteriores): "), _num("Receita do mês: "),
                                     int(_num("Ano (2027 a 2033) [2027]: ", 2027)), _num("Compras do mês com crédito: "),
                                     _num("Alíquota da CBS % [8.8]: ", 8.8), _num("Alíquota do IBS % [17.7]: ", 17.7),
                                     _num("Redução do setor % (0, 30 ou 60) [0]: ", 0), _num("% das vendas para empresas [0]: ", 0),
                                     _num("Folha 12 meses (Fator R) [0]: ", 0))
            _imprimir_puro_hibrido(r)
        elif esc == "5":
            nome, cfg, meses = carregar_historico(input("Arquivo .json exportado pelo site: ").strip().strip('"'))
            print(f"{nome} - Anexo {cfg['anexo']}, CBS {cfg['aliq_cbs']}%, IBS {cfg['aliq_ibs']}%")
            print(f"{'Mês':8} {'Receita':>12} {'RBT12':>14} {'Puro':>11} {'Híbrido':>11} {'Diferença':>11}")
            for ln in projetar_historico(meses, cfg):
                r = ln["resultado"]
                if r is None:
                    print(f"{ln['mes']:8} {ln['receita']:12.2f}   {ln['erro'] or 'base do RBT12'}")
                    continue
                h = r["hibrido"]
                print(f"{ln['mes']:8} {ln['receita']:12.2f} {ln['rbt12']:14.2f} {r['puro']['total']:11.2f} "
                      + (f"{h['total']:11.2f} {r['diferenca']:11.2f}" if h else f"{'-':>11} {'-':>11}"))
        elif esc == "6":
            r = preco_produto(_num("Custo do produto por unidade (R$): "), _num("Despesas fixas do mês, com seu pró-labore (R$): "),
                              _num("Quantas unidades vende por mês: "), _num("Taxas e comissões % do preço [0]: ", 0),
                              _num("Impostos % do preço (MEI: 0) [0]: ", 0), _num("Lucro desejado % do preço [20]: ", 20))
            print(json.dumps(r, ensure_ascii=False, indent=1))
        elif esc == "7":
            r = preco_servico(_num("Quanto quer ganhar por mês (R$): "), _num("Despesas fixas do mês (R$): "), _num("Horas faturáveis por mês: "),
                              _num("Horas deste serviço: "), _num("Materiais deste serviço (R$) [0]: ", 0), _num("Taxas % [0]: ", 0),
                              _num("Impostos % (MEI: 0) [0]: ", 0), _num("Margem extra % [0]: ", 0))
            print(json.dumps(r, ensure_ascii=False, indent=1))
    except (ValueError, OSError) as e:
        print(f"Dado inválido: {e}")


if __name__ == "__main__":
    main()
