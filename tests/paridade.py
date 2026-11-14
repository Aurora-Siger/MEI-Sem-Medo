"""Garante que o motor JS (web/motor.js) e o Python dao os mesmos resultados. Requer node. Execute: python tests/paridade.py"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

raiz = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(raiz / "src"))
sys.path.insert(0, str(raiz / "tests"))
import calculadora  # noqa: E402
import sistema  # noqa: E402
from testes import CASOS  # noqa: E402

if not shutil.which("node"):
    print("node nao encontrado: teste de paridade ignorado")
    sys.exit(0)

base = sistema.carregar()
js = """
const M=require(process.argv[1]+'/web/motor.js');const base=require(process.argv[1]+'/data/base.json');
const casos=JSON.parse(process.argv[2]);
const out={busca:casos.map(q=>{const r=M.perguntar(base,q);return [r.status,r.registro?r.registro.id:null]}),
 das:[['I',300000,30000,0],['V',300000,30000,90000],['II',4800000,100000,0],['IV',90000,8000,0]].map(a=>M.calcularDas(...a).das),
 cred:M.simularCreditos(20000,10000,8000,26.5,2000,15),
 preco:{p:[[20,1500,100,5,0,20,40],[8,600,50,12,6,15,null],[30,2000,40,3,0,25,25]].map(a=>M.precoProduto(...a)),s:[[3000,800,100,2,10,0,0,10,null],[2000,500,80,1.5,0,5,6,10,150]].map(a=>M.precoServico(...a))},
 mei:[['comercio',12,40000,6,6000],['servicos',12,60000,6,6000],['servicos',12,70000,6,9000],['servicos',6,30000,2,9000]].map(a=>M.analisarMei(...a)),
 hib:JSON.parse(process.argv[3]).map(a=>M.simularPuroHibrido(...a)),
 hist:M.projetarHistorico(JSON.parse(process.argv[4]),JSON.parse(process.argv[5])),
 base:M.mesesBaseRbt12('2026-11',301234.57)};
