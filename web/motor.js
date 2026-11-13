// Motor do assistente (porta fiel de src/sistema.py e src/calculadora.py). Sem dependências.
(function (root) {
  const STOP = new Set("a o as os de da do das dos e em no na nos nas um uma que para por com se eu meu minha ao pra qual quais como quando posso preciso tenho ser sao vai mais".split(" "));
  const LIMIAR = 3.0, MARGEM = 0.9;
  const TEMAS = { reforma: "Reforma tributária", mei: "Obrigações do MEI", consumidor: "Direitos do consumidor (CDC/Procon)",
    split: "Split payment", simples: "Simples Nacional: anexos e alíquotas", creditos: "Recuperação de créditos" };

  const norm = (t) => t.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ");
  const tokens = (t) => norm(t).split(" ").filter((x) => x && !STOP.has(x) && x.length > 1);

  function pontuar(r, toks, frase) {
    const chaves = new Set(r.palavras_chave.flatMap(tokens));
    const titulo = new Set(tokens(r.titulo)), corpo = new Set(tokens(r.resposta));
    let s = 0;
    for (const t of toks) s += (chaves.has(t) ? 3 : 0) + (titulo.has(t) ? 2 : 0) + (corpo.has(t) ? 1 : 0);
    for (const k of r.palavras_chave) if (k.includes(" ") && frase.includes(norm(k))) s += 4;
    return s;
  }

  function busca(base, pergunta) {
    const toks = [...new Set(tokens(pergunta))], frase = norm(pergunta);
    return base.map((r) => [pontuar(r, toks, frase), r]).filter((x) => x[0] > 0).sort((a, b) => b[0] - a[0]);
  }

  // Retorna {status: ok|vazia|invalida|ambigua|desconhecida, registro?, opcoes?, texto}
  function perguntar(base, pergunta) {
    if (pergunta == null || !String(pergunta).trim()) return { status: "vazia", texto: "Você não digitou nada. Pergunte, por exemplo: “qual o limite do MEI?”" };
    pergunta = String(pergunta).trim();
    if (pergunta.length < 3 || !/[A-Za-zÀ-ÿ]{2,}/.test(pergunta)) return { status: "invalida", texto: "Não entendi. Escreva uma pergunta com palavras, por exemplo: “MEI precisa emitir nota fiscal?”" };
    if (pergunta.length > 300) return { status: "invalida", texto: "Pergunta muito longa. Tente resumir em uma frase." };
    const rank = busca(base, pergunta);
    if (!rank.length || rank[0][0] < LIMIAR)
      return { status: "desconhecida", texto: "Não encontrei isso na minha base verificada, então não vou chutar. Confirme no Portal do Empreendedor (gov.br/empresas-e-negocios), na Receita Federal ou com um contador." };
    const topo = rank[0];
    if (rank.length > 1 && rank[1][0] >= MARGEM * topo[0] && rank[1][1].tema !== topo[1].tema)
      return { status: "ambigua", opcoes: [topo[1], rank[1][1]], texto: "Sua pergunta pode ser sobre dois assuntos. Qual você quer?" };
    return { status: "ok", registro: topo[1], texto: topo[1].resposta };
  }

  const relacionados = (base, r) => r.relacionados.map((i) => base.find((x) => x.id === i)).filter(Boolean).slice(0, 3);

  // ---- Calculadoras ----
  const ANEXOS = {
    I: ["Comércio", [[180000, 4.0, 0], [360000, 7.3, 5940], [720000, 9.5, 13860], [1800000, 10.7, 22500], [3600000, 14.3, 87300], [4800000, 19.0, 378000]]],
    II: ["Indústria", [[180000, 4.5, 0], [360000, 7.8, 5940], [720000, 10.0, 13860], [1800000, 11.2, 22500], [3600000, 14.7, 85500], [4800000, 30.0, 720000]]],
    III: ["Serviços (geral)", [[180000, 6.0, 0], [360000, 11.2, 9360], [720000, 13.5, 17640], [1800000, 16.0, 35640], [3600000, 21.0, 125640], [4800000, 33.0, 648000]]],
    IV: ["Serviços (construção, limpeza, vigilância)", [[180000, 4.5, 0], [360000, 9.0, 8100], [720000, 10.2, 12420], [1800000, 14.0, 39780], [3600000, 22.0, 183780], [4800000, 33.0, 828000]]],
    V: ["Serviços intelectuais/técnicos", [[180000, 15.5, 0], [360000, 18.0, 4500], [720000, 19.5, 9900], [1800000, 20.5, 17100], [3600000, 23.0, 62100], [4800000, 30.5, 540000]]],
  };
  const r2 = (x) => Math.round(x * 100) / 100;

  function aliquotaEfetiva(anexo, rbt12) {
    if (!ANEXOS[anexo]) throw new Error("Anexo deve ser I, II, III, IV ou V.");
    if (!(rbt12 > 0)) throw new Error("A receita dos últimos 12 meses (RBT12) deve ser maior que zero.");
    if (rbt12 > 4800000) throw new Error("RBT12 acima de R$ 4,8 milhões: fora do limite do Simples Nacional.");
    const faixas = ANEXOS[anexo][1];
    for (let n = 0; n < faixas.length; n++) {
      const [teto, nominal, deduzir] = faixas[n];
      if (rbt12 <= teto) return { efetiva: (rbt12 * nominal / 100 - deduzir) / rbt12, nominal, faixa: n + 1 };
    }
  }

  function calcularDas(anexo, rbt12, receitaMes, folha12 = 0) {
    if (anexo === "V" && rbt12 > 0 && folha12 / rbt12 >= 0.28) anexo = "III";
    if (receitaMes < 0) throw new Error("A receita do mês não pode ser negativa.");
    const a = aliquotaEfetiva(anexo, rbt12);
    return { anexo, faixa: a.faixa, aliquota_nominal: a.nominal, aliquota_efetiva: a.efetiva, das: r2(receitaMes * a.efetiva) };
  }

  function simularCreditos(b2b, consumidor, compras, aliq, das, parcela) {
    for (const [n, v] of [["vendas B2B", b2b], ["vendas ao consumidor", consumidor], ["compras com crédito", compras], ["DAS", das]])
      if (!(v >= 0)) throw new Error(`${n} não pode ser negativo.`);
    if (!(aliq >= 0 && aliq <= 100) || !(parcela >= 0 && parcela <= 100)) throw new Error("Percentuais devem estar entre 0 e 100.");
    const a = aliq / 100, vendas = b2b + consumidor;
    const ibsDas = r2(das * parcela / 100);
    const simples = { imposto_ibs_cbs: ibsDas, credito_para_cliente_b2b: r2(vendas ? ibsDas * (b2b / vendas) : 0), credito_das_compras: 0 };
    const creditoCompras = r2(compras * a);
    const regular = { imposto_ibs_cbs: r2(r2(vendas * a) - creditoCompras), credito_para_cliente_b2b: r2(b2b * a), credito_das_compras: creditoCompras };
    const custoRegular = r2(das - ibsDas + regular.imposto_ibs_cbs);
    return { simples, regular, custo_total_simples: das, custo_total_regular: custoRegular, diferenca: r2(custoRegular - das),
      credito_perdido_pelo_cliente: r2(regular.credito_para_cliente_b2b - simples.credito_para_cliente_b2b), credito_compras_nao_aproveitado: creditoCompras };
  }

  // ---- Simples puro x Simples híbrido (porta de simular_puro_hibrido e projetar_historico) ----
  // Repartição do DAS (LC 123/2006) por faixa: [Cofins, PIS, ICMS ou ISS] em % do DAS.
  const REPARTICAO = {
    I: [[12.74, 2.76, 34.0], [12.74, 2.76, 34.0], [12.74, 2.76, 33.5], [12.74, 2.76, 33.5], [12.74, 2.76, 33.5], [28.27, 6.13, 0.0]],
    II: [[11.51, 2.49, 32.0], [11.51, 2.49, 32.0], [11.51, 2.49, 32.0], [11.51, 2.49, 32.0], [11.51, 2.49, 32.0], [20.96, 4.54, 0.0]],
    III: [[12.82, 2.78, 33.5], [14.05, 3.05, 32.0], [13.64, 2.96, 32.5], [13.64, 2.96, 32.5], [12.82, 2.78, 33.5], [16.03, 3.47, 0.0]],
    IV: [[17.67, 3.83, 44.5], [20.55, 4.45, 40.0], [19.73, 4.27, 40.0], [18.90, 4.10, 40.0], [18.08, 3.92, 40.0], [20.55, 4.45, 0.0]],
    V: [[14.10, 3.05, 14.0], [14.10, 3.05, 17.0], [14.92, 3.23, 19.0], [15.74, 3.41, 21.0], [14.10, 3.05, 23.5], [16.44, 3.56, 0.0]],
  };
  const CONFIG_PADRAO = { anexo: "III", folha12: 0, aliq_cbs: 8.8, aliq_ibs: 17.7, reducao_setor: 0, pct_b2b: 0 };
  function regrasAno(ano) {
    if (ano < 2027) return null;
    if (ano <= 2028) return { reducao_cbs: 0.1, ibs_fixo: 0.1, fracao_ibs: 0 };
    if (ano <= 2032) return { reducao_cbs: 0, ibs_fixo: null, fracao_ibs: (ano - 2028) / 10 };
    return { reducao_cbs: 0, ibs_fixo: null, fracao_ibs: 1 };
  }
  function parcelasDoDas(anexo, faixa, ef) {
    const [cofins, pis, icmsIss] = REPARTICAO[anexo][faixa - 1];
    let pCbs = (cofins + pis) / 100, pIbs = icmsIss / 100;
    if (["III", "IV", "V"].includes(anexo) && ef * pIbs > 0.05) { const novo = 0.05 / ef; pCbs = pCbs * (1 - novo) / (1 - pIbs); pIbs = novo; }
    return [pCbs, pIbs];
  }
  function simularPuroHibrido(anexo, rbt12, receitaMes, ano, compras = 0, aliqCbs = 8.8, aliqIbs = 17.7, reducao = 0, pctB2b = 0, folha12 = 0, saldoCredor = 0) {
    for (const [n, v] of [["A receita do mês", receitaMes], ["As compras com crédito", compras], ["A folha de salários", folha12], ["O saldo credor", saldoCredor]])
      if (!(v >= 0)) throw new Error(`${n} não pode ser negativa.`);
    for (const [n, v] of [["A alíquota da CBS", aliqCbs], ["A alíquota do IBS", aliqIbs], ["A redução do setor", reducao], ["O percentual de vendas B2B", pctB2b]])
      if (!(v >= 0 && v <= 100)) throw new Error(`${n} deve estar entre 0 e 100%.`);
    const base = calcularDas(anexo, rbt12, receitaMes, folha12), das = base.das;
    const [pCbs, pIbs] = parcelasDoDas(base.anexo, base.faixa, base.aliquota_efetiva);
    ano = Math.trunc(ano);
    const regra = regrasAno(ano), b2b = pctB2b / 100;
    const res = { ...base, ano, rbt12, parcela_pis_cofins: pCbs, parcela_icms_iss: pIbs, regra };
    if (!regra) return { ...res, puro: { das, cbs_no_das: 0, ibs_no_das: 0, credito_cliente_b2b: 0, total: das }, hibrido: null, diferenca: null };
    const cbsNoDas = r2(das * pCbs), ibsNoDas = r2(das * pIbs * regra.fracao_ibs);
    const puro = { das, cbs_no_das: cbsNoDas, ibs_no_das: ibsNoDas, credito_cliente_b2b: r2((cbsNoDas + ibsNoDas) * b2b), total: das };
    const cbsCheia = Math.max(0, aliqCbs - regra.reducao_cbs), ibsCheia = regra.ibs_fixo != null ? regra.ibs_fixo : aliqIbs * regra.fracao_ibs;
    const fator = 1 - reducao / 100;
    const cbsVenda = r2(receitaMes * cbsCheia * fator / 100), ibsVenda = r2(receitaMes * ibsCheia * fator / 100);
    const debito = r2(cbsVenda + ibsVenda), credito = r2(compras * (cbsCheia + ibsCheia) / 100), disponivel = r2(credito + saldoCredor);
    const dasH = r2(das - cbsNoDas - ibsNoDas), aPagar = r2(Math.max(0, debito - disponivel));
    const hibrido = { das: dasH, aliq_cbs: cbsCheia * fator, aliq_ibs: ibsCheia * fator, cbs_vendas: cbsVenda, ibs_vendas: ibsVenda, debito,
      credito_compras: credito, saldo_credor_anterior: r2(saldoCredor), ibs_cbs_a_pagar: aPagar, saldo_credor_final: r2(Math.max(0, disponivel - debito)),
      credito_cliente_b2b: r2(receitaMes * b2b * (cbsCheia + ibsCheia) * fator / 100), total: r2(dasH + aPagar) };
    return { ...res, puro, hibrido, diferenca: r2(hibrido.total - puro.total) };
  }
  function mesIdx(mes) {
    const m = /^(\d{4})-(\d{1,2})$/.exec(String(mes)), erro = `Mês inválido: '${mes}'. Use o formato AAAA-MM, por exemplo 2026-11.`;
    if (!m) throw new Error(erro);
    const ano = +m[1], mm = +m[2];
    if (!(ano >= 2000 && ano <= 2100 && mm >= 1 && mm <= 12)) throw new Error(erro);
    return ano * 12 + mm - 1;
  }
  const idxMes = (i) => `${String(Math.floor(i / 12)).padStart(4, "0")}-${String((i % 12) + 1).padStart(2, "0")}`;
  const somarMeses = (mes, n) => idxMes(mesIdx(mes) + n);
  function mesesBaseRbt12(mesRef, rbt12) {
    if (!(rbt12 > 0)) throw new Error("Informe um RBT12 maior que zero.");
    const media = r2(rbt12 / 12);
    const meses = Array.from({ length: 12 }, (_, k) => ({ mes: somarMeses(mesRef, k - 12), receita: media, compras: 0, tipo: "media" }));
    meses[11].receita = r2(rbt12 - media * 11);
    return meses;
  }
  function projetarHistorico(meses, config) {
    const cfg = { ...CONFIG_PADRAO, ...(config || {}) }, porIdx = new Map();
    for (const m of meses) {
      const i = mesIdx(m.mes);
      if (porIdx.has(i)) throw new Error(`Mês repetido no histórico: ${m.mes}.`);
      const receita = Number(m.receita) || 0, compras = Number(m.compras) || 0;
      if (receita < 0 || compras < 0) throw new Error(`Valores negativos em ${m.mes}.`);
      porIdx.set(i, { mes: idxMes(i), tipo: m.tipo || "real", receita, compras });
    }
    const idx = [...porIdx.keys()].sort((a, b) => a - b), inicio = idx.length ? idx[0] : 0, linhas = [];
    let saldo = 0;
    for (const i of idx) {
      const m = porIdx.get(i), linha = { ...m, rbt12: null, situacao: "ok", erro: null, resultado: null };
      const janela = Array.from({ length: 12 }, (_, k) => porIdx.get(i - 12 + k));
      if (janela.some((x) => !x)) {
        linha.situacao = i - 12 < inicio ? "base" : "lacuna";
        if (linha.situacao === "lacuna") linha.erro = "Faltam meses anteriores no histórico para fechar o RBT12.";
        linhas.push(linha); continue;
      }
      let soma = 0;
      for (const x of janela) soma += x.receita;
      linha.rbt12 = r2(soma);
      try {
        const r = simularPuroHibrido(cfg.anexo, linha.rbt12, m.receita, Math.floor(i / 12), m.compras, cfg.aliq_cbs, cfg.aliq_ibs, cfg.reducao_setor, cfg.pct_b2b, cfg.folha12, saldo);
        if (r.hibrido) saldo = r.hibrido.saldo_credor_final;
        linha.resultado = r;
      } catch (e) { linha.situacao = "erro"; linha.erro = e.message; }
      linhas.push(linha);
    }
    return linhas;
  }

  const ATIV_MEI = { comercio: ["Comércio / indústria", 1, "I"], servicos: ["Serviços", 5, "III"], ambos: ["Comércio e serviços", 6, "III"] };
  function dasMei(atividade, sm = 1621) {
    if (!ATIV_MEI[atividade]) throw new Error("Atividade deve ser comércio, serviços ou ambos.");
    return r2(sm * 0.05 + ATIV_MEI[atividade][1]);
  }
  function analisarMei(atividade, meses, faturado, restantes, media, sm = 1621) {
    if (!(meses >= 1 && meses <= 12) || !(restantes >= 0 && restantes <= meses)) throw new Error("Meses inválidos: use de 1 a 12, e meses restantes não pode passar dos meses de atividade no ano.");
    if (!(faturado >= 0) || !(media >= 0)) throw new Error("Valores de faturamento não podem ser negativos.");
    const das = dasMei(atividade, sm), limite = 81000 / 12 * meses, projecao = faturado + media * restantes;
    const excesso = Math.max(0, projecao - limite), perc = excesso / limite;
    const status = excesso === 0 ? "dentro" : perc <= 0.2 ? "ate_20" : "acima_20";
    const folga = Math.max(0, limite - faturado), anexo = ATIV_MEI[atividade][2], nominal = ANEXOS[anexo][1][0][1] / 100;
    const anual = projecao / meses * 12;
    let me = null;
    try { me = r2(anual * aliquotaEfetiva(anexo, Math.max(anual, 1)).efetiva); } catch (e) { me = null; }
    return { das_mensal: das, limite_ano: r2(limite), projecao: r2(projecao), excesso: r2(excesso), excesso_pct: perc, status, uso_pct: faturado / limite,
      folga: r2(folga), maximo_por_mes_restante: restantes ? r2(folga / restantes) : 0, das_complementar_estimado: status === "ate_20" ? r2(excesso * nominal) : null,
      custo_anual_mei: r2(das * 12), custo_anual_microempresa: me };
  }

  const api = { ATIV_MEI, dasMei, analisarMei, norm, tokens, busca, perguntar, relacionados, TEMAS, ANEXOS, aliquotaEfetiva, calcularDas, simularCreditos,
    REPARTICAO, CONFIG_PADRAO, regrasAno, parcelasDoDas, simularPuroHibrido, mesIdx, somarMeses, mesesBaseRbt12, projetarHistorico };
  if (typeof module !== "undefined") module.exports = api; else root.Motor = api;
})(typeof window !== "undefined" ? window : globalThis);
