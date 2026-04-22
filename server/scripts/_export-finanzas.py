"""Exporta el Excel de Finanzas a JSON para cruce con SQL."""
import pandas as pd
import json
import os
import sys

xlsx = r"C:\Users\diego.martinez\Downloads\REPORTE DE VENTAS MARZO 2026 SAP 1.xlsx"
out  = os.path.join(os.path.dirname(__file__), "_finanzas-marzo.json")

df = pd.read_excel(xlsx, header=2)
df = df[df['Numero_SAP'].notna()]

rows = []
for _, r in df.iterrows():
    rows.append({
        'numero_sap': str(r['Numero_SAP']).strip(),
        'codigo_producto': str(r['Codigo_Producto']).strip() if pd.notna(r.get('Codigo_Producto')) else '',
        'cantidad_kg': float(pd.to_numeric(r.get('Cantidad KG/LT'), errors='coerce') or 0),
        'costo_unit_kg': float(pd.to_numeric(r.get('Costo Unitario USD (KG/LT)'), errors='coerce') or 0),
        'costo_total_kg': float(pd.to_numeric(r.get('Costo Total USD (KG/LT)'), errors='coerce') or 0),
        'costo_unit_pres': float(pd.to_numeric(r.get('Costo_unitario_Presentación'), errors='coerce') or 0),
        'costo_total_pres': float(pd.to_numeric(r.get('Costo Total _Presentación'), errors='coerce') or 0),
        'venta_pres': float(pd.to_numeric(r.get('Valor_Venta_Dolares_Presentación'), errors='coerce') or 0),
    })

with open(out, 'w', encoding='utf-8') as f:
    json.dump(rows, f, ensure_ascii=False)

print(f"Exportadas {len(rows)} filas de Finanzas a {out}", file=sys.stderr)
