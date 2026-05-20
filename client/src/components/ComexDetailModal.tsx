import { useEffect, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTip, ResponsiveContainer } from 'recharts';
import { comexApi } from '../services/api';

type Kind = 'partida' | 'empresa' | 'pais' | 'producto';
interface Props {
  kind: Kind;
  id: number | null;
  year?: number;
  month?: number;
  onClose: () => void;
}

const fmtUSD = (v?: number) => `$${(Number(v) || 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;
const fmtKg = (v?: number) => `${(Number(v) || 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })} kg`;
const fmtNum = (v?: number) => (Number(v) || 0).toLocaleString('es-PE');

export default function ComexDetailModal({ kind, id, year, month, onClose }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id == null) return;
    setLoading(true);
    const params = { year, month };
    const p =
      kind === 'partida' ? comexApi.getPartidaDetalle(id, params)
      : kind === 'empresa' ? comexApi.getEmpresaDetalle(id, params)
      : kind === 'producto' ? comexApi.getProductoDetalle(id, params)
      : comexApi.getPaisDetalle(id, params);
    p.then((res: any) => setData(res.data?.data || res.data))
     .catch(() => setData(null))
     .finally(() => setLoading(false));
  }, [kind, id, year, month]);

  if (id == null) return null;

  const title = data?.partida ? `Partida ${data.partida.hs_code} — ${data.partida.descripcion}`
    : data?.empresa ? `${data.empresa.razon_social}${data.empresa.ruc ? ` · RUC ${data.empresa.ruc}` : ''}`
    : data?.producto ? `${data.producto.ingrediente_activo}${data.producto.nombre_comercial ? ` · ${data.producto.nombre_comercial}` : ''}`
    : data?.pais ? `${data.pais.nombre || data.pais.codigo_iso}`
    : 'Detalle';

  const headerColor =
    kind === 'partida' ? 'from-amber-50 to-orange-50 border-amber-200'
    : kind === 'empresa' ? 'from-blue-50 to-indigo-50 border-blue-200'
    : kind === 'producto' ? 'from-emerald-50 to-green-50 border-emerald-200'
    : 'from-cyan-50 to-teal-50 border-cyan-200';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={`bg-gradient-to-r ${headerColor} border-b px-6 py-4 flex items-start justify-between sticky top-0 z-10`}>
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-1">
              {kind === 'partida' && 'Partida Arancelaria'}
              {kind === 'empresa' && 'Competidor / Importador'}
              {kind === 'producto' && 'Ingrediente Activo / Producto'}
              {kind === 'pais' && 'País de Origen'}
              {year && ` · ${year}${month ? `-${String(month).padStart(2, '0')}` : ''}`}
            </div>
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            {data?.partida && (
              <div className="text-sm text-gray-600 mt-1">
                Familia PA: <span className="font-semibold text-brand-700">{data.partida.familia_pa}</span> · {data.partida.tipo_grupo}
              </div>
            )}
            {data?.empresa && (
              <div className="text-sm text-gray-600 mt-1">
                Tipo: {data.empresa.tipo_empresa || 'N/A'}
                {data.empresa.pais_origen && ` · Origen: ${data.empresa.pais_origen}`}
                {data.empresa.es_point_andina ? ' · POINT ANDINA' : data.empresa.es_competidor ? ' · Competidor activo' : ''}
              </div>
            )}
            {data?.producto && (
              <div className="text-sm text-gray-600 mt-1">
                Familia: <span className="font-semibold text-emerald-700">{data.producto.familia_pa}</span>
                {data.producto.concentracion && ` · ${data.producto.concentracion}`}
                {data.producto.unidad && ` (${data.producto.unidad})`}
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/60 rounded-md transition-colors"><X className="w-5 h-5 text-gray-600" /></button>
        </div>

        {loading && <div className="p-12 text-center text-gray-500">Cargando detalle...</div>}
        {!loading && !data && <div className="p-12 text-center text-gray-500">Sin datos disponibles</div>}
        {!loading && data && (
          <div className="p-6 space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {Object.entries(data.totales || {}).map(([k, v]: [string, any]) => (
                <div key={k} className="bg-gray-50 rounded-lg px-3 py-3 border border-gray-200">
                  <div className="text-xs uppercase text-gray-500 tracking-wide truncate">{k.replace(/_/g, ' ')}</div>
                  <div className="text-lg font-bold text-gray-900 mt-1">
                    {k.includes('cif') || k.includes('usd') ? fmtUSD(v)
                    : k.includes('kg') ? fmtKg(v)
                    : fmtNum(v)}
                  </div>
                </div>
              ))}
            </div>

            {/* Monthly Trend */}
            {data.monthly_trend?.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Tendencia mensual CIF</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data.monthly_trend.map((r: any) => ({ periodo: `${r.year}-${String(r.month).padStart(2, '0')}`, cif: Number(r.cif_usd) || 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="periodo" fontSize={11} />
                    <YAxis fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                    <ChartTip formatter={(v: any) => fmtUSD(v)} />
                    <Line type="monotone" dataKey="cif" stroke="#00A651" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tables grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {data.top_empresas && (
                <DetailTable title="Top Empresas" rows={data.top_empresas} cols={[
                  { key: 'razon_social', label: 'Empresa' },
                  { key: 'tipo_empresa', label: 'Tipo' },
                  { key: 'cif_usd', label: 'CIF', fmt: fmtUSD, align: 'right' },
                  { key: 'ops', label: 'Ops', align: 'right' },
                ]} />
              )}
              {data.top_paises && (
                <DetailTable title="Top Países Origen" rows={data.top_paises} cols={[
                  { key: 'codigo_iso', label: 'ISO' },
                  { key: 'nombre', label: 'País' },
                  { key: 'cif_usd', label: 'CIF', fmt: fmtUSD, align: 'right' },
                  { key: 'kg', label: 'Kg', fmt: fmtKg, align: 'right' },
                ]} />
              )}
              {data.top_partidas && (
                <DetailTable title="Top Partidas Arancelarias" rows={data.top_partidas} cols={[
                  { key: 'hs_code', label: 'HS' },
                  { key: 'descripcion', label: 'Descripción' },
                  { key: 'familia_pa', label: 'Familia' },
                  { key: 'cif_usd', label: 'CIF', fmt: fmtUSD, align: 'right' },
                ]} />
              )}
              {data.top_productos && data.top_productos.length > 0 && (
                <DetailTable title="Top Productos / Ingredientes Activos" rows={data.top_productos} cols={[
                  { key: 'ingrediente_activo', label: 'Ingrediente Activo' },
                  { key: 'familia_pa', label: 'Familia' },
                  { key: 'cif_usd', label: 'CIF', fmt: fmtUSD, align: 'right' },
                  { key: 'ops', label: 'Ops', align: 'right' },
                ]} />
              )}
            </div>

            {data.fuente_url && (
              <div className="text-xs text-gray-500 flex items-center gap-1">
                Fuente: <a href={data.fuente_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline inline-flex items-center gap-1">{data.fuente_url} <ExternalLink className="w-3 h-3" /></a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface Col { key: string; label: string; fmt?: (v: any) => string; align?: 'left' | 'right' }
function DetailTable({ title, rows, cols }: { title: string; rows: any[]; cols: Col[] }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 text-sm font-semibold text-gray-700">{title} ({rows.length})</div>
      <div className="overflow-x-auto max-h-72 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {cols.map(c => (
                <th key={c.key} className={`px-3 py-2 ${c.align === 'right' ? 'text-right' : 'text-left'} font-semibold text-gray-600 uppercase tracking-wide`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.slice(0, 20).map((r: any, idx: number) => (
              <tr key={idx} className="hover:bg-gray-50">
                {cols.map(c => (
                  <td key={c.key} className={`px-3 py-1.5 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                    {c.fmt ? c.fmt(r[c.key]) : (r[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
