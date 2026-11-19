"""Provedores de modelo para o agente: Claude (Anthropic), Gemini (Google) e OpenRouter (varios modelos).

Cada provedor guarda o historico no formato do seu fabricante e expoe a mesma interface:
  marca() / voltar(m) / adicionar_usuario(txt) / chamar(sistema, ferramentas) -> Resultado /
  adicionar_resultados([(id, nome, saida_json, erro)]) / podar(max_turnos)
O agente (agente.py) nao sabe qual fabricante esta por tras.
"""
import json
import os
import time
import urllib.error
import urllib.request


class Resultado:
    def __init__(self, texto="", chamadas=None, recusa=False, pausa=False):
        self.texto, self.chamadas, self.recusa, self.pausa = texto, chamadas or [], recusa, pausa


# ------------------------------------------------------------------ Claude
URL_CLAUDE = "https://api.anthropic.com/v1/messages"
VERSAO_API_CLAUDE = "2026-10-21"


class ProvedorClaude:
    """API de mensagens da Anthropic chamada direto por HTTP (urllib), sem biblioteca externa."""
    nome = "claude"
    COM_FALLBACK = {"claude-opus-5-5", "claude-sonnet-5-5"}   # modelos que aceitam fallback do servidor

    def __init__(self, transporte=None, modelo=None, chave=None, client=None):
        self.transporte = transporte or client or transporte_http   # 'client' mantido por compatibilidade
        self.modelo = modelo or os.environ.get("MEI_MODELO") or "claude-haiku-5-5"   # o mais barato basta para buscar e calcular
        self._chave = chave
        self.mensagens = []

    @staticmethod
    def disponivel():
        return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))

    @property
    def client(self):
        return self.transporte

    def _cabecalhos(self):
        h = {"Content-Type": "application/json", "anthropic-version": VERSAO_API_CLAUDE}
        chave = self._chave or os.environ.get("ANTHROPIC_API_KEY")
        if chave:
            h["x-api-key"] = chave
        elif os.environ.get("ANTHROPIC_AUTH_TOKEN"):
            h["Authorization"] = "Bearer " + os.environ["ANTHROPIC_AUTH_TOKEN"]
        return h

    def marca(self):
        return len(self.mensagens)

    def voltar(self, m):
        del self.mensagens[m:]

    def adicionar_usuario(self, texto):
        self.mensagens.append({"role": "user", "content": texto})

    def chamar(self, sistema, ferramentas):
        corpo = {"model": self.modelo, "max_tokens": 16000, "system": sistema, "tools": ferramentas,
                 "messages": self.mensagens, "output_config": {"effort": "medium"}}
        cab = self._cabecalhos()
        if self.modelo in self.COM_FALLBACK:          # se o modelo recusar, o servidor tenta outro modelo
            cab["anthropic-beta"] = "server-side-fallback-2026-07-01"
            corpo["fallbacks"] = "default"
        resp = self.transporte(URL_CLAUDE, cab, corpo)
        parada, blocos = resp.get("stop_reason"), resp.get("content") or []
        if parada == "refusal":
            return Resultado(recusa=True)
        self.mensagens.append({"role": "assistant", "content": blocos})   # devolvido inteiro na proxima chamada
        if parada == "pause_turn":
            return Resultado(pausa=True)
        usos = [b for b in blocos if b.get("type") == "tool_use"] if parada == "tool_use" else []
        return Resultado("".join(b.get("text", "") for b in blocos if b.get("type") == "text"),
                         [(b["id"], b["name"], b.get("input") or {}) for b in usos])

    def adicionar_resultados(self, resultados):
        itens = []
        for i, _nome, saida, erro in resultados:
            item = {"type": "tool_result", "tool_use_id": i, "content": saida}
            if erro:
                item["is_error"] = True
            itens.append(item)
        self.mensagens.append({"role": "user", "content": itens})

    def podar(self, max_turnos):
        inicios = [i for i, m in enumerate(self.mensagens) if m["role"] == "user" and isinstance(m["content"], str)]
        if len(inicios) > max_turnos:
            self.mensagens = self.mensagens[inicios[-max_turnos]:]