console.log(JSON.stringify(out));
"""
# Simples puro x hibrido: (anexo, rbt12, receita, ano, compras, cbs, ibs, reducao, b2b, folha, saldo)
HIB = [["III", 300000, 30000, 2033, 8000, 8.8, 17.7, 0, 50, 0, 0], ["I", 500000, 45000, 2027, 30000, 8.8, 17.7, 0, 80, 0, 0],
       ["II", 1200000, 100000, 2030, 70000, 9.0, 18.0, 30, 100, 0, 1500], ["III", 3000000, 250000, 2031, 0, 8.8, 17.7, 60, 0, 0, 0],
       ["V", 600000, 50000, 2029, 5000, 8.8, 17.7, 0, 20, 200000, 0], ["IV", 4000000, 300000, 2033, 50000, 8.8, 17.7, 0, 0, 0, 0],
       ["I", 200000, 20000, 2026, 10000, 8.8, 17.7, 0, 0, 0, 0]]
HIST = calculadora.meses_base_rbt12("2026-11", 420000)
_m = "2026-11"
for _k in range(30):
    HIST.append({"mes": _m, "receita": 35000 + 750 * _k, "compras": 31000 + 400 * _k, "tipo": "previsao"})
    _m = calculadora.somar_meses(_m, 1)
HIST_CFG = {"anexo": "I", "folha12": 0, "aliq_cbs": 8.8, "aliq_ibs": 17.7, "reducao_setor": 0, "pct_b2b": 70}
r = subprocess.run(["node", "-e", js, str(raiz), json.dumps([c[0] for c in CASOS]), json.dumps(HIB), json.dumps(HIST), json.dumps(HIST_CFG)],
                   capture_output=True, text=True, check=True)
out = json.loads(r.stdout)
falhas = 0
for (perg, *_), (st, rid) in zip(CASOS, out["busca"]):
    p = sistema.perguntar(base, perg)
    if (p["status"], p["id"]) != (st, rid):
        falhas += 1
        print(f"[DIVERGE] {perg!r}: py={p['status']}/{p['id']} js={st}/{rid}")
das_py = [calculadora.calcular_das(*a)["das"] for a in [("I", 300000, 30000, 0), ("V", 300000, 30000, 90000), ("II", 4800000, 100000, 0), ("IV", 90000, 8000, 0)]]
if das_py != out["das"]:
    falhas += 1
    print("[DIVERGE] DAS", das_py, out["das"])
c = calculadora.simular_creditos(20000, 10000, 8000, 26.5, 2000, 15)
for k in ("custo_total_regular", "diferenca", "credito_perdido_pelo_cliente", "credito_compras_nao_aproveitado"):
    if abs(c[k] - out["cred"][k]) > 0.01:
        falhas += 1
        print("[DIVERGE] credito", k, c[k], out["cred"][k])
mei_py = [calculadora.analisar_mei(*a) for a in [("comercio", 12, 40000, 6, 6000), ("servicos", 12, 60000, 6, 6000), ("servicos", 12, 70000, 6, 9000), ("servicos", 6, 30000, 2, 9000)]]
for py, jsr in zip(mei_py, out["mei"]):
    for k in ("das_mensal", "limite_ano", "projecao", "excesso", "status", "custo_anual_microempresa", "maximo_por_mes_restante", "das_complementar_estimado"):
        if py[k] != jsr[k] and not (isinstance(py[k], float) and abs(py[k] - jsr[k]) < 0.011):
            falhas += 1
            print("[DIVERGE] MEI", k, py[k], jsr[k])


def _difere(a, b, caminho=""):
    """Compara resultados (dict/list/numero) com tolerancia de 1 centavo; devolve a lista de caminhos divergentes."""
    if isinstance(a, dict) and isinstance(b, dict):
        return [d for k in set(a) | set(b) for d in _difere(a.get(k), b.get(k), f"{caminho}.{k}")]
    if isinstance(a, list) and isinstance(b, list):
        return [f"{caminho}[len]"] if len(a) != len(b) else [d for i, (x, y) in enumerate(zip(a, b)) for d in _difere(x, y, f"{caminho}[{i}]")]
    if isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool):
        return [] if abs(a - b) <= 0.011 else [f"{caminho}: py={a} js={b}"]
    return [] if a == b else [f"{caminho}: py={a!r} js={b!r}"]


for a, jsr in zip(HIB, out["hib"]):
    for d in _difere(calculadora.simular_puro_hibrido(*a), jsr, f"hibrido{a[:4]}"):
        falhas += 1
        print("[DIVERGE]", d)
for d in _difere(calculadora.projetar_historico(HIST, HIST_CFG), out["hist"], "historico") +         _difere(calculadora.meses_base_rbt12("2026-11", 301234.57), out["base"], "base"):
    falhas += 1
    print("[DIVERGE]", d)
PRECO_P = [(20, 1500, 100, 5, 0, 20, 40), (8, 600, 50, 12, 6, 15, None), (30, 2000, 40, 3, 0, 25, 25)]
PRECO_S = [(3000, 800, 100, 2, 10, 0, 0, 10, None), (2000, 500, 80, 1.5, 0, 5, 6, 10, 150)]
for py, jsr in zip([calculadora.preco_produto(*a) for a in PRECO_P] + [calculadora.preco_servico(*a) for a in PRECO_S], out["preco"]["p"] + out["preco"]["s"]):
    if json.dumps(py, sort_keys=True) != json.dumps(jsr, sort_keys=True) and any(abs(py[k] - jsr[k]) > 0.011 for k in ("preco_sugerido", "preco_minimo", "lucro_mensal_estimado") if k in py and k in jsr):
        falhas += 1
        print("[DIVERGE] preco", py["preco_sugerido"], jsr["preco_sugerido"])
print(f"Paridade JS x Python: {len(CASOS)} perguntas + 4 DAS + creditos + 4 cenarios MEI + 5 de preco + {len(HIB)} puro x hibrido"
      f" + historico de {len(HIST)} meses -> {'OK' if not falhas else str(falhas) + ' divergencias'}")
sys.exit(1 if falhas else 0)
