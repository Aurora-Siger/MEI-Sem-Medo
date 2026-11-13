(function () {
  const M = window.Motor, BASE = window.BASE;
  const $ = (id) => document.getElementById(id);
  const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const pct = (v) => (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
  const num = (id) => parseFloat(String($(id).value).replace(/\./g, "").replace(",", "."));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  $("n-reg").textContent = BASE.length;

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
    S1: ["split", "Ver o split payment na prática"], S2: ["split", "Ver o split payment na prática"] };
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
  function responder(q) {
    const res = M.perguntar(BASE, q);
    msg("eu", esc(q.trim() || "(mensagem vazia)"));
    if (res.status === "ok") return msg("bot", cartao(res.registro));
    let h = `<div class="card"><p>${esc(res.texto)}</p>`;
    if (res.status === "ambigua") h += `<div class="opcoes">${res.opcoes.map((r) => `<button type="button" data-id="${r.id}">${esc(r.titulo)}</button>`).join("")}</div>`;
    if (res.status === "desconhecida") h += `<p>Temas que eu cubro: ${Object.values(M.TEMAS).map(esc).join(", ")}. Veja a aba “Temas” ou use as calculadoras.</p>`;
    msg("bot", h + "</div>");
  }
  msg("bot", `<div class="card"><p>Oi! Sou o assistente do MEI sem Medo. Respondo só com base em fontes verificadas e digo quando não sei. Pergunte sobre MEI, Simples, reforma tributária, split payment, créditos ou vendas. Em várias respostas eu abro a calculadora certa para você.</p></div>`);
  $("form-pergunta").addEventListener("submit", (e) => { e.preventDefault(); responder($("pergunta").value); $("pergunta").value = ""; $("pergunta").focus(); });
  $("limpar").onclick = () => { log.innerHTML = ""; };
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
