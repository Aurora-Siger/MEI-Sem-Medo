"""Provedores de modelo para o agente: Claude (Anthropic) e Gemini (Google).

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
class ProvedorClaude:
    nome = "claude"
    COM_FALLBACK = {"claude-opus-5-5", "claude-sonnet-5-5"}   # modelos que aceitam fallback do servidor

    def __init__(self, client=None, modelo=None):
        self._client = client
        self.modelo = modelo or os.environ.get("MEI_MODELO") or "claude-opus-5-5"
        self.mensagens = []

    @staticmethod
    def disponivel():
        return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))

    @property
    def client(self):
        if self._client is None:
            import anthropic
            self._client = anthropic.Anthropic()
        return self._client

    def marca(self):
        return len(self.mensagens)

    def voltar(self, m):
        del self.mensagens[m:]

    def adicionar_usuario(self, texto):
        self.mensagens.append({"role": "user", "content": texto})

    def chamar(self, sistema, ferramentas):
        kw = dict(model=self.modelo, max_tokens=16000, system=sistema, tools=ferramentas, messages=self.mensagens,
                  output_config={"effort": "medium"})
        if self.modelo in self.COM_FALLBACK:
            kw.update(betas=["server-side-fallback-2026-07-01"], fallbacks="default")
        resp = self.client.beta.messages.create(**kw)
        if resp.stop_reason == "refusal":
            return Resultado(recusa=True)
        self.mensagens.append({"role": "assistant", "content": resp.content})
        if resp.stop_reason == "pause_turn":
            return Resultado(pausa=True)
        usos = [b for b in resp.content if b.type == "tool_use"] if resp.stop_reason == "tool_use" else []
        return Resultado("".join(b.text for b in resp.content if b.type == "text"), [(b.id, b.name, b.input) for b in usos])

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
        self.modelo = modelo or os.environ.get("GEMINI_MODELO") or os.environ.get("MEI_MODELO") or "gemini-2.5-flash"
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


def escolher(client=None, modelo=None):
    """MEI_PROVEDOR=claude|gemini; sem ele, usa o que tiver chave (Claude primeiro)."""
    pref = (os.environ.get("MEI_PROVEDOR") or "").lower()
    if pref == "gemini" or (not pref and not ProvedorClaude.disponivel() and ProvedorGemini.disponivel() and client is None):
        return ProvedorGemini(modelo=modelo)
    return ProvedorClaude(client=client, modelo=modelo)


def disponivel():
    pref = (os.environ.get("MEI_PROVEDOR") or "").lower()
    if pref == "gemini":
        return ProvedorGemini.disponivel()
    if pref == "claude":
        return ProvedorClaude.disponivel()
    return ProvedorClaude.disponivel() or ProvedorGemini.disponivel()
