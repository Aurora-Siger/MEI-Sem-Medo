"""Testes do agente com um cliente SIMULADO (nao gasta API). Execute: python tests/test_agente.py

Verificam o comportamento que importa: o agente chama ferramentas, so responde com fonte real da base,
remove citacoes inventadas, bloqueia resposta sem base, remove dados pessoais e nunca derruba o app.
"""
import json
import sys
from pathlib import Path
from types import SimpleNamespace as NS

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
import agente  # noqa: E402
import sistema  # noqa: E402


def texto(t):
    return NS(type="text", text=t)


def uso(i, nome, **args):
    return NS(type="tool_use", id=f"tu_{i}", name=nome, input=args)


def resp(stop, *blocos):
    return NS(stop_reason=stop, content=list(blocos))


class ClienteFalso:
    """Devolve respostas roteirizadas e guarda o que o agente enviou."""

    def __init__(self, *roteiro, erro=None):
        self.roteiro, self.chamadas, self.erro = list(roteiro), [], erro
        self.beta = NS(messages=NS(create=self._create))

    def _create(self, **kw):
        self.chamadas.append({**kw, "messages": json.loads(json.dumps(kw["messages"], default=lambda o: "<bloco>"))})
        if self.erro:
            raise self.erro
        return self.roteiro.pop(0) if len(self.roteiro) > 1 else self.roteiro[0]


BASE = sistema.carregar()
falhas = 0


def ok(cond, nome):
    global falhas
    print(f"[{'OK' if cond else 'FALHA'}] {nome}")
    falhas += 0 if cond else 1


# 1. fluxo normal: busca na base, responde citando registro real
c = ClienteFalso(resp("tool_use", uso(1, "buscar_base", consulta="limite de faturamento do MEI")),
                 resp("end_turn", texto("O limite é R$ 81.000 por ano [M1].")))
r = agente.Agente(BASE, c).perguntar("Qual o limite do MEI?")
ok(r["modo"] == "agente" and r["ferramentas"] == ["buscar_base"] and r["fontes"][0]["id"] == "M1" and r["fontes"][0]["url"].startswith("http"), "fluxo normal: ferramenta + fonte vinda da base")
k = c.chamadas[0]
ok(k["model"] == "claude-opus-5-5" and all(t.get("strict") for t in k["tools"]) and k["betas"] and k["fallbacks"] == "default" and "temperature" not in k and "thinking" not in k,
   "requisicao: modelo, strict, fallback do servidor, sem parametros removidos")

# 2. citacao inventada e removida; a valida fica
c = ClienteFalso(resp("tool_use", uso(1, "buscar_base", consulta="limite MEI")), resp("end_turn", texto("Limite R$ 81 mil [M1] e outra coisa [Z9].")))
r = agente.Agente(BASE, c).perguntar("limite do MEI")
ok("[Z9]" not in r["texto"] and [f["id"] for f in r["fontes"]] == ["M1"], "citacao inventada removida")

# 3. responde sem usar ferramenta (conhecimento proprio) -> bloqueado
c = ClienteFalso(resp("end_turn", texto("O passaporte custa R$ 257.")))
r = agente.Agente(BASE, c).perguntar("como tirar passaporte")
ok(r["modo"] == "bloqueado" and r["texto"] == agente.NAO_SEI and not r["fontes"], "sem ferramenta/sem fonte: bloqueado")

# 4. buscou, base nao cobre, modelo responde sem citar -> bloqueado e historico limpo
c = ClienteFalso(resp("tool_use", uso(1, "buscar_base", consulta="passaporte")), resp("end_turn", texto("Custa R$ 257.")))
ag = agente.Agente(BASE, c)
r = ag.perguntar("passaporte")
ok(r["modo"] == "bloqueado" and ag.mensagens == [], "base sem cobertura: bloqueado e fora do historico")

# 5. calculadora: usa ferramenta de calculo, aviso de estimativa
c = ClienteFalso(resp("tool_use", uso(1, "analisar_mei", atividade="servicos", meses_no_ano=12, faturado=60000, meses_restantes=6, media_prevista=6000)),
                 resp("end_turn", texto("Você passaria do limite em R$ 15.000.")))
r = agente.Agente(BASE, c).perguntar("vou estourar o MEI?")
ret = json.loads(c.chamadas[1]["messages"][-1]["content"][0]["content"])
ok(r["modo"] == "agente" and ret["status"] == "ate_20" and "estimativas" in r["texto"], "calculadora do MEI via ferramenta + aviso de estimativa")

