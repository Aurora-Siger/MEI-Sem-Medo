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
 cred:M.simularCreditos(20000,10000,8000,26.5,2000,15)};
console.log(JSON.stringify(out));
"""
r = subprocess.run(["node", "-e", js, str(raiz), json.dumps([c[0] for c in CASOS])], capture_output=True, text=True, check=True)
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
print(f"Paridade JS x Python: {len(CASOS)} perguntas + 4 DAS + simulacao de creditos -> {'OK' if not falhas else str(falhas) + ' divergencias'}")
sys.exit(1 if falhas else 0)
