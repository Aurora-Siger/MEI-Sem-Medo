(async function () {
  const $ = (id) => document.getElementById(id);
  // Toda a lógica (busca, calculadoras, checklist) roda em Python, no src/servidor.py.
  // py("nome_da_funcao", ...args) chama a função Python e devolve o resultado (ou lança o erro em português).
  async function py(funcao, ...args) {
    let r;
    try { r = await fetch("/api/motor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ funcao, args }) }); }
    catch (e) { throw new Error("Sem conexão com o servidor. Rode python src/servidor.py e abra http://127.0.0.1:8000."); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.erro || "O servidor não conseguiu calcular.");
    return d.resultado;
  }
  let D;
  try { const r = await fetch("/api/dados"); if (!r.ok) throw 0; D = await r.json(); }
  catch (e) {
    $("main").innerHTML = `<section class="sem-servidor"><h1>Falta ligar o servidor</h1><p>O MEI sem Medo roda em Python. Abra o Terminal na pasta do projeto e rode:</p>
      <pre>python src/servidor.py</pre><p>Depois acesse <strong>http://127.0.0.1:8000</strong>.</p></section>`;
    return;
  }
  const BASE = D.base, TEMAS = D.temas, ANEXOS = D.anexos, CONFIG_PADRAO = D.config_padrao, CK = D.checklist;
  const porId = (id) => BASE.find((r) => r.id === id);
  const erro = (el, e) => (el.innerHTML = `<p class="erro">${esc(e.message)}</p>`);
  // calendário (só para desenhar a tabela mês a mês; as contas de imposto são do Python)
  const mesIdx = (m) => { const t = /^(\d{4})-(\d{2})$/.exec(String(m).trim()); if (!t || +t[2] < 1 || +t[2] > 12) throw new Error("Mês inválido: use o formato AAAA-MM, por exemplo 2026-11."); return +t[1] * 12 + +t[2] - 1; };
  const somarMeses = (m, n) => { const i = mesIdx(m) + n; return `${Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, "0")}`; };
  const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const pct = (v) => (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
  const num = (id) => parseFloat(String($(id).value).replace(/\./g, "").replace(",", "."));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  $("n-reg").textContent = BASE.length;
  // ----- configuração da IA: a chave fica só neste navegador (localStorage) -----
  const CHAVE_IA = "mei-sem-medo:ia:v1";
  const lerCfg = () => { try { return JSON.parse(localStorage.getItem(CHAVE_IA)) || {}; } catch (e) { return {}; } };
  const gravarCfg = (c) => { try { c.chave ? localStorage.setItem(CHAVE_IA, JSON.stringify(c)) : localStorage.removeItem(CHAVE_IA); return true; } catch (e) { return false; } };
  let cfg = lerCfg(), servidor = null; // servidor: resposta de /api/status quando o site roda em src/servidor.py
  let agenteAtivo = false;
  function atualizarModo() {
    const comChave = !!cfg.chave;
    agenteAtivo = !!(servidor && (servidor.agente || (servidor.aceita_chave && comChave)));
    $("modo").textContent = agenteAtivo ? "IA ligada" : "IA desligada";
    $("modo").className = agenteAtivo ? "on" : "";
  }
  atualizarModo();
  if (location.protocol.startsWith("http"))
    fetch("/api/status").then((r) => { if (!r.ok) throw 0; return r.json(); }).then((s) => { servidor = s; atualizarModo(); }).catch(() => {});
  const dlg = $("dlg-ia");
  const AJUDA_PROV = { gemini: "Gemini: crie em aistudio.google.com/apikey", claude: "Claude: crie em console.anthropic.com", openrouter: "OpenRouter: crie em openrouter.ai/keys" };
  function mostrarProvedor() {
    const p = $("ia-prov").value;
    $("ia-ajuda").textContent = AJUDA_PROV[p] || AJUDA_PROV.gemini;
    $("ia-modelo-wrap").hidden = p !== "openrouter"; // o modelo só se escolhe no OpenRouter
    $("ia-aviso").textContent = "A chave fica só neste navegador (localStorage) e é enviada apenas a este servidor local, que a usa para falar com o provedor. Não use em computador compartilhado.";
  }
  function abrirConfig() {
    $("ia-prov").value = cfg.provedor || "gemini";
    $("ia-chave").value = cfg.chave || ""; $("ia-modelo").value = cfg.modelo || ""; $("ia-msg").textContent = "";
    mostrarProvedor();
    if (!servidor) $("ia-msg").textContent = "A IA só funciona com o servidor local: rode python src/servidor.py e abra http://127.0.0.1:8000.";
    $("ia-salvar").disabled = !servidor;
    if (!dlg.open) dlg.showModal();
  }
  $("abrir-ia").onclick = abrirConfig;
  $("ia-prov").onchange = mostrarProvedor;
  $("form-ia").addEventListener("submit", (e) => {
    if (e.submitter && e.submitter.value === "salvar") {
      e.preventDefault();
      const chave = $("ia-chave").value.trim();
      if (chave && !/^[A-Za-z0-9_.\-]{16,256}$/.test(chave)) { $("ia-msg").textContent = "Essa chave parece incompleta. Copie a chave inteira, sem espaços."; return; }
      const provedor = $("ia-prov").value;
      const modelo = provedor === "openrouter" ? $("ia-modelo").value.trim() : "";
      if (modelo && !/^[A-Za-z0-9][A-Za-z0-9_.:\/\-]{0,99}$/.test(modelo)) { $("ia-msg").textContent = "Nome de modelo inválido. Use o formato fabricante/modelo, por exemplo anthropic/claude-sonnet-5.5."; return; }
      cfg = { provedor, chave, ...(modelo ? { modelo } : {}) };
      if (!gravarCfg(cfg)) { $("ia-msg").textContent = "Não consegui salvar neste navegador (armazenamento bloqueado)."; return; }
      atualizarModo(); $("ia-msg").textContent = chave ? "Pronto! Faça uma pergunta para testar." : "Chave removida."; sessao = novaSessao();
      if (chave) setTimeout(() => dlg.close(), 700);
    }
  });
  $("ia-remover").onclick = () => { cfg = {}; gravarCfg(cfg); $("ia-chave").value = ""; $("ia-modelo").value = ""; atualizarModo(); $("ia-msg").textContent = "Chave removida deste navegador."; };

  // ----- navegação: conversa (início) + ferramentas -----
  function abrirAba(t) {
    document.querySelectorAll("[role=tabpanel]").forEach((p) => (p.hidden = p.id !== "tab-" + t));
    document.querySelectorAll(".menu button, .nav-principal button").forEach((b) => { if (b.dataset.aba === t) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    fecharMenu();
    window.scrollTo({ top: 0 });
  }
  // o menu abre pelo "Quando crescer" (computador) ou pelo "Menu" (celular); no computador ele aparece logo abaixo do botão
  const botoesMenu = [$("abrir-menu"), document.querySelector(".nav-mais")];
  function fecharMenu() { $("menu").hidden = true; botoesMenu.forEach((b) => b.setAttribute("aria-expanded", "false")); }
  botoesMenu.forEach((b) => (b.onclick = () => {
    const abrir = $("menu").hidden;
    fecharMenu();
    if (!abrir) return;
    if (b.classList.contains("nav-mais")) $("menu").style.left = b.offsetLeft + "px"; else $("menu").style.left = "";
    $("menu").hidden = false; b.setAttribute("aria-expanded", "true");
  }));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharMenu(); });
  document.addEventListener("click", (e) => { if (!$("menu").hidden && !e.target.closest("#menu, #abrir-menu, .nav-mais")) fecharMenu(); });
  // tema claro/escuro: segue o sistema até a pessoa escolher; a escolha fica neste navegador
  $("tema").onclick = () => {
    const r = document.documentElement, atual = r.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    r.dataset.theme = atual === "light" ? "dark" : "light";
    try { localStorage.setItem("mei-sem-medo:tema", r.dataset.theme); } catch (e) {}
  };
  // link direto para uma aba: index.html#mei, #pronto, #preco...
  const abaDoLink = location.hash.slice(1);
  abrirAba(abaDoLink && document.getElementById("tab-" + abaDoLink) ? abaDoLink : "perguntar");
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-aba]"); if (b) abrirAba(b.dataset.aba); });

  // ----- "perguntar ao assistente" em cada calculadora: leva a pergunta (com o resultado, se houver) para o chat -----
  const ctx = {};
  const PERGUNTA = { preco: "Como o preço de venda é calculado e como melhoro minha margem?", mei: "Como funcionam o limite de faturamento e o DAS do MEI?",
    simples: "Como é calculado o DAS do Simples Nacional? O que é alíquota efetiva?", hibrido: "Qual a diferença entre Simples puro e híbrido na reforma tributária?",
    creditos: "Como funcionam os créditos de IBS e CBS para quem está no Simples?", split: "Como funciona o split payment?" };
  document.querySelectorAll("[data-ctx]").forEach((sec) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "ia-btn"; b.textContent = "Tirar dúvida com o assistente";
    b.onclick = () => {
      const k = sec.dataset.ctx; abrirAba("perguntar");
      const q = $("pergunta"); q.value = (PERGUNTA[k] + (ctx[k] ? " " + ctx[k] : "")).slice(0, 300); q.focus(); q.setSelectionRange(q.value.length, q.value.length);
    };
    sec.querySelector("h2").after(b);
  });

  // ----- perguntar -----
  const FERRAMENTA = { A3: ["simples", "Abrir calculadora do DAS"], A4: ["simples", "Abrir calculadora do DAS"], A5: ["simples", "Abrir calculadora do DAS"], A2: ["simples", "Ver tabela dos anexos"],
    K1: ["creditos", "Abrir simulador de créditos"], K2: ["creditos", "Abrir simulador de créditos"], K3: ["creditos", "Abrir simulador de créditos"], K5: ["creditos", "Abrir simulador de créditos"],
    M1: ["mei", "Calcular meu limite e DAS"], D3: ["mei", "Ver meu limite e DAS"], M2: ["mei", "Calcular meu limite e DAS"], M6: ["mei", "Calcular meu limite e DAS"], A7: ["mei", "Calcular meu limite e DAS"],
    S1: ["split", "Ver o split payment na prática"], S2: ["split", "Ver o split payment na prática"], R5: ["hibrido", "Simular Simples puro x híbrido"],
    P1: ["preco", "Calcular o preço do meu produto"], P2: ["preco", "Calcular o preço do meu produto"], P3: ["preco", "Calcular o preço do meu produto"], D3: ["mei", "Ver meu limite e DAS"] };
  function cartao(r, extra = "") {
    const f = FERRAMENTA[r.id];
    if (f) extra += `<p><button type="button" class="ferr" data-aba="${f[0]}">${f[1]}</button></p>`;
    const rel = r.relacionados.map(porId).filter(Boolean).slice(0, 3);
    const aviso = r.confianca === "confirmar" ? `<p class="aviso">Esta informação pode mudar ou as fontes divergem: confirme em canal oficial.</p>` : "";
    return `<article class="card"><h3>${esc(r.titulo)}</h3>
      <span class="badge ${r.confianca}">${r.confianca === "alta" ? "Confiabilidade alta" : "Confirmar na fonte oficial"}</span>
      <p>${esc(r.resposta)}</p>${aviso}
      <p class="fonte">Fonte: <a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.fonte)}</a> · verificado em ${esc(r.verificado)}</p>
      ${(r.base_legal || []).length ? `<p class="legal">Base legal: ${r.base_legal.map(esc).join("; ")}</p>` : ""}
      ${rel.length ? `<div class="rel"><span>Veja também</span>${rel.map((x) => `<button type="button" data-id="${x.id}">${esc(x.titulo)}</button>`).join("")}</div>` : ""}${extra}</article>`;
  }
  const log = $("resposta");
  function msg(cls, html) {
    document.body.classList.add("conversando"); $("limpar").hidden = false;
    const d = document.createElement("div"); d.className = "msg " + cls; d.innerHTML = html; log.appendChild(d);
    d.querySelectorAll("[data-id]").forEach((b) => (b.onclick = () => { msg("eu", esc(b.textContent)); msg("bot", cartao(porId(b.dataset.id))); }));
    d.querySelectorAll("[data-aba]").forEach((b) => (b.onclick = () => abrirAba(b.dataset.aba)));
    d.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function mostrarRegistro(id) { abrirAba("perguntar"); const r = porId(id); msg("eu", esc(r.titulo)); msg("bot", cartao(r)); }
  // ----- agente de IA (opcional: só existe quando o site é servido por src/servidor.py com ANTHROPIC_API_KEY) -----
  let sessao = novaSessao();
  function novaSessao() { return (self.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40).padEnd(8, "x"); }
  const ABA_FERRAMENTA = { analisar_mei: ["mei", "Abrir a calculadora do MEI"], calcular_das: ["simples", "Abrir a calculadora do DAS"], simular_creditos: ["creditos", "Abrir o simulador de créditos"],
    formar_preco_produto: ["preco", "Abrir a calculadora de preço"], formar_preco_servico: ["preco", "Abrir a calculadora de preço"],
    simular_puro_hibrido: ["hibrido", "Abrir o simulador puro x híbrido"], projetar_meses: ["hibrido", "Abrir o simulador puro x híbrido"], simular_split_payment: ["split", "Ver o split payment"], tabela_anexo: ["simples", "Ver as tabelas do Simples"] };
  const NOME_FERRAMENTA = { buscar_base: "busca na base", obter_registro: "leitura de registro", listar_temas: "lista de temas", calcular_das: "cálculo do DAS", analisar_mei: "análise do MEI", simular_creditos: "simulação de créditos", formar_preco_produto: "cálculo de preço", formar_preco_servico: "cálculo de preço de serviço", simular_puro_hibrido: "simulação puro x híbrido", projetar_meses: "projeção mês a mês", simular_split_payment: "split payment", tabela_anexo: "tabela do anexo" };
  function html(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>"); }
  function cartaoAgente(r) {
    const fontes = r.fontes.length ? `<p class="fonte">Fontes:<br>${r.fontes.map((f) => `[${esc(f.id)}] <a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.fonte)}</a> · verificado em ${esc(f.verificado)}${(f.base_legal || []).length ? `<br><span class="legal">Base legal: ${f.base_legal.map(esc).join("; ")}</span>` : ""}`).join("<br>")}</p>` : "";
    const usadas = [...new Set(r.ferramentas)];
    const botoes = usadas.filter((t) => ABA_FERRAMENTA[t]).map((t) => `<button type="button" class="ferr" data-aba="${ABA_FERRAMENTA[t][0]}">${ABA_FERRAMENTA[t][1]}</button>`).join(" ");
    const meta = usadas.length ? `<p class="fonte">Agente de IA · consultou: ${usadas.map((t) => NOME_FERRAMENTA[t] || t).join(", ")} · ${r.tempo_ms} ms</p>` : "";
    return `<article class="card"><p>${html(r.texto)}</p>${fontes}${botoes ? `<p>${botoes}</p>` : ""}${meta}</article>`;
  }
  async function responderAgente(q) {
    msg("eu", esc(q.trim() || "(mensagem vazia)"));
    if (!q.trim()) return msg("bot", `<div class="card"><p>Você não digitou nada. Pergunte, por exemplo: “qual o limite do MEI?”</p></div>`);
    const espera = document.createElement("div"); espera.className = "msg bot"; espera.innerHTML = `<div class="card"><p>Procurando na base e nas calculadoras…</p></div>`; log.appendChild(espera);
    try {
      const r = await fetch("/api/agente", { method: "POST", headers: { "Content-Type": "application/json", ...(cfg.chave ? { "X-Chave-IA": cfg.chave, "X-Provedor-IA": cfg.provedor || "gemini", ...(cfg.modelo ? { "X-Modelo-IA": cfg.modelo } : {}) } : {}) }, body: JSON.stringify({ sessao, mensagem: q }) });
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      espera.remove();
      if (d.modo === "erro") { msg("bot", `<div class="card"><p class="aviso">O assistente de IA não respondeu${d.detalhe ? ": " + esc(d.detalhe) : ""}. Confira a chave em “Configurar IA”. Mostrando a busca na base verificada.</p></div>`); return responderBase(q, false); }
      msg("bot", cartaoAgente(d));
    } catch (e) { espera.remove(); responderBase(q, true); }
  }
  function responder(q) { return agenteAtivo ? responderAgente(q) : responderBase(q, true); }
  async function responderBase(q, mostrarPergunta) {
    if (mostrarPergunta) msg("eu", esc(q.trim() || "(mensagem vazia)"));
    let res;
    try { res = await py("perguntar", q); } catch (err) { return msg("bot", `<div class="card"><p class="erro">${esc(err.message)}</p></div>`); }
    if (res.status === "ok") return msg("bot", cartao(porId(res.id)));
    if (res.status === "ambigua") return msg("bot", `<div class="card"><p>Sua pergunta pode ser sobre dois assuntos. Qual você quer?</p><div class="opcoes">${res.opcoes.map(porId).map((r) => `<button type="button" data-id="${r.id}">${esc(r.titulo)}</button>`).join("")}</div></div>`);
    msg("bot", `<div class="card"><p>${esc(res.texto)}</p>${res.status === "desconhecida" ? `<p class="fonte">Veja “Assuntos” no menu ou use as calculadoras.</p>` : ""}</div>`);
  }
  $("form-pergunta").addEventListener("submit", (e) => { e.preventDefault(); responder($("pergunta").value); $("pergunta").value = ""; $("pergunta").focus(); });
  $("limpar").onclick = () => { log.innerHTML = ""; sessao = novaSessao(); document.body.classList.remove("conversando"); $("limpar").hidden = true; };
  // qualquer botão com data-pergunta (atalhos, medos da landing) leva a pergunta pronta para a conversa
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-pergunta]"); if (b) { abrirAba("perguntar"); responder(b.dataset.pergunta); } });
  const ligarRegistros = (el) => el.querySelectorAll("[data-id]").forEach((b) => (b.onclick = () => mostrarRegistro(b.dataset.id)));

  // ----- landing: números do projeto -----
  $("n-reg2").textContent = BASE.length;
  $("n-temas").textContent = new Set(BASE.map((r) => r.tema)).size;
  $("n-check").textContent = CK.length;

  // ----- Estou pronto para 2027? (uma pergunta por vez; respostas só na memória da página) -----
  let ckResp = {};   // a ordem das chaves é a ordem das respostas (o Python devolve na ordem do arquivo)
  const ROTULO = { sim: "Sim", nao: "Não", nao_sei: "Não sei" };
  async function ckDesenhar() {
    let e;
    try { e = await py("checklist", ckResp); } catch (err) { return erro($("ck"), err); }
    ckResp = e.respostas;   // o Python já tirou respostas que deixaram de valer
    if (!e.proxima) return ckResultado(e.resultado);
    const q = e.proxima, feitas = e.feitas, total = e.total;
    $("ck").innerHTML = `<div class="card ck-q">
      <div class="ck-prog" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${feitas}" aria-label="Progresso"><div style="width:${(feitas / total) * 100}%"></div></div>
      <p class="fonte">Pergunta ${feitas + 1} de ${total}${q.tipo === "perfil" ? " · sobre o seu negócio" : ""}</p>
      <h3 class="ck-txt">${esc(q.pergunta)}</h3>
      <div class="ck-btns">${Object.keys(ROTULO).map((k) => `<button type="button" data-ck="${k}" class="ck-b">${ROTULO[k]}</button>`).join("")}</div>
      ${feitas ? `<button type="button" class="link" id="ck-voltar">← Voltar</button>` : ""}</div>`;
    $("ck").querySelectorAll("[data-ck]").forEach((b) => (b.onclick = () => { ckResp[q.id] = b.dataset.ck; ckDesenhar(); }));
    if (feitas) $("ck-voltar").onclick = () => { delete ckResp[Object.keys(ckResp).pop()]; ckDesenhar(); };
    $("ck").querySelector(".ck-b").focus({ preventScroll: true });
  }
  function ckResultado(r) {
    const p = Math.round(r.pct * 100), titulo = (id) => (porId(id) || {}).titulo || id;
    const FER = { mei: "Calcular meu limite e DAS", preco: "Calcular meu preço" };
    $("ck").innerHTML = `<div class="card ck-res ${r.nivel}">
        <div class="medidor" style="--p:${p}" role="img" aria-label="${p}% pronto"><b>${p}%</b><span>${{ pronto: "pronto", quase: "quase lá", atencao: "atenção" }[r.nivel]}</span></div>
        <div><h3>${esc(r.frase)}</h3><p class="fonte">${r.pontos} de ${r.total} pontos. Itens mais importantes valem mais.</p></div></div>
      ${r.pendencias.length ? `<h3>O que resolver, em ordem de prioridade</h3><ol class="pend">${r.pendencias.map((q) => `<li class="card">
        <span class="badge ${q.resposta === "nao" ? "confirmar" : "neutro"}">Você respondeu: ${ROTULO[q.resposta]}</span>
        <p><strong>${esc(q.pergunta)}</strong></p><p>${esc(q.dica)}</p>
        <div class="rel"><span>Ler na base</span>${q.registros.map((id) => `<button type="button" data-id="${id}">${esc(titulo(id))}</button>`).join("")}</div>
        ${q.ferramenta ? `<p><button type="button" class="ferr" data-aba="${q.ferramenta}">${FER[q.ferramenta]}</button></p>` : ""}</li>`).join("")}</ol>` : `<p class="card">Nada pendente. Continue acompanhando: as regras da reforma ainda podem mudar.</p>`}
      <p class="aviso">Orientação informativa, não é serviço oficial. Confirme com um contador ou no Portal do Empreendedor.</p>
      <div class="acoes"><button type="button" id="ck-refazer">Refazer o checklist</button></div>`;
    ligarRegistros($("ck"));
    $("ck-refazer").onclick = () => { ckResp = {}; ckDesenhar(); };
  }
  ckDesenhar();

  // ----- temas -----
  $("lista-temas").innerHTML = Object.keys(TEMAS).map((t) =>
    `<details><summary>${esc(TEMAS[t])} (${BASE.filter((r) => r.tema === t).length})</summary>` +
    BASE.filter((r) => r.tema === t).map((r) => `<div class="rel"><button type="button" data-id="${r.id}">${esc(r.titulo)}</button></div>`).join("") + "</details>").join("");
  document.querySelectorAll("#lista-temas [data-id]").forEach((b) => (b.onclick = () => mostrarRegistro(b.dataset.id)));

  // ----- simples -----
  const opts = Object.entries(ANEXOS).map(([k, v]) => `<option value="${k}">Anexo ${k} - ${v[0]}</option>`).join("");
  $("anexo-ver").innerHTML = opts; $("das-anexo").innerHTML = Object.entries(ANEXOS).map(([k, v]) => `<option value="${k}">${v[0]} (Anexo ${k})</option>`).join("");
  $("das-anexo").onchange = () => { $("das-folha-wrap").hidden = $("das-anexo").value !== "V"; };
  function tabela() {
    const a = $("anexo-ver").value, f = ANEXOS[a][1];
    $("tabela-anexo").innerHTML = "<tr><th>Faixa</th><th>Receita 12 meses até</th><th>Alíquota nominal</th><th>Parcela a deduzir</th></tr>" +
      f.map(([t, n, d], i) => `<tr><td>${i + 1}ª</td><td>${brl(t)}</td><td>${n.toLocaleString("pt-BR")}%</td><td>${brl(d)}</td></tr>`).join("");
  }
  $("anexo-ver").onchange = tabela; tabela();
  $("form-das").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const r = await py("calcular_das", $("das-anexo").value, num("das-rbt"), num("das-mes"), num("das-folha") || 0);
      ctx.simples = `Meu DAS deu ${brl(r.das)} (${pct(r.aliquota_efetiva)} do faturamento, Anexo ${r.anexo}).`;
      $("res-das").innerHTML = `<div class="card"><p>Você paga de DAS, neste mês:</p><div class="num">${brl(r.das)}</div>
        <p>É cerca de <strong>${pct(r.aliquota_efetiva)}</strong> do que você faturou.${r.anexo !== $("das-anexo").value ? " Com Fator R de 28% ou mais, a conta usou o Anexo III." : ""}</p>
        <details class="ajustes"><summary>Ver a conta</summary><p>Anexo ${r.anexo}, ${r.faixa}ª faixa, alíquota nominal ${r.aliquota_nominal.toLocaleString("pt-BR")}%.</p>
        <p class="fonte">(RBT12 × alíquota nominal − parcela a deduzir) ÷ RBT12. Estimativa: confirme no PGDAS-D ou com seu contador.</p></details></div>`;
    } catch (err) { erro($("res-das"), err); }
  });

  // ----- MEI: limite e DAS (sabe o mês atual e o mês de abertura; média automática) -----
  {
    const hoje = new Date(), ANO = hoje.getFullYear(), MES = hoje.getMonth();
    const NOMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const ATIV = { comercio: "comércio", servicos: "serviços", ambos: "comércio e serviços" };
    document.querySelectorAll(".m-ano").forEach((e) => (e.textContent = ANO));
    $("m-abertura").innerHTML = `<option value="-1">Antes de ${ANO}</option>` + NOMES.slice(0, MES + 1).map((n, i) => `<option value="${i}">Em ${n} de ${ANO}</option>`).join("");
    const lerNum = (id) => { const t = $(id).value.trim(); return t ? parseFloat(t.replace(/\./g, "").replace(",", ".")) : NaN; };
    let seqMei = 0;
    async function calcMei() {
      const seq = ++seqMei;
      const ativ = document.querySelector("input[name=m-ativ]:checked").value, ab = +$("m-abertura").value;
      const meses = ab < 0 ? 12 : 12 - ab;                 // meses de atividade no ano (limite proporcional)
      const decorridos = ab < 0 ? MES + 1 : MES - ab + 1;   // meses já trabalhados, contando o atual
      const rest = 11 - MES;                                // meses inteiros que faltam até dezembro
      const sm = lerNum("m-sm") || 1621, fat = lerNum("m-fat");
      const mediaDig = lerNum("m-media"), mediaAtual = fat >= 0 ? fat / decorridos : 0, media = mediaDig >= 0 ? mediaDig : mediaAtual;
      let r;   // a conta inteira é do Python (calculadora.analisar_mei); sem valor ainda, pede o limite e o DAS com faturamento zero
      try { r = await py("analisar_mei", ativ, meses, fat >= 0 ? fat : 0, rest, media, sm); } catch (err) { if (seq === seqMei) $("res-mei").innerHTML = `<p class="erro">${esc(err.message)}</p>`; return; }
      if (seq !== seqMei) return;   // chegou uma resposta antiga: ignora
      const das = r.das_mensal, limite = r.limite_ano;
      const intro = `<p class="mei-das">Seu DAS: <b>${brl(das)}</b> por mês (${ATIV[ativ]}), vence todo dia 20.</p>`;
      if (!(fat >= 0)) {
        $("m-media").placeholder = "";
        $("res-mei").innerHTML = `<div class="card mei-res"><p class="mei-frase">Seu limite em ${ANO}: <b>${brl(limite)}</b></p>
          <p>${meses < 12 ? `Como você abriu em ${NOMES[ab]}, o limite é proporcional: R$ 6.750 por mês de atividade.` : "Dá uma média de R$ 6.750 por mês."} Diga quanto já entrou para ver quanto ainda cabe.</p>${intro}</div>`;
        if ($("m-fat").value.trim()) $("res-mei").insertAdjacentHTML("afterbegin", `<p class="erro">Digite o valor em reais, por exemplo 40000 ou 40.000,00.</p>`);
        return;
      }
      $("m-media").placeholder = `Sua média até agora: ${brl(mediaAtual)}`;
      const ritmo = mediaDig >= 0 ? `recebendo ${brl(media)} por mês` : `no seu ritmo atual (${brl(media)} por mês)`;
      const fim = rest ? `até dezembro` : `até o fim do ano`;
      const porMes = rest > 1 ? ` Isso dá até <b>${brl(r.maximo_por_mes_restante)} por mês</b> nos ${rest} meses que faltam.` : "";
      let frase, detalhe;
      if (fat > limite) {
        frase = `Você já passou do limite em <b>${brl(fat - limite)}</b>.`;
        detalhe = r.status === "acima_20" ? "Acima de 20% o desenquadramento vale desde janeiro, com imposto de microempresa retroativo. Procure um contador." : `Até 20% acima você segue como MEI até dezembro, paga um DAS complementar (cerca de ${brl(r.das_complementar_estimado)}) e vira microempresa em ${ANO + 1}.`;
      } else if (r.status === "dentro") {
        frase = `Você ainda pode faturar <b>${brl(r.folga)}</b> ${fim}.`;
        detalhe = `${porMes.trim()} ${ritmo[0].toUpperCase() + ritmo.slice(1)}, você termina ${ANO} com ${brl(r.projecao)}, ${pct(r.projecao / limite)} do limite.`;
      } else {
        frase = `${ritmo[0].toUpperCase() + ritmo.slice(1)}, você passa do limite em <b>${brl(r.excesso)}</b>.`;
        detalhe = (rest ? `Para ficar dentro, receba no máximo <b>${brl(r.maximo_por_mes_restante)}${rest > 1 ? " por mês" : ""}</b> ${fim}. ` : "") +
          (r.status === "ate_20" ? `Se passar até 20%, você segue como MEI até dezembro, paga um DAS complementar (cerca de ${brl(r.das_complementar_estimado)}) e vira microempresa em ${ANO + 1}.`
            : "Passando mais de 20%, o desenquadramento vale desde janeiro, com imposto de microempresa retroativo. Converse com um contador antes.");
      }
      const escala = Math.max(r.projecao, limite * 1.2), w = (v) => Math.min(100, (v / escala) * 100);
      ctx.mei = `Já faturei ${brl(fat)} em ${ANO} e devo fechar o ano com ${brl(r.projecao)}.`;
      $("res-mei").innerHTML = `<div class="card mei-res ${fat > limite ? "acima_20" : r.status}">
        <p class="mei-frase">${frase}</p><p>${detalhe}</p>
        <div class="mei-barra" role="img" aria-label="Faturado ${brl(fat)}, previsto ${brl(r.projecao)}, limite ${brl(limite)}">
          <div class="mb-fat" style="width:${w(fat)}%"></div><div class="mb-prev" style="width:${Math.max(0, w(r.projecao) - w(fat))}%"></div>
          <i class="mb-lim" style="left:${w(limite)}%"><span>limite</span></i><i class="mb-lim mb-20" style="left:${w(limite * 1.2)}%"><span>+20%</span></i>
        </div>
        <p class="leg"><span><i class="c-fat"></i>Já recebido: ${brl(fat)}</span><span><i class="c-prev"></i>Previsto até dezembro: ${brl(r.projecao - fat)}</span><span>Limite ${ANO}: ${brl(limite)}</span></p>
        ${intro}
        <details class="ajustes"><summary>E se eu virar microempresa?</summary>
          <p>MEI: ${brl(r.custo_anual_mei)} de DAS por ano. Microempresa no Simples: ${r.custo_anual_microempresa == null ? "fora do limite do Simples" : `cerca de <strong>${brl(r.custo_anual_microempresa)}</strong> por ano`} (estimativa só do imposto).</p></details>
        <div class="rel"><span>Ler na base</span><button type="button" data-id="M1">Limite de faturamento</button><button type="button" data-id="M6">O que acontece se passar</button><button type="button" data-id="M2">Valor do DAS</button></div>
        <p class="fonte">Estimativa. Confirme no Portal do Empreendedor.</p></div>`;
      ligarRegistros($("res-mei"));
    }
    $("form-mei").addEventListener("input", calcMei); $("form-mei").addEventListener("change", calcMei);
    $("form-mei").addEventListener("submit", (e) => { e.preventDefault(); calcMei(); });
    calcMei();
  }

  // ----- Simples puro x híbrido + histórico do RBT12 (salvo só neste navegador, em localStorage) -----
  const CHAVE = "mei-sem-medo:historicos:v1";
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const TIPOS = { real: "Real", previsao: "Previsão", media: "Média" };
  const ANEXOS_ABA = ["III", "V"]; // nesta aba a empresa é de serviços: Anexo III ou V (Fator R)
  const rotMes = (m) => MESES[+m.slice(5) - 1] + "/" + m.slice(0, 4);
  const parseBR = (s) => { const t = String(s).trim(); return t ? parseFloat(t.replace(/\./g, "").replace(",", ".")) : NaN; };
  const fmtIn = (v) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  const novoHistorico = (nome) => ({ id: "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), nome, config: { ...CONFIG_PADRAO }, meses: [] });
  // valida e limpa um histórico (salvo ou importado); lança erro com mensagem amigável se não servir
  function normalizar(obj) {
    if (!obj || typeof obj !== "object" || !Array.isArray(obj.meses)) throw new Error("o arquivo não é um histórico do MEI sem Medo.");
    const config = { ...CONFIG_PADRAO };
    for (const k of Object.keys(config)) {
      const v = obj.config ? obj.config[k] : undefined;
      if (k === "anexo") { if (ANEXOS_ABA.includes(v)) config.anexo = v; } else if (Number.isFinite(Number(v)) && v !== null && v !== "") config[k] = Number(v);
    }
    const meses = obj.meses.map((m) => ({ mes: somarMeses(m.mes, 0), receita: Number(m.receita) || 0, compras: Number(m.compras) || 0, tipo: TIPOS[m.tipo] ? m.tipo : "real" }))
      .sort((a, b) => mesIdx(a.mes) - mesIdx(b.mes));
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

  $("h-anexo").innerHTML = ANEXOS_ABA.map((k) => `<option value="${k}">Anexo ${k} - ${ANEXOS[k][0]}</option>`).join("");
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
      <details class="ajustes"><summary>Ver a conta detalhada</summary>
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
      <p class="fonte">${cab} Dentro do DAS, PIS+Cofins = ${pct(r.parcela_pis_cofins)} e ICMS/ISS = ${pct(r.parcela_icms_iss)} (repartição da LC 123). ${textoRegra(r)} O crédito das compras usa a alíquota cheia, sem a redução do setor.${faixa6}</p></details></div>`;
  }

  // simulação de um mês
  async function simularUm() {
    try {
      const c = lerEmpresa();
      const r = await py("simular_puro_hibrido", c.anexo, num("hs-rbt"), num("hs-mes"), +$("hs-ano").value, $("hs-compras").value.trim() ? num("hs-compras") : 0,
        c.aliq_cbs, c.aliq_ibs, c.reducao_setor, c.pct_b2b, c.folha12);
      $("res-hib").innerHTML = cartaoPuroHibrido(r);
      ctx.hibrido = r.hibrido ? `Em ${r.ano}, deu ${brl(r.puro.total)} no puro e ${brl(r.hibrido.total)} no híbrido.` : "";
    } catch (err) { erro($("res-hib"), err); }
  }
  // tabela de alíquotas do anexo escolhido (III ou V), destacando a faixa do RBT12 digitado
  let seqTab = 0;
  async function tabelaAliquotas() {
    const seq = ++seqTab;
    const c = atual().config, rbt = num("hs-rbt"), temRbt = rbt > 0;
    let anexo = c.anexo, nota = "";
    if (anexo === "V" && temRbt && c.folha12 > 0) {
      const fr = c.folha12 / rbt;
      if (fr >= 0.28) { anexo = "III"; nota = `<p class="aviso">Fator R de ${pct(fr)} (folha ÷ RBT12, 28% ou mais): mesmo escolhendo o Anexo V, a empresa é tributada pelo <strong>Anexo III</strong>, que é a tabela abaixo.</p>`; }
      else nota = `<p>Fator R de ${pct(fr)} (folha ÷ RBT12, abaixo de 28%): a empresa fica no Anexo V.</p>`;
    } else if (anexo === "V") nota = `<p class="fonte">Informe a folha + pró-labore em Dados da empresa para calcular o Fator R. Com 28% ou mais, a empresa passa para o Anexo III.</p>`;
    const faixas = ANEXOS[anexo][1];
    let a = null;
    if (temRbt) try { a = await py("aliquota_efetiva", anexo, rbt); } catch (e) { a = null; }
    if (seq !== seqTab) return;
    const linhas = faixas.map(([teto, nominal, deduzir], i) => {
      const sua = a && a.faixa === i + 1, receita = i ? `De ${brl(faixas[i - 1][0] + 0.01)} a ${brl(teto)}` : `Até ${brl(teto)}`;
      return `<tr${sua ? ' class="atual"' : ""}><td>${i + 1}ª${sua ? " <strong>sua faixa</strong>" : ""}</td><td>${receita}</td><td>${nominal.toLocaleString("pt-BR")}%</td><td>${brl(deduzir)}</td></tr>`;
    }).join("");
    const conta = a ? `<p>Seu RBT12 de <strong>${brl(rbt)}</strong> está na <strong>${a.faixa}ª faixa</strong>. Alíquota efetiva = (${brl(rbt)} × ${a.nominal.toLocaleString("pt-BR")}% − ${brl(faixas[a.faixa - 1][2])}) ÷ ${brl(rbt)} = <strong>${pct(a.efetiva)}</strong>.</p>`
      : rbt > 4800000 ? `<p class="aviso">RBT12 acima de R$ 4,8 milhões: fora do limite do Simples Nacional.</p>`
      : `<p class="fonte">Digite o RBT12 acima para ver em qual faixa a empresa está.</p>`;
    $("hs-tabela").innerHTML = `<div class="card"><h3>Tabela do Anexo ${anexo}: ${esc(ANEXOS[anexo][0])}</h3>${nota}
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
    if (ate < 11 || mesIdx(ms[ate].mes) - mesIdx(ms[ate - 11].mes) !== 11) return null;
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
  let seqHist = 0;
  async function atualizarCalculos() {
    const h = atual(), seq = ++seqHist;
    if (!h.meses.length) return;
    let linhas;
    try { linhas = await py("projetar_historico", h.meses, h.config); } catch (e) { if (seq === seqHist) erro($("h-erro"), e); return; }
    if (seq !== seqHist) return;
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
    const h = atual(), ms = h.meses, prox = somarMeses(ms[ms.length - 1].mes, 1);
    let ultReal = -1;
    ms.forEach((m, k) => { if (m.tipo !== "previsao") ultReal = k; });
    const rbtReal = ultReal >= 0 ? somaUltimos12(ms, ultReal) : null, rbtFim = somaUltimos12(ms, ms.length - 1);
    const comH = linhas.filter((l) => l.resultado && l.resultado.hibrido), soPuro = linhas.filter((l) => l.resultado && !l.resultado.hibrido);
    const soma = (arr, f) => Math.round(arr.reduce((s, l) => s + f(l.resultado), 0) * 100) / 100;
    let html = `<div class="card"><h3>Resumo de “${esc(h.nome)}”</h3>`;
    if (rbtReal != null) {
      const mesReal = somarMeses(ms[ultReal].mes, 1);
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
  async function mostrarDetalhe(k, linhas) {
    let ln;
    try { ln = (linhas || await py("projetar_historico", atual().meses, atual().config))[k]; } catch (e) { return erro($("h-detalhe"), e); }
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
    ms.push({ mes: somarMeses(u.mes, 1), receita: u.receita, compras: u.compras, tipo: "previsao" });
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
  $("form-inicio").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const mes = somarMeses($("hi-mes").value.trim(), 0), h = atual();
      h.meses = $("hi-modo").value === "total" ? await py("meses_base_rbt12", mes, num("hi-rbt"))
        : Array.from({ length: 12 }, (_, k) => ({ mes: somarMeses(mes, k - 12), receita: 0, compras: 0, tipo: "real" }));
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
    a.href = url; a.download = `historico-${h.nome.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mei"}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $("h-importar-btn").onclick = () => $("h-importar").click();
  $("h-importar").onchange = () => {
    const f = $("h-importar").files[0];
    if (!f) return;
    f.text().then(async (t) => {
      const h = normalizar(JSON.parse(t));
      await py("projetar_historico", h.meses, h.config);   // o Python recusa mês repetido e valor negativo
      h.nome = nomeLivre(h.nome); estado.lista.push(h); estado.ativo = h.id; salvar(); trocarHistorico();
      $("h-status").textContent = `Histórico “${h.nome}” importado com ${h.meses.length} meses.`;
    }).catch((e) => { $("h-status").innerHTML = `<span class="erro">Não consegui importar: ${esc(e instanceof SyntaxError ? "o arquivo não é um JSON válido." : e.message)}</span>`; })
      .finally(() => { $("h-importar").value = ""; });
  };
  salvar(); trocarHistorico();

  // ----- créditos -----
  $("form-cred").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const r = await py("simular_creditos", num("c-b2b"), num("c-cons"), num("c-compras"), num("c-aliq"), num("c-das"), num("c-parcela"));
      const linha = (n, a, b) => `<tr><td>${n}</td><td>${brl(a)}</td><td>${brl(b)}</td></tr>`;
      ctx.creditos = `Simulei: o regime regular custaria ${brl(Math.abs(r.diferenca))} ${r.diferenca > 0 ? "a mais" : "a menos"} por mês.`;
      $("res-cred").innerHTML = `<div class="card"><p>${r.diferenca > 0 ? "Pagar IBS/CBS pelo regime regular custaria, por mês:" : "Pagar IBS/CBS pelo regime regular custaria, por mês, a menos:"}</p>
        <div class="num">${brl(Math.abs(r.diferenca))}<small> ${r.diferenca > 0 ? "a mais" : "a menos"}</small></div>
        <p>No Simples, seus clientes empresas deixam de aproveitar <strong>${brl(r.credito_perdido_pelo_cliente)}</strong> de crédito por mês, e você deixa de recuperar <strong>${brl(r.credito_compras_nao_aproveitado)}</strong> das suas compras.</p>
        <details class="ajustes"><summary>Ver a conta</summary><div class="tabela-wrap"><table><tr><th></th><th>No Simples</th><th>Regime regular</th></tr>
        ${linha("IBS/CBS a pagar", r.simples.imposto_ibs_cbs, r.regular.imposto_ibs_cbs)}
        ${linha("Crédito dos clientes B2B", r.simples.credito_para_cliente_b2b, r.regular.credito_para_cliente_b2b)}
        ${linha("Crédito das suas compras", r.simples.credito_das_compras, r.regular.credito_das_compras)}
        ${linha("Custo total de tributos", r.custo_total_simples, r.custo_total_regular)}</table></div>
        <p class="fonte">Só IBS/CBS, sem IRPJ, CPP nem transição. Alíquota e parcela do DAS são estimativas suas.</p></details></div>`;
    } catch (err) { erro($("res-cred"), err); }
  });

  // ----- split -----
  function split() {
    const v = num("s-valor"), p = num("s-pct");
    if (!(v > 0) || !(p >= 0 && p <= 100)) { $("res-split").innerHTML = `<p class="erro">Informe um valor maior que zero e um percentual entre 0 e 100.</p>`; return; }
    const imp = Math.round(v * p) / 100, liq = v - imp;
    $("res-split").innerHTML = `<div class="barra" role="img" aria-label="Do valor de ${brl(v)}, ${brl(imp)} vão ao governo e ${brl(liq)} ao vendedor">
      <div class="b-gov" style="width:${p}%">${p >= 12 ? brl(imp) : ""}</div><div class="b-ven" style="width:${100 - p}%">${brl(liq)}</div></div>
      <p>Cliente paga <strong>${brl(v)}</strong>. <strong>${brl(imp)}</strong> vão direto ao governo e <strong>${brl(liq)}</strong> chegam ao vendedor.</p>`;
  }
  $("form-split").addEventListener("input", split); $("form-split").addEventListener("submit", (e) => e.preventDefault()); split();

  // ----- preço -----
  // componentes do produto: cada linha = quanto pagou ÷ quantas unidades rende
  const pn = (v) => parseFloat(String(v).trim().replace(/\./g, "").replace(",", "."));
  const comps = $("p-comps");
  function recalcCusto() {
    let tot = 0;
    comps.querySelectorAll(".comp-row").forEach((l) => {
      const pago = pn(l.querySelector(".pago").value), rende = pn(l.querySelector(".rende").value), un = pago >= 0 && rende > 0 ? pago / rende : 0;
      l.querySelector("output").textContent = brl(un); l.dataset.un = un; tot += un;
    });
    $("p-custo-total").textContent = brl(tot);
    $("p-custo").value = $("p-direto").checked ? $("p-custo-direto").value : String(tot).replace(".", ",");
  }
  function addComp(nome = "", pago = "", rende = "1") {
    const l = document.createElement("div"); l.className = "comp-row";
    l.innerHTML = `<input class="nome" aria-label="Nome do componente" placeholder="Ex.: farinha, caixa, etiqueta" maxlength="40" value="${esc(nome)}">
      <label><small>Paguei (R$)</small><input class="pago" inputmode="decimal" aria-label="Quanto paguei, em reais" value="${esc(pago)}"></label>
      <label><small>Rende (qtd.)</small><input class="rende" inputmode="decimal" aria-label="Quantas unidades rende" value="${esc(rende)}"></label>
      <output aria-label="Custo por unidade"></output><button type="button" class="rm" aria-label="Remover componente">×</button>`;
    l.querySelector(".rm").onclick = () => { l.remove(); recalcCusto(); };
    comps.appendChild(l); recalcCusto(); return l;
  }
  comps.addEventListener("input", recalcCusto);
  $("p-addcomp").onclick = () => addComp().querySelector(".nome").focus();
  $("p-direto").onchange = () => { $("p-direto-wrap").hidden = !$("p-direto").checked; comps.parentElement.querySelectorAll("#p-comps,#p-addcomp,.comp-total").forEach((x) => (x.hidden = $("p-direto").checked)); recalcCusto(); };
  $("p-custo-direto").addEventListener("input", recalcCusto);
  addComp("Ingredientes", "40", "10"); addComp("Embalagem", "12", "10"); addComp("Etiqueta e laço", "6", "10");
  const modoPreco = () => document.querySelector("input[name=p-modo]:checked").value;
  document.querySelectorAll("input[name=p-modo]").forEach((r) => r.addEventListener("change", () => {
    $("p-produto").hidden = modoPreco() !== "produto"; $("p-servico").hidden = modoPreco() !== "servico"; $("res-preco").innerHTML = "";
  }));
  async function detalheProduto(r, v) {
    const linhas = [...comps.querySelectorAll(".comp-row")].filter((l) => +l.dataset.un > 0 && !$("p-direto").checked), nome = $("p-nome").value.trim();
    const custo = r.composicao.custo_direto || 1;
    const lista = linhas.length ? `<p><strong>O que pesa no custo${nome ? " de " + esc(nome) : ""}</strong> (${brl(r.composicao.custo_direto)} por unidade)</p><ul class="lista-comp">${linhas.map((l) => `<li><span>${esc(l.querySelector(".nome").value || "Sem nome")}</span><span>${brl(+l.dataset.un)} · ${Math.round(+l.dataset.un / custo * 100)}%</span></li>`).join("")}</ul>` : "";
    const lucros = [10, 20, 30, 40].filter((x) => x + v[0] + v[1] < 100);
    const cen = (await Promise.all(lucros.map((lu) => py("preco_produto", num("p-custo"), num("p-fixos"), num("p-volume"), v[0], v[1], lu, null)
      .then((c) => `<tr><td>${lu}%</td><td>${brl(c.preco_sugerido)}</td><td>${brl(c.lucro_mensal_estimado)}</td></tr>`, () => "")))).join("");
    return lista + (cen ? `<p><strong>E se eu quiser lucrar mais ou menos?</strong></p><div class="tabela-wrap"><table><tr><th>Lucro</th><th>Preço</th><th>Lucro por mês</th></tr>${cen}</table></div>` : "");
  }
  $("form-preco").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const atual = $("p-atual").value.trim() ? num("p-atual") : null, v = [num("p-taxas"), num("p-imposto"), num("p-lucro")];
      const r = modoPreco() === "produto"
        ? await py("preco_produto", num("p-custo"), num("p-fixos"), num("p-volume"), ...v, atual)
        : await py("preco_servico", num("s-renda"), num("s-fixos"), num("s-horas"), num("s-horas-serv"), num("s-material") || 0, ...v, atual);
      const c = r.composicao, total = r.preco_sugerido || 1, seg = [["c1", modoPreco() === "produto" ? "Custo" : "Seu tempo e material", c.custo_direto], ...(modoPreco() === "produto" ? [["c2", "Gastos fixos", c.custo_fixo_rateado]] : []), ["c3", "Taxas e impostos", c.variaveis + c.impostos], ["c4", "Seu lucro", c.lucro]];
      const rotulo = modoPreco() === "produto" ? "por unidade" : "por este serviço";
      const status = !r.preco_atual ? "" : { prejuizo: `<p class="aviso">Opa! Com o preço de hoje (${brl(r.preco_atual.valor)}) você <strong>perde ${brl(-r.preco_atual.lucro_unit)}</strong> ${rotulo}.</p>`,
        abaixo_da_meta: `<p class="aviso">Dá lucro, mas pouco. Com o preço de hoje (${brl(r.preco_atual.valor)}) você ganha ${brl(r.preco_atual.lucro_unit)} ${rotulo} (${r.preco_atual.margem_pct.toLocaleString("pt-BR")}% do preço), abaixo da sua meta.</p>`,
        ok: `<p>Boa! O preço de hoje (${brl(r.preco_atual.valor)}) já atinge a sua meta de lucro.</p>` }[r.preco_atual.status];
      const prod = modoPreco() === "produto", extra = prod ? await detalheProduto(r, v) : "";
      $("res-preco").innerHTML = `<div class="card"><p>Cobre, ${rotulo}:</p><div class="preco-grande">${brl(r.preco_sugerido)}</div>${status}
        <p>Nunca venda abaixo de <strong>${brl(r.preco_minimo)}</strong>: aí você paga para vender.</p>
        ${prod ? "" : `<p>Sua hora vale <strong>${brl(r.valor_hora)}</strong> só para cobrir sua renda e seus gastos.</p>`}
        <details class="ajustes"><summary>Ver a conta completa</summary>
        <div class="pilha" role="img" aria-label="Composição do preço">${seg.map(([k, n, x]) => `<div class="${k}" style="width:${Math.max(x, 0) / total * 100}%"></div>`).join("")}</div>
        <div class="leg">${seg.map(([k, n, x]) => `<span><i class="${k}"></i>${n}: ${brl(x)}</span>`).join("")}</div>
        ${prod ? `<p>Para pagar as contas, venda pelo menos <strong>${r.ponto_equilibrio_unidades == null ? "mais do que consegue" : Math.ceil(r.ponto_equilibrio_unidades).toLocaleString("pt-BR") + " unidades por mês"}</strong>.</p>` : ""}
        ${extra}
        ${prod ? `<p>Vendendo ${num("p-volume").toLocaleString("pt-BR")} por mês, sobra de lucro cerca de <strong>${brl(r.lucro_mensal_estimado)}</strong>, fora o que você já separou para você nos gastos fixos. Dá para dar até ${r.desconto_maximo_pct.toLocaleString("pt-BR")}% de desconto sem prejuízo.</p>` : ""}</details>
        <p class="fonte">Método do Sebrae. Compare também com os concorrentes.</p></div>`;
      ctx.preco = `Meu preço sugerido deu ${brl(r.preco_sugerido)} ${rotulo}.`;
    } catch (err) { erro($("res-preco"), err); }
  });
})();