# 6. registro 'confirmar' gera aviso
c = ClienteFalso(resp("tool_use", uso(1, "obter_registro", id="R5")), resp("end_turn", texto("Depende da regulamentação [R5].")))
r = agente.Agente(BASE, c).perguntar("simples hibrido")
ok("confirme em canal oficial" in r["texto"] and r["fontes"][0]["confianca"] == "confirmar", "registro 'confirmar' mostra aviso")

# 7. dados pessoais removidos antes de ir para a API
c = ClienteFalso(resp("end_turn", texto("x")))
agente.Agente(BASE, c).perguntar("meu CPF 123.456.789-09 e e-mail ana@exemplo.com, tel (11) 91234-5678, limite MEI?")
enviado = c.chamadas[0]["messages"][0]["content"]
ok(not any(x in enviado for x in ("123.456", "ana@", "91234")) and "[CPF removido]" in enviado, "PII removido antes da API")

# 8. falha da API nao derruba e nao suja o historico
ag = agente.Agente(BASE, ClienteFalso(resp("end_turn", texto("x")), erro=ConnectionError("sem rede")))
r = ag.perguntar("limite do MEI")
ok(r["modo"] == "erro" and r["erro"] == "ConnectionError" and ag.mensagens == [], "erro de API tratado")

# 9. recusa de seguranca
ag = agente.Agente(BASE, ClienteFalso(resp("refusal", texto(""))))
ok(ag.perguntar("algo")["modo"] == "recusa" and ag.mensagens == [], "stop_reason refusal tratado")

# 10. laco infinito de ferramentas e interrompido
ag = agente.Agente(BASE, ClienteFalso(resp("tool_use", uso(1, "listar_temas"))))
r = ag.perguntar("temas")
ok(r["modo"] == "erro" and len(ag.client.chamadas) == agente.MAX_PASSOS, "limite de passos")

# 11. entrada vazia/longa nem chamam a API
c = ClienteFalso(resp("end_turn", texto("x")))
ag = agente.Agente(BASE, c)
ok(ag.perguntar("  ")["modo"] == "vazia" and ag.perguntar("a" * 501)["modo"] == "invalida" and not c.chamadas, "vazia/longa sem chamar a API")

# 12. entrada invalida de ferramenta vira is_error e o modelo continua
c = ClienteFalso(resp("tool_use", uso(1, "calcular_das", anexo="I", rbt12=-5, receita_mes=1000, folha12=0)), resp("end_turn", texto("Qual foi sua receita dos últimos meses?")))
r = agente.Agente(BASE, c).perguntar("calcular das")
res = c.chamadas[1]["messages"][-1]["content"][0]
ok(res.get("is_error") is True and "erro" in res["content"], "erro de ferramenta devolvido ao modelo (is_error)")
ok(r["modo"] == "agente" and r["texto"].endswith("?") and not r["fontes"], "pergunta de esclarecimento permitida (sem afirmar nada)")
c = ClienteFalso(resp("tool_use", uso(1, "calcular_das", anexo="I", rbt12=-5, receita_mes=1000, folha12=0)), resp("end_turn", texto("O DAS é R$ 100.")))
ok(agente.Agente(BASE, c).perguntar("das")["modo"] == "bloqueado", "calculo que falhou nao libera resposta com numeros")

# 13. poda do historico
ag = agente.Agente(BASE, ClienteFalso(resp("tool_use", uso(1, "buscar_base", consulta="limite MEI")), resp("end_turn", texto("ok [M1]")))) 
ag.client.roteiro = [resp("tool_use", uso(1, "buscar_base", consulta="limite MEI")), resp("end_turn", texto("ok [M1]"))] * 20
for _ in range(12):
    ag.perguntar("limite MEI")
inicios = [m for m in ag.mensagens if m["role"] == "user" and isinstance(m["content"], str)]
ok(len(inicios) == agente.MAX_TURNOS, "historico podado em turnos inteiros")

# 14. modelo sem suporte a fallback nao recebe o parametro
c = ClienteFalso(resp("end_turn", texto("x")))
agente.Agente(BASE, c, modelo="claude-haiku-5-5").perguntar("limite MEI")
ok("fallbacks" not in c.chamadas[0], "fallback so para modelos que suportam")

print(f"\nAgente: {'tudo OK' if not falhas else str(falhas) + ' falha(s)'}")
sys.exit(1 if falhas else 0)
