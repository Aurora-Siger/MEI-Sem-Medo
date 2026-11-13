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

  const api = { norm, tokens, busca, perguntar, relacionados, TEMAS, ANEXOS, aliquotaEfetiva, calcularDas, simularCreditos };
  if (typeof module !== "undefined") module.exports = api; else root.Motor = api;
})(typeof window !== "undefined" ? window : globalThis);
