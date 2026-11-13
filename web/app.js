(function () {
  const M = window.Motor, BASE = window.BASE;
  const $ = (id) => document.getElementById(id);
  const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const pct = (v) => (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
  const num = (id) => parseFloat(String($(id).value).replace(/\./g, "").replace(",", "."));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  $("n-reg").textContent = BASE.length;
  if (location.protocol.startsWith("http"))
    fetch("/api/status").then((r) => r.json()).then((s) => { agenteAtivo = !!s.agente; $("modo").textContent = s.agente ? "Agente de IA ativo: responde só com a base verificada e as calculadoras" : "Modo base verificada (busca por palavras-chave)"; $("modo").className = "badge " + (s.agente ? "alta" : "confirmar"); }).catch(() => {});

  // ----- abas -----
  document.querySelectorAll("nav button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll("nav button").forEach((x) => x.setAttribute("aria-selected", x === b));
    document.querySelectorAll("[role=tabpanel]").forEach((p) => (p.hidden = p.id !== "tab-" + b.dataset.tab));
  }));
  const abrirAba = (t) => document.querySelector(`nav button[data-tab=${t}]`).click();

  // ----- perguntar -----
  const FERRAMENTA = { A3: ["simples", "Abrir calculadora do DAS"], A4: ["simples", "Abrir calculadora do DAS"], A5: ["simples", "Abrir calculadora do DAS"], A2: ["simples", "Ver tabela dos anexos"],
    K1: ["creditos", "Abrir simulador de créditos"], K2: ["creditos", "Abrir simulador de créditos"], K3: ["creditos", "Abrir simulador de créditos"], K5: ["creditos", "Abrir simulador de créditos"],
    M1: ["mei", "Calcular meu limite e DAS"], M2: ["mei", "Calcular meu limite e DAS"], M6: ["mei", "Calcular meu limite e DAS"], A7: ["mei", "Calcular meu limite e DAS"],
    S1: ["split", "Ver o split payment na prática"], S2: ["split", "Ver o split payment na prática"], R5: ["hibrido", "Simular Simples puro x híbrido"] };
  function cartao(r, extra = "") {
    const f = FERRAMENTA[r.id];
    if (f) extra += `<p><button type="button" class="ferr" data-aba="${f[0]}">${f[1]} →</button></p>`;
    const rel = M.relacionados(BASE, r);
    const aviso = r.confianca === "confirmar" ? `<p class="aviso">⚠ Esta informação pode mudar ou as fontes divergem: confirme em canal oficial.</p>` : "";
    return `<article class="card"><h3>${esc(r.titulo)}</h3>
      <span class="badge ${r.confianca}">${r.confianca === "alta" ? "Confiabilidade alta" : "Confirmar na fonte oficial"}</span>
      <p>${esc(r.resposta)}</p>${aviso}
      <p class="fonte">Fonte: <a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.fonte)}</a> · verificado em ${esc(r.verificado)}</p>
      ${rel.length ? `<div class="rel"><span>Veja também</span>${rel.map((x) => `<button type="button" data-id="${x.id}">${esc(x.titulo)}</button>`).join("")}</div>` : ""}${extra}</article>`;
  }
  const log = $("resposta");
  function msg(cls, html) {
    const d = document.createElement("div"); d.className = "msg " + cls; d.innerHTML = html; log.appendChild(d);
    d.querySelectorAll("[data-id]").forEach((b) => (b.onclick = () => { msg("eu", esc(b.textContent)); msg("bot", cartao(BASE.find((r) => r.id === b.dataset.id))); }));
    d.querySelectorAll("[data-aba]").forEach((b) => (b.onclick = () => abrirAba(b.dataset.aba)));
    d.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function mostrarRegistro(id) { abrirAba("perguntar"); const r = BASE.find((x) => x.id === id); msg("eu", esc(r.titulo)); msg("bot", cartao(r)); }
  // ----- agente de IA (opcional: só existe quando o site é servido por src/servidor.py com ANTHROPIC_API_KEY) -----
  let agenteAtivo = false, sessao = novaSessao();
  function novaSessao() { return (self.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40).padEnd(8, "x"); }
  const ABA_FERRAMENTA = { analisar_mei: ["mei", "Abrir a calculadora do MEI"], calcular_das: ["simples", "Abrir a calculadora do DAS"], simular_creditos: ["creditos", "Abrir o simulador de créditos"] };
  const NOME_FERRAMENTA = { buscar_base: "busca na base", obter_registro: "leitura de registro", listar_temas: "lista de temas", calcular_das: "cálculo do DAS", analisar_mei: "análise do MEI", simular_creditos: "simulação de créditos" };
  function html(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>"); }
  function cartaoAgente(r) {
    const fontes = r.fontes.length ? `<p class="fonte">Fontes:<br>${r.fontes.map((f) => `[${esc(f.id)}] <a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.fonte)}</a> · verificado em ${esc(f.verificado)}`).join("<br>")}</p>` : "";
    const usadas = [...new Set(r.ferramentas)];
    const botoes = usadas.filter((t) => ABA_FERRAMENTA[t]).map((t) => `<button type="button" class="ferr" data-aba="${ABA_FERRAMENTA[t][0]}">${ABA_FERRAMENTA[t][1]} →</button>`).join(" ");
    const meta = usadas.length ? `<p class="fonte">Agente de IA · consultou: ${usadas.map((t) => NOME_FERRAMENTA[t] || t).join(", ")} · ${r.tempo_ms} ms</p>` : "";
    return `<article class="card"><p>${html(r.texto)}</p>${fontes}${botoes ? `<p>${botoes}</p>` : ""}${meta}</article>`;
  }
  async function responderAgente(q) {
    msg("eu", esc(q.trim() || "(mensagem vazia)"));
    if (!q.trim()) return msg("bot", `<div class="card"><p>Você não digitou nada. Pergunte, por exemplo: “qual o limite do MEI?”</p></div>`);
    const espera = document.createElement("div"); espera.className = "msg bot"; espera.innerHTML = `<div class="card"><p>Consultando a base e as calculadoras…</p></div>`; log.appendChild(espera);
    try {
      const r = await fetch("/api/agente", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessao, mensagem: q }) });
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      espera.remove();
      if (d.modo === "erro") { msg("bot", `<div class="card"><p class="aviso">O agente de IA está indisponível agora. Mostrando a busca na base verificada.</p></div>`); return responderBase(q, false); }
      msg("bot", cartaoAgente(d));
    } catch (e) { espera.remove(); responderBase(q, true); }
  }
  function responder(q) { return agenteAtivo ? responderAgente(q) : responderBase(q, true); }
  function responderBase(q, mostrarPergunta) {
    const res = M.perguntar(BASE, q);
    if (mostrarPergunta) msg("eu", esc(q.trim() || "(mensagem vazia)"));
    if (res.status === "ok") return msg("bot", cartao(res.registro));
    let h = `<div class="card"><p>${esc(res.texto)}</p>`;
    if (res.status === "ambigua") h += `<div class="opcoes">${res.opcoes.map((r) => `<button type="button" data-id="${r.id}">${esc(r.titulo)}</button>`).join("")}</div>`;
    if (res.status === "desconhecida") h += `<p>Temas que eu cubro: ${Object.values(M.TEMAS).map(esc).join(", ")}. Veja a aba “Temas” ou use as calculadoras.</p>`;
    msg("bot", h + "</div>");
  }
  msg("bot", `<div class="card"><p>Oi! Sou o assistente do MEI sem Medo. Respondo só com base em fontes verificadas e digo quando não sei. Pergunte sobre MEI, Simples, reforma tributária, split payment, créditos ou vendas. Em várias respostas eu abro a calculadora certa para você.</p></div>`);
  $("form-pergunta").addEventListener("submit", (e) => { e.preventDefault(); responder($("pergunta").value); $("pergunta").value = ""; $("pergunta").focus(); });
  $("limpar").onclick = () => { log.innerHTML = ""; sessao = novaSessao(); };
  ["Qual o limite de faturamento do MEI?", "O que é split payment?", "Qual anexo do Simples eu me encaixo?", "Como recuperar créditos de imposto?", "O cliente pode devolver compra online?"]
    .forEach((q) => { const b = document.createElement("button"); b.type = "button"; b.textContent = q; b.onclick = () => responder(q); $("exemplos").appendChild(b); });

  // ----- temas -----
  $("lista-temas").innerHTML = Object.keys(M.TEMAS).filter((t) => BASE.some((r) => r.tema === t)).map((t) =>
    `<details><summary>${esc(M.TEMAS[t])} (${BASE.filter((r) => r.tema === t).length})</summary>` +
    BASE.filter((r) => r.tema === t).map((r) => `<div class="rel"><button type="button" data-id="${r.id}">${esc(r.titulo)}</button></div>`).join("") + "</details>").join("");
  document.querySelectorAll("#lista-temas [data-id]").forEach((b) => (b.onclick = () => mostrarRegistro(b.dataset.id)));

  // ----- simples -----
  const opts = Object.entries(M.ANEXOS).map(([k, v]) => `<option value="${k}">Anexo ${k} - ${v[0]}</option>`).join("");
  $("anexo-ver").innerHTML = opts; $("das-anexo").innerHTML = opts;
  function tabela() {
    const a = $("anexo-ver").value, f = M.ANEXOS[a][1];
    $("tabela-anexo").innerHTML = "<tr><th>Faixa</th><th>Receita 12 meses até</th><th>Alíquota nominal</th><th>Parcela a deduzir</th></tr>" +
      f.map(([t, n, d], i) => `<tr><td>${i + 1}ª</td><td>${brl(t)}</td><td>${n.toLocaleString("pt-BR")}%</td><td>${brl(d)}</td></tr>`).join("");
  }
  $("anexo-ver").onchange = tabela; tabela();
  const erro = (el, e) => (el.innerHTML = `<p class="erro">${esc(e.message)}</p>`);
  $("form-das").addEventListener("submit", (e) => {
    e.preventDefault();
    try {
      const r = M.calcularDas($("das-anexo").value, num("das-rbt"), num("das-mes"), num("das-folha") || 0);
      $("res-das").innerHTML = `<div class="card"><div class="num">${brl(r.das)}</div><p>DAS estimado no mês. Anexo ${r.anexo}, ${r.faixa}ª faixa, alíquota nominal ${r.aliquota_nominal.toLocaleString("pt-BR")}%, <strong>efetiva ${pct(r.aliquota_efetiva)}</strong>.</p>
        ${r.anexo !== $("das-anexo").value ? "<p>Com Fator R ≥ 28%, a atividade foi calculada no Anexo III.</p>" : ""}
        <p class="fonte">Fórmula: (RBT12 × alíquota nominal − parcela a deduzir) ÷ RBT12. Estimativa: confirme no PGDAS-D ou com seu contador.</p></div>`;
    } catch (err) { erro($("res-das"), err); }
  });

  // ----- MEI -----
  $("form-mei").addEventListener("submit", (e) => {
    e.preventDefault();
    try {
      const r = M.analisarMei($("m-ativ").value, num("m-meses"), num("m-fat"), num("m-rest"), num("m-media"), num("m-sm"));
      const msg = { dentro: `<p>✅ Pela sua previsão você termina o ano <strong>dentro do limite</strong>. Para ficar seguro, não passe de <strong>${brl(r.maximo_por_mes_restante)} por mês</strong> nos meses que faltam.</p>`,
        ate_20: `<p class="aviso">⚠ Você passaria do limite em <strong>${brl(r.excesso)}</strong> (${pct(r.excesso_pct)}). Até 20% de excesso, segue no MEI até dezembro, paga um DAS complementar (estimado em <strong>${brl(r.das_complementar_estimado)}</strong>) e vira microempresa no ano seguinte. Confirme o cálculo no Portal do Empreendedor.</p>`,
        acima_20: `<p class="aviso">⛔ O excesso seria de <strong>${brl(r.excesso)}</strong> (${pct(r.excesso_pct)}), acima de 20%. Nesse caso o desenquadramento vale desde janeiro (ou desde a abertura) e os impostos de microempresa são cobrados retroativamente. Converse com um contador antes de chegar lá.</p>` }[r.status];
      $("res-mei").innerHTML = `<div class="card"><div class="num">${brl(r.das_mensal)}<small> de DAS por mês</small></div>
        <p>Limite deste ano: <strong>${brl(r.limite_ano)}</strong> · usado até agora: <strong>${pct(r.uso_pct)}</strong></p>
        <div class="uso ${r.status}" role="img" aria-label="${pct(Math.min(r.uso_pct, 1))} do limite usado"><div style="width:${Math.min(r.uso_pct, 1) * 100}%"></div></div>
        <p>Projeção do ano: <strong>${brl(r.projecao)}</strong></p>${msg}</div>
        <div class="card"><h3>E se eu virar microempresa?</h3>
        <p>MEI: ${brl(r.custo_anual_mei)} de DAS por ano. Microempresa no Simples (Anexo ${M.ATIV_MEI[$("m-ativ").value][2]}), com essa receita: ${r.custo_anual_microempresa == null ? "fora do limite do Simples" : `cerca de <strong>${brl(r.custo_anual_microempresa)}</strong> por ano`}.</p>
        <p class="fonte">Estimativa só do DAS, sem contador, pró-labore ou outros custos. Caminhoneiro MEI tem outra regra de INSS (12%), não coberta aqui.</p></div>`;
    } catch (err) { erro($("res-mei"), err); }
  });

  // ----- Simples puro x híbrido + histórico do RBT12 (salvo só neste navegador, em localStorage) -----
  const CHAVE = "mei-sem-medo:historicos:v1";
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const TIPOS = { real: "Real", previsao: "Previsão", media: "Média" };
  const ANEXOS_ABA = ["III", "V"]; // nesta aba a empresa é de serviços: Anexo III ou V (Fator R)
  const rotMes = (m) => MESES[+m.slice(5) - 1] + "/" + m.slice(0, 4);
  const parseBR = (s) => { const t = String(s).trim(); return t ? parseFloat(t.replace(/\./g, "").replace(",", ".")) : NaN; };
  const fmtIn = (v) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  const novoHistorico = (nome) => ({ id: "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), nome, config: { ...M.CONFIG_PADRAO }, meses: [] });
  // valida e limpa um histórico (salvo ou importado); lança erro com mensagem amigável se não servir
  function normalizar(obj) {
    if (!obj || typeof obj !== "object" || !Array.isArray(obj.meses)) throw new Error("o arquivo não é um histórico do MEI sem Medo.");
    const config = { ...M.CONFIG_PADRAO };
    for (const k of Object.keys(config)) {
      const v = obj.config ? obj.config[k] : undefined;
      if (k === "anexo") { if (ANEXOS_ABA.includes(v)) config.anexo = v; } else if (Number.isFinite(Number(v)) && v !== null && v !== "") config[k] = Number(v);
    }
    const meses = obj.meses.map((m) => ({ mes: M.somarMeses(m.mes, 0), receita: Number(m.receita) || 0, compras: Number(m.compras) || 0, tipo: TIPOS[m.tipo] ? m.tipo : "real" }))
      .sort((a, b) => M.mesIdx(a.mes) - M.mesIdx(b.mes));
    M.projetarHistorico(meses, config); // recusa mês repetido e valores negativos
    return { ...novoHistorico(String(obj.nome || "Histórico importado").slice(0, 60)), config, meses };
  }
  function carregarEstado() {
    try {
      const s = JSON.parse(localStorage.getItem(CHAVE));
      const lista = (s && Array.isArray(s.lista) ? s.lista : []).map((h) => { try { return { ...normalizar(h), id: String(h.id) }; } catch (e) { return null; } }).filter(Boolean);
      if (lista.length) return { ativo: lista.some((h) => h.id === s.ativo) ? s.ativo : lista[0].id, lista };
    } catch (e) { /* sem acesso ao armazenamento: segue só na memória */ }
    const h = novoHistorico("Minha empresa");
    return { ativo: h.id, lista: [h] };
  }
  let estado = carregarEstado(), detalheMes = null;
  const atual = () => estado.lista.find((h) => h.id === estado.ativo) || estado.lista[0];
  function salvar() {
    let ok = true;
    try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (e) { ok = false; }
    $("h-status").innerHTML = ok ? "Salvo automaticamente <strong>só neste navegador</strong> (nada é enviado a servidor). Use Exportar para guardar uma cópia ou levar para outro aparelho."
      : `<span class="erro">Não foi possível salvar neste navegador (modo privado?). Use Exportar para não perder os dados.</span>`;
  }

  $("h-anexo").innerHTML = ANEXOS_ABA.map((k) => `<option value="${k}">Anexo ${k} - ${M.ANEXOS[k][0]}</option>`).join("");
  $("hs-ano").innerHTML = [2027, 2028, 2029, 2030, 2031, 2032, 2033].map((a) => `<option>${a}</option>`).join("");
  function preencherEmpresa() {
    const c = atual().config;
    $("h-anexo").value = c.anexo; $("h-folha").value = fmtIn(c.folha12); $("h-cbs").value = fmtIn(c.aliq_cbs);
    $("h-ibs").value = fmtIn(c.aliq_ibs); $("h-b2b").value = fmtIn(c.pct_b2b);
    if (![...$("h-red").options].some((o) => +o.value === c.reducao_setor)) $("h-red").insertAdjacentHTML("beforeend", `<option value="${c.reducao_setor}">${fmtIn(c.reducao_setor)}%</option>`);
    $("h-red").value = String(c.reducao_setor);
    $("h-empresa-erro").innerHTML = "";
  }
  function lerEmpresa() {
    const c = { anexo: $("h-anexo").value, folha12: $("h-folha").value.trim() ? parseBR($("h-folha").value) : 0, aliq_cbs: parseBR($("h-cbs").value),
      aliq_ibs: parseBR($("h-ibs").value), reducao_setor: +$("h-red").value, pct_b2b: $("h-b2b").value.trim() ? parseBR($("h-b2b").value) : 0 };
    if (!(c.folha12 >= 0)) throw new Error("Folha de salários: informe um valor em reais, por exemplo 90000 ou 90.000,00.");
    for (const [n, v] of [["Alíquota da CBS", c.aliq_cbs], ["Alíquota do IBS", c.aliq_ibs], ["Vendas para empresas", c.pct_b2b]])
      if (!(v >= 0 && v <= 100)) throw new Error(`${n}: informe um percentual entre 0 e 100.`);
    return c;
  }

  function textoRegra(r) {
    if (!r.regra) return `Em ${r.ano} ainda não existem CBS e IBS: só o Simples de hoje, sem a opção híbrida.`;
    if (r.ano <= 2028) return `${r.ano}: CBS cheia (menos 0,1 ponto) e IBS de teste de 0,1%; ICMS/ISS continuam dentro do DAS nos dois regimes.`;
    if (r.ano <= 2032) return `${r.ano}: transição, ${pct(r.regra.fracao_ibs)} do ICMS/ISS já virou IBS e o restante continua no DAS.`;
    return `${r.ano}: regra final, ICMS e ISS deixam de existir e IBS e CBS valem por inteiro.`;
  }
  function cartaoPuroHibrido(r, titulo = "") {
    const cab = `Anexo ${r.anexo}, ${r.faixa}ª faixa, alíquota efetiva ${pct(r.aliquota_efetiva)} (RBT12 de ${brl(r.rbt12)}).`;
    const faixa6 = r.faixa === 6 ? " Acima de R$ 3,6 milhões o ICMS/ISS é pago fora do Simples e não entra nesta conta." : "";
    if (!r.hibrido) return `<div class="card">${titulo}<div class="num">${brl(r.puro.das)}<small> de DAS</small></div><p>${cab}</p><p>${textoRegra(r)}</p></div>`;
    const p = r.puro, h = r.hibrido, nada = "—", l = (n, a, b) => `<tr><td>${n}</td><td>${a}</td><td>${b}</td></tr>`;
    const veredito = r.diferenca > 0 ? `Neste mês o <strong>Simples puro</strong> sai <strong>${brl(r.diferenca)}</strong> mais barato.`
      : r.diferenca < 0 ? `Neste mês o <strong>Simples híbrido</strong> sai <strong>${brl(-r.diferenca)}</strong> mais barato.` : "Neste mês os dois custam o mesmo.";
    return `<div class="card">${titulo}
      <div class="cmp"><div><span class="fonte">Simples puro</span><div class="num">${brl(p.total)}</div><span class="fonte">só o DAS</span></div>
        <div><span class="fonte">Simples híbrido</span><div class="num">${brl(h.total)}</div><span class="fonte">DAS ${brl(h.das)} + IBS/CBS ${brl(h.ibs_cbs_a_pagar)}</span></div></div>
      <p>${veredito}</p>
      <div class="tabela-wrap"><table><tr><th></th><th>Puro</th><th>Híbrido</th></tr>
        ${l("Guia do Simples (DAS)", brl(p.das), brl(h.das))}
        ${l("· dentro do DAS: CBS (no lugar de PIS/Cofins)", brl(p.cbs_no_das), "sai do DAS")}
        ${r.regra.fracao_ibs ? l("· dentro do DAS: IBS (no lugar de ICMS/ISS)", brl(p.ibs_no_das), "sai do DAS") : ""}
        ${l(`CBS sobre as vendas (${pct(h.aliq_cbs / 100)})`, nada, brl(h.cbs_vendas))}
        ${l(`IBS sobre as vendas (${pct(h.aliq_ibs / 100)})`, nada, brl(h.ibs_vendas))}
        ${l("(−) Crédito das compras", nada, "− " + brl(h.credito_compras))}
        ${h.saldo_credor_anterior ? l("(−) Crédito que sobrou de meses anteriores", nada, "− " + brl(h.saldo_credor_anterior)) : ""}
        ${l("IBS/CBS a pagar à parte", nada, brl(h.ibs_cbs_a_pagar))}
        ${l("<strong>Total no mês</strong>", `<strong>${brl(p.total)}</strong>`, `<strong>${brl(h.total)}</strong>`)}
        ${l("Crédito que seus clientes empresa recebem", brl(p.credito_cliente_b2b), brl(h.credito_cliente_b2b))}
      </table></div>
      ${h.saldo_credor_final ? `<p>Sobram <strong>${brl(h.saldo_credor_final)}</strong> de crédito para abater nos próximos meses.</p>` : ""}
      <p class="fonte">${cab} Dentro do DAS, PIS+Cofins = ${pct(r.parcela_pis_cofins)} e ICMS/ISS = ${pct(r.parcela_icms_iss)} (repartição da LC 123). ${textoRegra(r)} O crédito das compras usa a alíquota cheia, sem a redução do setor.${faixa6}</p></div>`;
  }

  // simulação de um mês
  function simularUm() {
    try {
      const c = lerEmpresa();
      const r = M.simularPuroHibrido(c.anexo, num("hs-rbt"), num("hs-mes"), +$("hs-ano").value, $("hs-compras").value.trim() ? num("hs-compras") : 0,
        c.aliq_cbs, c.aliq_ibs, c.reducao_setor, c.pct_b2b, c.folha12);
      $("res-hib").innerHTML = cartaoPuroHibrido(r);
    } catch (err) { erro($("res-hib"), err); }
  }
  // tabela de alíquotas do anexo escolhido (III ou V), destacando a faixa do RBT12 digitado
  function tabelaAliquotas() {
    const c = atual().config, rbt = num("hs-rbt"), temRbt = rbt > 0;
    let anexo = c.anexo, nota = "";
    if (anexo === "V" && temRbt && c.folha12 > 0) {
      const fr = c.folha12 / rbt;
      if (fr >= 0.28) { anexo = "III"; nota = `<p class="aviso">Fator R de ${pct(fr)} (folha ÷ RBT12, 28% ou mais): mesmo escolhendo o Anexo V, a empresa é tributada pelo <strong>Anexo III</strong>, que é a tabela abaixo.</p>`; }
      else nota = `<p>Fator R de ${pct(fr)} (folha ÷ RBT12, abaixo de 28%): a empresa fica no Anexo V.</p>`;
    } else if (anexo === "V") nota = `<p class="fonte">Informe a folha + pró-labore em Dados da empresa para calcular o Fator R. Com 28% ou mais, a empresa passa para o Anexo III.</p>`;
    const faixas = M.ANEXOS[anexo][1];
    let a = null;
    if (temRbt) try { a = M.aliquotaEfetiva(anexo, rbt); } catch (e) { a = null; }
    const linhas = faixas.map(([teto, nominal, deduzir], i) => {
      const sua = a && a.faixa === i + 1, receita = i ? `De ${brl(faixas[i - 1][0] + 0.01)} a ${brl(teto)}` : `Até ${brl(teto)}`;
      return `<tr${sua ? ' class="atual"' : ""}><td>${i + 1}ª${sua ? " <strong>← sua faixa</strong>" : ""}</td><td>${receita}</td><td>${nominal.toLocaleString("pt-BR")}%</td><td>${brl(deduzir)}</td></tr>`;
    }).join("");
    const conta = a ? `<p>Seu RBT12 de <strong>${brl(rbt)}</strong> está na <strong>${a.faixa}ª faixa</strong>. Alíquota efetiva = (${brl(rbt)} × ${a.nominal.toLocaleString("pt-BR")}% − ${brl(faixas[a.faixa - 1][2])}) ÷ ${brl(rbt)} = <strong>${pct(a.efetiva)}</strong>.</p>`
      : rbt > 4800000 ? `<p class="aviso">RBT12 acima de R$ 4,8 milhões: fora do limite do Simples Nacional.</p>`
      : `<p class="fonte">Digite o RBT12 acima para ver em qual faixa a empresa está.</p>`;
    $("hs-tabela").innerHTML = `<div class="card"><h3>Tabela do Anexo ${anexo}: ${esc(M.ANEXOS[anexo][0])}</h3>${nota}
      <div class="tabela-wrap"><table class="aliq"><tr><th>Faixa</th><th>Receita bruta em 12 meses (RBT12)</th><th>Alíquota nominal</th><th>Valor a deduzir</th></tr>${linhas}</table></div>
      ${conta}<p class="fonte">LC 123/2006. A alíquota efetiva é a que de fato incide sobre a receita do mês.</p></div>`;
  }
  $("hs-rbt").addEventListener("input", tabelaAliquotas);
  $("form-hib").addEventListener("submit", (e) => { e.preventDefault(); simularUm(); });
  $("form-empresa").addEventListener("submit", (e) => e.preventDefault());
  $("form-empresa").addEventListener("change", () => {
    try { atual().config = lerEmpresa(); $("h-empresa-erro").innerHTML = ""; salvar(); atualizarCalculos(); tabelaAliquotas(); if ($("res-hib").innerHTML) simularUm(); }
    catch (err) { erro($("h-empresa-erro"), err); }
  });

  // histórico mês a mês
  const somaUltimos12 = (ms, ate) => { // soma dos 12 meses que terminam no índice 'ate' (null se faltar mês)
    if (ate < 11 || M.mesIdx(ms[ate].mes) - M.mesIdx(ms[ate - 11].mes) !== 11) return null;
    let s = 0; for (let k = ate - 11; k <= ate; k++) s += ms[k].receita; return Math.round(s * 100) / 100;
  };
  function desenharTabela() {
    const h = atual(), vazio = !h.meses.length;
    $("h-inicio").hidden = !vazio; $("h-acoes").hidden = vazio; $("h-erro").innerHTML = "";
    if (vazio) { $("h-tabela").innerHTML = $("h-resumo").innerHTML = $("h-detalhe").innerHTML = ""; $("hs-usar").hidden = true; return; }
    const sel = (k, t) => `<select data-i="${k}" data-campo="tipo" aria-label="Situação de ${rotMes(h.meses[k].mes)}">${Object.entries(TIPOS).map(([v, n]) => `<option value="${v}"${v === t ? " selected" : ""}>${n}</option>`).join("")}</select>`;
    const inp = (k, campo, rot) => `<input data-i="${k}" data-campo="${campo}" inputmode="decimal" aria-label="${rot} de ${rotMes(h.meses[k].mes)}" value="${fmtIn(h.meses[k][campo])}">`;
    $("h-tabela").innerHTML = `<table class="hist"><thead><tr><th>Mês</th><th>Situação</th><th>Receita, R$</th><th>Compras c/ crédito, R$</th><th>RBT12</th><th>Alíq. efetiva</th>
      <th>Puro: DAS</th><th>Híbrido: DAS</th><th>Híbrido: IBS/CBS</th><th>Híbrido: total</th><th>Diferença<br><small>(híbrido − puro)</small></th></tr></thead><tbody>` +
      h.meses.map((m, k) => `<tr data-i="${k}"><th scope="row"><button type="button" class="link" data-det="${k}" title="Ver o detalhe do mês">${rotMes(m.mes)}</button></th>
        <td>${sel(k, m.tipo)}</td><td>${inp(k, "receita", "Receita")}</td><td>${inp(k, "compras", "Compras com crédito")}</td>
        <td class="c-rbt"></td><td class="c-ef"></td><td class="c-puro"></td><td class="c-hdas"></td><td class="c-hiva"></td><td class="c-htot"></td><td class="c-dif"></td></tr>`).join("") +
      "</tbody></table>";
    atualizarCalculos();
  }
  function atualizarCalculos() {
    const h = atual();
    if (!h.meses.length) return;
    let linhas;
    try { linhas = M.projetarHistorico(h.meses, h.config); } catch (e) { erro($("h-erro"), e); return; }
    linhas.forEach((ln, k) => {
      const tr = $("h-tabela").querySelector(`tr[data-i="${k}"]`), r = ln.resultado, cel = (c, v) => (tr.querySelector(c).innerHTML = v);
      if (!tr) return;
      tr.className = ln.situacao;
      if (!r) {
        cel(".c-rbt", ln.rbt12 == null ? `<span class="fonte">base do RBT12</span>` : brl(ln.rbt12));
        cel(".c-ef", ln.erro ? `<span class="pos">${esc(ln.erro)}</span>` : "");
        [".c-puro", ".c-hdas", ".c-hiva", ".c-htot", ".c-dif"].forEach((c) => cel(c, ""));
        return;
      }
      cel(".c-rbt", brl(ln.rbt12)); cel(".c-ef", pct(r.aliquota_efetiva)); cel(".c-puro", brl(r.puro.total));
      if (!r.hibrido) { cel(".c-hdas", `<span class="fonte" title="O híbrido só existe a partir de 2027">—</span>`); [".c-hiva", ".c-htot", ".c-dif"].forEach((c) => cel(c, "")); return; }
      cel(".c-hdas", brl(r.hibrido.das)); cel(".c-hiva", brl(r.hibrido.ibs_cbs_a_pagar)); cel(".c-htot", `<strong>${brl(r.hibrido.total)}</strong>`);
      cel(".c-dif", `<span class="${r.diferenca > 0 ? "pos" : r.diferenca < 0 ? "neg" : ""}">${r.diferenca > 0 ? "+" : ""}${brl(r.diferenca)}</span>`);
    });
    resumo(linhas);
    if (detalheMes != null) mostrarDetalhe(detalheMes, linhas);
  }
  function resumo(linhas) {
    const h = atual(), ms = h.meses, prox = M.somarMeses(ms[ms.length - 1].mes, 1);
    let ultReal = -1;
    ms.forEach((m, k) => { if (m.tipo !== "previsao") ultReal = k; });
    const rbtReal = ultReal >= 0 ? somaUltimos12(ms, ultReal) : null, rbtFim = somaUltimos12(ms, ms.length - 1);
    const comH = linhas.filter((l) => l.resultado && l.resultado.hibrido), soPuro = linhas.filter((l) => l.resultado && !l.resultado.hibrido);
    const soma = (arr, f) => Math.round(arr.reduce((s, l) => s + f(l.resultado), 0) * 100) / 100;
    let html = `<div class="card"><h3>Resumo de “${esc(h.nome)}”</h3>`;
    if (rbtReal != null) {
      const mesReal = M.somarMeses(ms[ultReal].mes, 1);
      html += `<p>RBT12 real atual (para o DAS de ${rotMes(mesReal)}): <strong>${brl(rbtReal)}</strong>${ms.slice(Math.max(0, ultReal - 11), ultReal + 1).some((m) => m.tipo === "media") ? " <small>(inclui meses pela média)</small>" : ""}</p>`;
      $("hs-usar").hidden = false; $("hs-usar").textContent = `Usar o RBT12 real atual do histórico (${brl(rbtReal)})`; $("hs-usar").dataset.valor = rbtReal;
    } else $("hs-usar").hidden = true;
    if (rbtFim != null && ultReal < ms.length - 1) html += `<p>RBT12 projetado (para o DAS de ${rotMes(prox)}): <strong>${brl(rbtFim)}</strong></p>`;
    if (soPuro.length) html += `<p>Antes de 2027 (${soPuro.length} ${soPuro.length > 1 ? "meses" : "mês"}): DAS de <strong>${brl(soma(soPuro, (r) => r.puro.total))}</strong>, só no Simples atual.</p>`;
    if (comH.length) {
      const tp = soma(comH, (r) => r.puro.total), th = soma(comH, (r) => r.hibrido.total), dif = Math.round((th - tp) * 100) / 100;
      const per = `${rotMes(comH[0].mes)} a ${rotMes(comH[comH.length - 1].mes)}`;
      html += `<div class="tabela-wrap"><table><tr><th>${per} (${comH.length} ${comH.length > 1 ? "meses" : "mês"})</th><th>Puro</th><th>Híbrido</th></tr>
        <tr><td>Total pago</td><td><strong>${brl(tp)}</strong></td><td><strong>${brl(th)}</strong></td></tr>
        <tr><td>Crédito para clientes empresa</td><td>${brl(soma(comH, (r) => r.puro.credito_cliente_b2b))}</td><td>${brl(soma(comH, (r) => r.hibrido.credito_cliente_b2b))}</td></tr></table></div>
        <p>${dif > 0 ? `No período, o <strong>puro</strong> sai <strong>${brl(dif)}</strong> mais barato.` : dif < 0 ? `No período, o <strong>híbrido</strong> sai <strong>${brl(-dif)}</strong> mais barato.` : "No período, os dois custam o mesmo."}
        ${comH[comH.length - 1].resultado.hibrido.saldo_credor_final ? ` No híbrido sobram ${brl(comH[comH.length - 1].resultado.hibrido.saldo_credor_final)} de crédito no fim.` : ""}</p>`;
    } else html += `<p class="fonte">A comparação com o híbrido aparece nos meses a partir de jan/2027.</p>`;
    if (linhas.some((l) => l.rbt12 > 3600000)) html += `<p class="aviso">Em algum mês o RBT12 passa de R$ 3,6 milhões: acima desse sublimite o ICMS/ISS sai do DAS e é pago à parte, o que esta simulação não detalha.</p>`;
    $("h-resumo").innerHTML = html + `<p class="fonte">Clique no nome de um mês para ver o cálculo detalhado. Previsão = valor estimado; Média = mês preenchido com RBT12 ÷ 12. Ao digitar a receita real de um mês “Média”, ele passa para “Real”.</p></div>`;
  }
  function mostrarDetalhe(k, linhas) {
    const ln = (linhas || M.projetarHistorico(atual().meses, atual().config))[k];
    if (!ln) { detalheMes = null; $("h-detalhe").innerHTML = ""; return; }
    detalheMes = k;
    const tit = `<h3>Detalhe de ${rotMes(ln.mes)} (${TIPOS[ln.tipo].toLowerCase()})</h3>`;
    $("h-detalhe").innerHTML = ln.resultado ? cartaoPuroHibrido(ln.resultado, tit)
      : `<div class="card">${tit}<p>${ln.erro ? esc(ln.erro) : "Este mês serve de base para o RBT12 dos meses seguintes: não há 12 meses anteriores a ele no histórico para calcular o DAS."}</p></div>`;
  }
  $("h-tabela").addEventListener("click", (e) => {
    const b = e.target.closest("[data-det]");
    if (b) { mostrarDetalhe(+b.dataset.det); $("h-detalhe").scrollIntoView({ behavior: "smooth", block: "nearest" }); }
  });
  $("h-tabela").addEventListener("change", (e) => {
    const el = e.target, campo = el.dataset.campo;
    if (!campo) return;
    const m = atual().meses[+el.dataset.i];
    if (campo === "tipo") m.tipo = el.value;
    else {
      const v = el.value.trim() ? parseBR(el.value) : 0;
      if (!(v >= 0)) { el.setAttribute("aria-invalid", "true"); erro($("h-erro"), new Error(`Valor inválido em ${rotMes(m.mes)}: use números, por exemplo 30000 ou 30.000,50.`)); return; }
      el.removeAttribute("aria-invalid"); $("h-erro").innerHTML = "";
      m[campo] = v; el.value = fmtIn(v);
      if (campo === "receita" && m.tipo === "media") { m.tipo = "real"; el.closest("tr").querySelector("[data-campo=tipo]").value = "real"; }
    }
    salvar(); atualizarCalculos();
  });
  function adicionarMes() {
    const ms = atual().meses, u = ms[ms.length - 1];
    ms.push({ mes: M.somarMeses(u.mes, 1), receita: u.receita, compras: u.compras, tipo: "previsao" });
    salvar(); desenharTabela();
    const novo = $("h-tabela").querySelector(`input[data-i="${ms.length - 1}"][data-campo=receita]`);
    if (novo) { novo.focus(); novo.select(); }
  }
  $("h-add").onclick = adicionarMes;
  $("h-rem").onclick = () => { const ms = atual().meses; if (ms.length) ms.pop(); if (detalheMes >= ms.length) detalheMes = null; salvar(); desenharTabela(); };
  $("h-limpar").onclick = () => { if (confirm(`Apagar todos os meses de “${atual().nome}”? Os dados da empresa continuam.`)) { atual().meses = []; detalheMes = null; salvar(); desenharTabela(); } };
  $("hs-usar").onclick = () => { $("hs-rbt").value = fmtIn(+$("hs-usar").dataset.valor); tabelaAliquotas(); simularUm(); $("hs-rbt").focus(); };

  // ponto de partida
  const hoje = new Date();
  $("hi-mes").value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  $("hi-modo").onchange = () => ($("hi-rbt-wrap").hidden = $("hi-modo").value !== "total");
  $("form-inicio").addEventListener("submit", (e) => {
    e.preventDefault();
    try {
      const mes = M.somarMeses($("hi-mes").value.trim(), 0), h = atual();
      h.meses = $("hi-modo").value === "total" ? M.mesesBaseRbt12(mes, num("hi-rbt"))
        : Array.from({ length: 12 }, (_, k) => ({ mes: M.somarMeses(mes, k - 12), receita: 0, compras: 0, tipo: "real" }));
      adicionarMes();
      if ($("hi-modo").value === "meses") { const p = $("h-tabela").querySelector('input[data-i="0"][data-campo=receita]'); if (p) { p.focus(); p.select(); } }
    } catch (err) { erro($("h-erro"), err); }
  });

  // vários históricos
  function trocarHistorico() {
    $("h-sel").innerHTML = estado.lista.map((h) => `<option value="${h.id}"${h.id === estado.ativo ? " selected" : ""}>${esc(h.nome)}</option>`).join("");
    detalheMes = null; $("h-detalhe").innerHTML = ""; $("res-hib").innerHTML = "";
    preencherEmpresa(); tabelaAliquotas(); desenharTabela();
  }
  const nomeLivre = (nome) => { let n = nome, i = 2; while (estado.lista.some((h) => h.nome === n)) n = `${nome} (${i++})`; return n; };
  $("h-sel").onchange = () => { estado.ativo = $("h-sel").value; salvar(); trocarHistorico(); };
  $("h-novo").onclick = () => {
    const nome = (prompt("Nome do novo histórico (empresa ou cenário):", `Cenário ${estado.lista.length + 1}`) || "").trim().slice(0, 60);
    if (!nome) return;
    const h = novoHistorico(nomeLivre(nome));
    h.config = { ...atual().config };
    estado.lista.push(h); estado.ativo = h.id; salvar(); trocarHistorico();
  };
  $("h-renomear").onclick = () => {
    const nome = (prompt("Novo nome:", atual().nome) || "").trim().slice(0, 60);
    if (nome && nome !== atual().nome) { atual().nome = nomeLivre(nome); salvar(); trocarHistorico(); }
  };
  $("h-excluir").onclick = () => {
    if (!confirm(`Excluir o histórico “${atual().nome}”? Isso não pode ser desfeito (exporte antes se quiser guardar).`)) return;
    estado.lista = estado.lista.filter((h) => h.id !== estado.ativo);
    if (!estado.lista.length) estado.lista.push(novoHistorico("Minha empresa"));
    estado.ativo = estado.lista[0].id; salvar(); trocarHistorico();
  };
  $("h-exportar").onclick = () => {
    const h = atual(), dados = { formato: "mei-sem-medo/historico", versao: 1, nome: h.nome, exportado_em: new Date().toISOString().slice(0, 10), config: h.config, meses: h.meses };
    const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `historico-${M.norm(h.nome).trim().replace(/\s+/g, "-") || "mei"}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $("h-importar-btn").onclick = () => $("h-importar").click();
  $("h-importar").onchange = () => {
    const f = $("h-importar").files[0];
    if (!f) return;
    f.text().then((t) => {
      const h = normalizar(JSON.parse(t));
      h.nome = nomeLivre(h.nome); estado.lista.push(h); estado.ativo = h.id; salvar(); trocarHistorico();
      $("h-status").textContent = `Histórico “${h.nome}” importado com ${h.meses.length} meses.`;
    }).catch((e) => { $("h-status").innerHTML = `<span class="erro">Não consegui importar: ${esc(e instanceof SyntaxError ? "o arquivo não é um JSON válido." : e.message)}</span>`; })
      .finally(() => { $("h-importar").value = ""; });
  };
  salvar(); trocarHistorico();

  // ----- créditos -----
  $("form-cred").addEventListener("submit", (e) => {
    e.preventDefault();
    try {
      const r = M.simularCreditos(num("c-b2b"), num("c-cons"), num("c-compras"), num("c-aliq"), num("c-das"), num("c-parcela"));
      const linha = (n, a, b) => `<tr><td>${n}</td><td>${brl(a)}</td><td>${brl(b)}</td></tr>`;
      $("res-cred").innerHTML = `<div class="card tabela-wrap"><table><tr><th></th><th>Ficar no Simples</th><th>IBS/CBS no regime regular</th></tr>
        ${linha("IBS/CBS a pagar no mês", r.simples.imposto_ibs_cbs, r.regular.imposto_ibs_cbs)}
        ${linha("Crédito que seus clientes B2B recebem", r.simples.credito_para_cliente_b2b, r.regular.credito_para_cliente_b2b)}
        ${linha("Crédito das suas compras aproveitado", r.simples.credito_das_compras, r.regular.credito_das_compras)}
        ${linha("Custo total de tributos (DAS ajustado + IBS/CBS)", r.custo_total_simples, r.custo_total_regular)}</table></div>
        <div class="card"><h3>Como ler</h3>
        <p>No Simples, seus clientes empresas deixam de aproveitar <strong>${brl(r.credito_perdido_pelo_cliente)}</strong> por mês de crédito em relação ao regime regular, e você deixa de recuperar <strong>${brl(r.credito_compras_nao_aproveitado)}</strong> de crédito das suas compras.</p>
        <p>${r.diferenca > 0 ? `Pelos números informados, o regime regular custaria <strong>${brl(r.diferenca)}</strong> a mais por mês. Ele só tende a compensar se o crédito que seus clientes recebem fizer você ganhar vendas ou permitir preço maior.` : `Pelos números informados, o regime regular custaria <strong>${brl(-r.diferenca)}</strong> a menos por mês.`}</p>
        <p class="aviso">Simulação didática só de IBS/CBS, sem IRPJ, CPP, ISS/ICMS residual nem transição (2026–2033). Alíquota e parcela do DAS são estimativas suas. Valide com um contador.</p></div>`;
    } catch (err) { erro($("res-cred"), err); }
  });

  // ----- split -----
  function split() {
    const v = num("s-valor"), p = num("s-pct");
    if (!(v > 0) || !(p >= 0 && p <= 100)) { $("res-split").innerHTML = `<p class="erro">Informe um valor maior que zero e um percentual entre 0 e 100.</p>`; return; }
    const imp = Math.round(v * p) / 100, liq = v - imp;
    $("res-split").innerHTML = `<div class="barra" role="img" aria-label="Do valor de ${brl(v)}, ${brl(imp)} vão ao governo e ${brl(liq)} ao vendedor">
      <div class="b-gov" style="width:${p}%">${p >= 12 ? brl(imp) : ""}</div><div class="b-ven" style="width:${100 - p}%">${brl(liq)}</div></div>
      <p>Cliente paga <strong>${brl(v)}</strong>. <strong>${brl(imp)}</strong> (laranja) vão direto ao governo e <strong>${brl(liq)}</strong> (verde) chegam ao vendedor.</p>`;
  }
  $("form-split").addEventListener("input", split); $("form-split").addEventListener("submit", (e) => e.preventDefault()); split();
})();