# ------------------------------------------------------------------ Gemini
URL_GEMINI = "https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent"
BLOQUEIOS = {"SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "IMAGE_SAFETY"}


def _tipos_gemini(sch):
    """Converte o JSON Schema (formato Claude) para o subconjunto aceito pelo Gemini."""
    if isinstance(sch, dict):
        out = {}
        for k, v in sch.items():
            if k in ("additionalProperties", "strict"):
                continue
            out[k] = v.upper() if k == "type" and isinstance(v, str) else _tipos_gemini(v)
        return out
    if isinstance(sch, list):
        return [_tipos_gemini(x) for x in sch]
    return sch


def ferramentas_gemini(ferramentas):
    decl = []
    for f in ferramentas:
        d = {"name": f["name"], "description": f["description"]}
        if f["input_schema"].get("properties"):          # funcao sem argumentos: sem 'parameters'
            d["parameters"] = _tipos_gemini({k: v for k, v in f["input_schema"].items() if k != "required" or v})
        decl.append(d)
    return [{"functionDeclarations": decl}]


def transporte_http(url, headers, corpo, tentativas=3):
    """POST JSON com poucas tentativas para 429/503 (limite de uso do plano gratuito)."""
    for n in range(tentativas):
        req = urllib.request.Request(url, data=json.dumps(corpo).encode("utf-8"), headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and n < tentativas - 1:
                time.sleep(2 * (n + 1))
                continue
            raise


class ProvedorGemini:
    nome = "gemini"

    def __init__(self, transporte=None, modelo=None, chave=None):
        self.transporte = transporte or transporte_http
        self.modelo = modelo or os.environ.get("GEMINI_MODELO") or os.environ.get("MEI_MODELO") or "gemini-3.8-flash"
        self._chave = chave
        self.mensagens = []   # 'contents' do Gemini

    @staticmethod
    def chave_env():
        return os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")

    @staticmethod
    def disponivel():
        return bool(ProvedorGemini.chave_env())

    def marca(self):
        return len(self.mensagens)

    def voltar(self, m):
        del self.mensagens[m:]

    def adicionar_usuario(self, texto):
        self.mensagens.append({"role": "user", "parts": [{"text": texto}]})

    def chamar(self, sistema, ferramentas):
        corpo = {"systemInstruction": {"parts": [{"text": sistema}]}, "contents": self.mensagens,
                 "tools": ferramentas_gemini(ferramentas), "toolConfig": {"functionCallingConfig": {"mode": "AUTO"}}}
        chave = self._chave or self.chave_env() or ""
        resp = self.transporte(URL_GEMINI.format(modelo=self.modelo), {"Content-Type": "application/json", "x-goog-api-key": chave}, corpo)
        cands = resp.get("candidates") or []
        if (resp.get("promptFeedback") or {}).get("blockReason") or not cands or cands[0].get("finishReason") in BLOQUEIOS:
            return Resultado(recusa=True)
        conteudo = cands[0].get("content") or {"role": "model", "parts": []}
        conteudo.setdefault("role", "model")
        self.mensagens.append(conteudo)          # devolvido inteiro depois: preserva thoughtSignature
        partes = conteudo.get("parts") or []
        chamadas = [((p["functionCall"].get("id") or f"fc_{n}"), p["functionCall"]["name"], p["functionCall"].get("args") or {})
                    for n, p in enumerate(partes) if "functionCall" in p]
        texto = "".join(p.get("text", "") for p in partes if "functionCall" not in p and not p.get("thought"))
        return Resultado(texto, chamadas)

    def adicionar_resultados(self, resultados):
        partes = []
        for i, nome, saida, erro in resultados:
            try:
                dados = json.loads(saida)
            except ValueError:
                dados = saida
            fr = {"name": nome, "response": {"error": dados} if erro else {"result": dados}}
            if not str(i).startswith("fc_"):
                fr["id"] = i
            partes.append({"functionResponse": fr})
        self.mensagens.append({"role": "user", "parts": partes})

    def podar(self, max_turnos):
        inicios = [i for i, m in enumerate(self.mensagens) if m["role"] == "user" and m["parts"] and "text" in m["parts"][0]]
        if len(inicios) > max_turnos:
            self.mensagens = self.mensagens[inicios[-max_turnos]:]


# ------------------------------------------------------------------ OpenRouter
URL_OPENROUTER = "https://openrouter.ai/api/v1/chat/completions"


def ferramentas_openai(ferramentas):
    """Formato 'tools' da API de chat da OpenAI, que o OpenRouter usa para todos os modelos."""
    return [{"type": "function", "function": {"name": f["name"], "description": f["description"], "parameters": f["input_schema"]}}
            for f in ferramentas]


class ProvedorOpenRouter:
    """Um so formato (o da OpenAI) para centenas de modelos: o slug escolhe o fabricante, ex. anthropic/claude-sonnet-5.5."""
    nome = "openrouter"
    PADRAO = "anthropic/claude-sonnet-5.5"

    def __init__(self, transporte=None, modelo=None, chave=None):
        self.transporte = transporte or transporte_http
        self.modelo = modelo or os.environ.get("OPENROUTER_MODELO") or self.PADRAO
        self._chave = chave
        self.mensagens = []   # 'messages' sem o system (vai na frente a cada chamada)

    @staticmethod
    def chave_env():
        return os.environ.get("OPENROUTER_API_KEY")

    @staticmethod
    def disponivel():
        return bool(ProvedorOpenRouter.chave_env())

    def marca(self):
        return len(self.mensagens)

    def voltar(self, m):
        del self.mensagens[m:]

    def adicionar_usuario(self, texto):
        self.mensagens.append({"role": "user", "content": texto})

    def chamar(self, sistema, ferramentas):
        corpo = {"model": self.modelo, "max_tokens": 4096, "messages": [{"role": "system", "content": sistema}] + self.mensagens,
                 "tools": ferramentas_openai(ferramentas), "tool_choice": "auto"}
        chave = self._chave or self.chave_env() or ""
        resp = self.transporte(URL_OPENROUTER, {"Content-Type": "application/json", "Authorization": f"Bearer {chave}"}, corpo)
        if resp.get("error"):                      # o OpenRouter pode devolver erro do modelo com HTTP 200
            raise RuntimeError(str((resp["error"] or {}).get("message") or resp["error"])[:200])
        escolha = (resp.get("choices") or [None])[0]
        if not escolha:
            raise RuntimeError("resposta vazia do OpenRouter")
        if escolha.get("error"):
            raise RuntimeError(str((escolha["error"] or {}).get("message") or escolha["error"])[:200])
        msg = escolha.get("message") or {}
        if escolha.get("finish_reason") == "content_filter" or msg.get("refusal"):
            return Resultado(recusa=True)
        chamadas_brutas = msg.get("tool_calls") or []
        texto = msg.get("content") or ""
        if isinstance(texto, list):                # alguns modelos devolvem partes em vez de string
            texto = "".join(p.get("text", "") for p in texto if isinstance(p, dict))
        # com tool_calls e sem texto, content vai null: bloco de texto vazio e recusado por alguns fabricantes
        guardar = {"role": "assistant", "content": texto or (None if chamadas_brutas else "")}
        if msg.get("reasoning_details"):           # devolvido intacto: alguns modelos exigem no uso de ferramentas
            guardar["reasoning_details"] = msg["reasoning_details"]
        chamadas = []
        if chamadas_brutas:
            guardar["tool_calls"] = []
            for n, c in enumerate(chamadas_brutas):
                fn = c.get("function") or {}
                cid = c.get("id") or f"call_{len(self.mensagens)}_{n}"
                try:
                    args = json.loads(fn.get("arguments") or "{}")
                except ValueError:
                    args = {}
                guardar["tool_calls"].append({"id": cid, "type": "function", "function": {"name": fn.get("name", ""), "arguments": fn.get("arguments") or "{}"}})
                chamadas.append((cid, fn.get("name", ""), args if isinstance(args, dict) else {}))
        self.mensagens.append(guardar)
        return Resultado(texto, chamadas)

    def adicionar_resultados(self, resultados):
        for i, nome, saida, _erro in resultados:
            self.mensagens.append({"role": "tool", "tool_call_id": i, "name": nome, "content": saida})

    def podar(self, max_turnos):
        inicios = [i for i, m in enumerate(self.mensagens) if m["role"] == "user"]
        if len(inicios) > max_turnos:
            self.mensagens = self.mensagens[inicios[-max_turnos]:]


def escolher(client=None, modelo=None):
    """MEI_PROVEDOR=claude|gemini|openrouter; sem ele, o que tiver chave, comecando pelo Gemini (tem plano gratuito)."""
    pref = (os.environ.get("MEI_PROVEDOR") or "").lower()
    if client is not None or pref == "claude":
        return ProvedorClaude(client=client, modelo=modelo)
    if pref == "openrouter":
        return ProvedorOpenRouter(modelo=modelo)
    if pref == "gemini" or ProvedorGemini.disponivel():
        return ProvedorGemini(modelo=modelo)
    if ProvedorOpenRouter.disponivel():
        return ProvedorOpenRouter(modelo=modelo)
    return ProvedorClaude(modelo=modelo)


def disponivel():
    pref = (os.environ.get("MEI_PROVEDOR") or "").lower()
    if pref == "gemini":
        return ProvedorGemini.disponivel()
    if pref == "claude":
        return ProvedorClaude.disponivel()
    if pref == "openrouter":
        return ProvedorOpenRouter.disponivel()
    return ProvedorClaude.disponivel() or ProvedorGemini.disponivel() or ProvedorOpenRouter.disponivel()
