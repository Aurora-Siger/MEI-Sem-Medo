"""Testes do servidor com agente simulado. Execute: python tests/test_servidor.py"""
import json
import sys
import threading
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
import servidor  # noqa: E402

falhas = 0


def ok(c, n):
    global falhas
    print(f"[{'OK' if c else 'FALHA'}] {n}")
    falhas += 0 if c else 1


class AgenteFalso:
    def __init__(self, base):
        self.n = 0

    def perguntar(self, t):
        self.n += 1
        return {"texto": f"eco {self.n}: {t}", "fontes": [], "ferramentas": [], "modo": "agente", "tempo_ms": 1}


def chamar(url, corpo=None, headers=None, metodo=None):
    req = urllib.request.Request(url, data=None if corpo is None else (corpo if isinstance(corpo, bytes) else json.dumps(corpo).encode()),
                                 headers={"Content-Type": "application/json", **(headers or {})}, method=metodo)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def subir(disponivel, fabrica=AgenteFalso):
    s = servidor.criar_servidor("127.0.0.1", 0, fabrica=fabrica, disponivel=lambda: disponivel)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s, f"http://127.0.0.1:{s.server_address[1]}"


s, u = subir(True)
st, b = chamar(u + "/api/status")
ok(st == 200 and json.loads(b)["agente"] is True, "status: agente ativo")
st, b = chamar(u + "/")
ok(st == 200 and b"MEI sem Medo" in b, "serve o site")
st, _ = chamar(u + "/../src/agente.py")
ok(st in (400, 403, 404), "sem path traversal")
st, b = chamar(u + "/api/agente", {"sessao": "sessao-teste-1", "mensagem": "oi"})
ok(st == 200 and json.loads(b)["texto"] == "eco 1: oi", "pergunta ao agente")
st, b = chamar(u + "/api/agente", {"sessao": "sessao-teste-1", "mensagem": "de novo"})
ok(json.loads(b)["texto"].startswith("eco 2"), "mesma sessao reaproveita o agente (memoria)")
ok(chamar(u + "/api/agente", {"sessao": "x", "mensagem": "oi"})[0] == 400, "sessao invalida rejeitada")
ok(chamar(u + "/api/agente", b"nao e json")[0] == 400, "JSON invalido rejeitado")
ok(chamar(u + "/api/agente", {"sessao": "sessao-teste-1", "mensagem": "a" * 5000})[0] == 413, "corpo grande rejeitado")
ok(chamar(u + "/api/agente", {"sessao": "sessao-teste-1", "mensagem": "oi"}, {"Origin": "http://site-malicioso.com"})[0] == 403, "origem externa bloqueada")
codigos = [chamar(u + "/api/agente", {"sessao": "sessao-teste-2", "mensagem": "x"})[0] for _ in range(25)]
ok(429 in codigos, "limite de requisicoes por minuto")
s.shutdown()

s, u = subir(False)
st, b = chamar(u + "/api/status")
ok(json.loads(b)["agente"] is False, "status: sem chave")
st, b = chamar(u + "/api/agente", {"sessao": "sessao-teste-1", "mensagem": "oi"})
ok(st == 503 and json.loads(b)["modo"] == "base", "sem chave: 503 e o site usa a base")
s.shutdown()

# chave digitada no site: provedor e modelo chegam a fabrica
criados = []


def fabrica_registra(base, provedor=None, chave=None, modelo=None):
    criados.append((provedor, chave, modelo))
    return AgenteFalso(base)


s, u = subir(False, fabrica_registra)
CHAVE_OR = "sk-or-v1-" + "a" * 64
cab = {"X-Chave-IA": CHAVE_OR, "X-Provedor-IA": "openrouter", "X-Modelo-IA": "anthropic/claude-sonnet-5.5"}
st, b = chamar(u + "/api/agente", {"sessao": "sessao-teste-3", "mensagem": "oi"}, cab)
ok(st == 200 and criados[-1] == ("openrouter", CHAVE_OR, "anthropic/claude-sonnet-5.5"), "OpenRouter: chave e modelo do site chegam ao agente")
st, b = chamar(u + "/api/agente", {"sessao": "sessao-teste-3", "mensagem": "oi"}, {**cab, "X-Modelo-IA": "openai/gpt-6-sol"})
ok(st == 200 and json.loads(b)["texto"].startswith("eco 1") and criados[-1][2] == "openai/gpt-6-sol", "OpenRouter: trocar o modelo cria agente novo")
st, _ = chamar(u + "/api/agente", {"sessao": "sessao-teste-3", "mensagem": "oi"}, {k: v for k, v in cab.items() if k != "X-Modelo-IA"})
ok(st == 200 and criados[-1][2] is None, "OpenRouter: sem modelo usa o padrao")
ok(chamar(u + "/api/agente", {"sessao": "sessao-teste-3", "mensagem": "oi"}, {**cab, "X-Modelo-IA": "a b"})[0] == 400, "OpenRouter: modelo invalido rejeitado")
ok(chamar(u + "/api/agente", {"sessao": "sessao-teste-3", "mensagem": "oi"}, {**cab, "X-Provedor-IA": "openai"})[0] == 400, "provedor desconhecido rejeitado")
st, _ = chamar(u + "/api/agente", {"sessao": "sessao-teste-3", "mensagem": "oi"}, {**cab, "X-Provedor-IA": "gemini"})
ok(st == 200 and criados[-1] == ("gemini", CHAVE_OR, None), "modelo so vale para o OpenRouter")
s.shutdown()
print(f"\nServidor: {'tudo OK' if not falhas else str(falhas) + ' falha(s)'}")
sys.exit(1 if falhas else 0)
