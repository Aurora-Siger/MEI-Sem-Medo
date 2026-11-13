"""Gera web/base.js a partir de data/base.json (rode depois de editar a base)."""
import json
from pathlib import Path

raiz = Path(__file__).resolve().parent.parent
dados = json.loads((raiz / "data" / "base.json").read_text(encoding="utf-8"))
(raiz / "web" / "base.js").write_text("window.BASE = " + json.dumps(dados, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")
print(f"web/base.js gerado com {len(dados)} registros")
