"""Servidor local do MEI sem Medo: serve o site (web/) e expoe o agente de IA em /api.

A chave da API fica SOMENTE aqui (variavel ANTHROPIC_API_KEY); o navegador nunca a ve.
Uso: ANTHROPIC_API_KEY=... (ou GEMINI_API_KEY=... MEI_PROVEDOR=gemini) python src/servidor.py [--host 127.0.0.1] [--port 8000]
Sem chave, o site continua funcionando no modo "base verificada" (busca por palavras-chave).
Para uso publico: coloque atras de autenticacao e defina limite de gasto na conta da API.
"""
import hashlib
import json
import os
import re
import sys
import threading
import time
from collections import defaultdict, deque
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import agente  # noqa: E402
import provedores  # noqa: E402
import sistema  # noqa: E402

def carregar_env(caminho=None):
    """Le KEY=valor de .env (raiz do projeto) sem sobrescrever variaveis ja definidas no ambiente."""
    caminho = caminho or Path(__file__).resolve().parent.parent / ".env"
    try:
        linhas = Path(caminho).read_text(encoding="utf-8").splitlines()
    except OSError:
        return
    for ln in linhas:
        ln = ln.strip()
        if not ln or ln.startswith("#") or "=" not in ln:
            continue
        k, v = ln.split("=", 1)
        k, v = k.strip().removeprefix("export ").strip(), v.strip().strip('"').strip("'")
        if k and v:
            os.environ.setdefault(k, v)


WEB = Path(__file__).resolve().parent.parent / "web"
LIMITE_CORPO = 4096
JANELA_S, LIMITE_REQ = 60, 20       # por IP
MAX_SESSOES, TTL_S = 200, 1800
SESSAO_RX = re.compile(r"^[A-Za-z0-9_-]{8,64}$")
CHAVE_RX = re.compile(r"^[A-Za-z0-9_.\-]{16,256}$")


def fabrica_padrao(base, provedor=None, chave=None):
    """Agente com a chave do .env/ambiente, ou com a chave digitada no site (so existe nesta requisicao e na sessao)."""
    if not chave:
        return agente.Agente(base)
    if provedor == "claude":
        import anthropic
        return agente.Agente(base, provedor=provedores.ProvedorClaude(client=anthropic.Anthropic(api_key=chave)))
    return agente.Agente(base, provedor=provedores.ProvedorGemini(chave=chave))


class Estado:
    def __init__(self, fabrica):
        self.fabrica, self.base = fabrica, sistema.carregar()
        self.sessoes, self.hits, self.lock = {}, defaultdict(deque), threading.Lock()

    def permitido(self, ip):
        agora = time.time()
        with self.lock:
            q = self.hits[ip]
            while q and agora - q[0] > JANELA_S:
                q.popleft()
            if len(q) >= LIMITE_REQ:
                return False
            q.append(agora)
            return True

    def agente(self, sid, provedor=None, chave=None):
        if chave:   # a sessao e amarrada a chave: trocar a chave no site cria um agente novo
            sid = sid + hashlib.sha256((provedor + chave).encode()).hexdigest()[:12]
        agora = time.time()
        with self.lock:
            for k in [k for k, (_, t) in self.sessoes.items() if agora - t > TTL_S]:
                del self.sessoes[k]
            if sid not in self.sessoes and len(self.sessoes) >= MAX_SESSOES:
                return None
            ag = self.sessoes.get(sid, (None,))[0] or (self.fabrica(self.base, provedor, chave) if chave else self.fabrica(self.base))
            self.sessoes[sid] = (ag, agora)
            return ag


def criar_servidor(host="127.0.0.1", port=8000, fabrica=None, disponivel=None):
    fabrica = fabrica or fabrica_padrao
    estado = Estado(fabrica)
    ativo = disponivel if disponivel is not None else agente.Agente.disponivel

    class H(SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=str(WEB), **k)

        def log_message(self, fmt, *args):   # nao registra perguntas nem IPs
            pass

        def _json(self, codigo, obj):
            corpo = json.dumps(obj, ensure_ascii=False).encode("utf-8")
            self.send_response(codigo)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(corpo)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(corpo)

        def do_GET(self):
            if self.path == "/api/status":
                return self._json(200, {"agente": bool(ativo()), "modelo": agente.modelo_ativo() if ativo() else None, "aceita_chave": True})
            return super().do_GET()

        def do_POST(self):
            if self.path != "/api/agente":
                return self._json(404, {"erro": "nao encontrado"})
            origem = self.headers.get("Origin")
            if origem and origem.split("://", 1)[-1] != self.headers.get("Host"):
                return self._json(403, {"erro": "origem nao permitida"})
            chave = (self.headers.get("X-Chave-IA") or "").strip()
            provedor = (self.headers.get("X-Provedor-IA") or "gemini").strip().lower()
            if chave and (provedor not in ("gemini", "claude") or not CHAVE_RX.match(chave)):
                return self._json(400, {"erro": "chave ou provedor invalido"})
            if not chave and not ativo():
                return self._json(503, {"erro": "agente indisponivel", "modo": "base"})
            if not estado.permitido(self.client_address[0]):
                return self._json(429, {"erro": "muitas perguntas; aguarde um minuto"})
            try:
                n = int(self.headers.get("Content-Length", "0"))
                if not 0 < n <= LIMITE_CORPO:
                    return self._json(413, {"erro": "corpo invalido ou grande demais"})
                dados = json.loads(self.rfile.read(n))
                sid, msg = dados["sessao"], dados["mensagem"]
                if not isinstance(sid, str) or not SESSAO_RX.match(sid) or not isinstance(msg, str):
                    raise ValueError
            except (ValueError, KeyError, TypeError, json.JSONDecodeError):
                return self._json(400, {"erro": "requisicao invalida"})
            ag = estado.agente(sid, provedor, chave)
            if ag is None:
                return self._json(503, {"erro": "servidor ocupado"})
            return self._json(200, ag.perguntar(msg))

    srv = ThreadingHTTPServer((host, port), H)
    srv.daemon_threads = True
    return srv


def main():
    carregar_env()
    a = sys.argv
    host = a[a.index("--host") + 1] if "--host" in a else "127.0.0.1"
    port = int(a[a.index("--port") + 1]) if "--port" in a else 8000
    srv = criar_servidor(host, port)
    modo = f"agente de IA ({agente.modelo_ativo()})" if agente.Agente.disponivel() else "base verificada (sem chave de API)"
    print(f"MEI sem Medo em http://{host}:{port}  ·  modo: {modo}  ·  Ctrl+C encerra")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
