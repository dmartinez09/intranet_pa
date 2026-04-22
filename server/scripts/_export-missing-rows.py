"""Exporta las 4 filas faltantes completas desde Finanzas."""
import pandas as pd
import json
import os
import sys

xlsx = r"C:\Users\diego.martinez\Downloads\REPORTE DE VENTAS MARZO 2026 SAP 1.xlsx"
out = os.path.join(os.path.dirname(__file__), "_missing-rows.json")

df = pd.read_excel(xlsx, header=2)

# Las 4 claves que faltan
keys = [
    ('01-F001-00039750', 'QINS000062'),
    ('01-F001-00039750', 'QINS000067'),
    ('07-FC01-00001942', 'BACB000008'),
    ('08-FD01-00000282', 'BACB000009'),
]

rows = []
for ns, cp in keys:
    match = df[(df['Numero_SAP'] == ns) & (df['Codigo_Producto'] == cp)]
    if len(match) == 0:
        print(f"No match for {ns} / {cp}", file=sys.stderr)
        continue
    r = match.iloc[0].to_dict()
    # Convert all values to strings or numbers for JSON
    clean = {}
    for k, v in r.items():
        if pd.isna(v):
            clean[k] = None
        elif isinstance(v, pd.Timestamp):
            clean[k] = v.strftime('%Y-%m-%d')
        elif isinstance(v, (int, float)):
            clean[k] = float(v) if not pd.isna(v) else None
        else:
            clean[k] = str(v)
    rows.append(clean)

with open(out, 'w', encoding='utf-8') as f:
    json.dump(rows, f, ensure_ascii=False, indent=2)

print(f"Exportadas {len(rows)} filas completas a {out}", file=sys.stderr)
