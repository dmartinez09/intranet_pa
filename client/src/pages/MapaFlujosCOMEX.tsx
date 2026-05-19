import { useEffect, useState, useMemo } from 'react';
import Header from '../components/layout/Header';
import { comexApi } from '../services/api';
import { Share2, RefreshCw, Globe, Eye, MapPin } from 'lucide-react';
import ComexSourcesPanel from '../components/ComexSourcesPanel';
import ComexPeriodFilter from '../components/filters/ComexPeriodFilter';
import ComexDetailModal from '../components/ComexDetailModal';
import {
  ComposableMap, Geographies, Geography, ZoomableGroup, Marker, Line,
} from 'react-simple-maps';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';

interface FlowRow {
  pais_id: number;
  pais_origen: string;
  iso2: string;
  latitude: number | null;
  longitude: number | null;
  total_valor_cif_usd: number;
  total_cantidad_kg: number;
  empresas: number;
  operaciones?: number;
  share_pct: number;
}

const FAMILIAS = ['FUNGICIDAS', 'INSECTICIDAS', 'HERBICIDAS', 'NUTRICIONALES', 'BIOLOGICOS', 'COADYUVANTES', 'ORGANICOS', 'OTROS'];
const COUNTRY_FLAGS: Record<string, string> = {
  CN: '🇨🇳', IN: '🇮🇳', US: '🇺🇸', DE: '🇩🇪', BR: '🇧🇷', AR: '🇦🇷', ES: '🇪🇸',
  IT: '🇮🇹', IL: '🇮🇱', MX: '🇲🇽', JP: '🇯🇵', GB: '🇬🇧', FR: '🇫🇷', BE: '🇧🇪',
  NL: '🇳🇱', CH: '🇨🇭', CL: '🇨🇱', CO: '🇨🇴', EC: '🇪🇨', TR: '🇹🇷', KR: '🇰🇷', AU: '🇦🇺', PE: '🇵🇪',
};
const BAR_COLORS = ['#00A651', '#008C44', '#007038', '#34D67B', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#10B981', '#84CC16', '#A855F7'];

// World map TopoJSON (countries-110m)
const WORLD_GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const PERU_COORD: [number, number] = [-75.0152, -9.19];

const fmtUSD = (v: any) => `$${(Number(v) || 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;

// ISO numeric → ISO2 (subset used for countries-110m)
const NUM_TO_ISO2: Record<string, string> = {
  '156': 'CN', '356': 'IN', '840': 'US', '276': 'DE', '076': 'BR', '032': 'AR', '724': 'ES',
  '380': 'IT', '376': 'IL', '484': 'MX', '392': 'JP', '826': 'GB', '250': 'FR', '056': 'BE',
  '528': 'NL', '756': 'CH', '152': 'CL', '170': 'CO', '218': 'EC', '792': 'TR', '410': 'KR',
  '036': 'AU', '604': 'PE',
};

export default function MapaFlujosCOMEX() {
  const [data, setData] = useState<FlowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number | undefined>();
  const [month, setMonth] = useState<number | undefined>();
  const [familiaFilter, setFamiliaFilter] = useState<string>('');
  const [hovered, setHovered] = useState<FlowRow | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [detailId, setDetailId] = useState<number | null>(null);

  useEffect(() => { if (year) void load(); /* eslint-disable-next-line */ }, [year, month, familiaFilter]);

  async function load() {
    setLoading(true);
    try {
      const res = await comexApi.getFlows(year, familiaFilter || undefined, month);
      setData(res.data.data || []);
    } catch (err) {
      console.error('[MapaFlujos] error:', err);
    } finally {
      setLoading(false);
    }
  }

  const flowByIso = useMemo(() => {
    const m = new Map<string, FlowRow>();
    data.forEach(f => m.set(f.iso2, f));
    return m;
  }, [data]);

  const maxCIF = useMemo(() => data.reduce((m, f) => Math.max(m, Number(f.total_valor_cif_usd) || 0), 0), [data]);
  const totalCIF = data.reduce((s, f) => s + (Number(f.total_valor_cif_usd) || 0), 0);
  const totalKg = data.reduce((s, f) => s + (Number(f.total_cantidad_kg) || 0), 0);

  const getColorForIso = (iso: string) => {
    const flow = flowByIso.get(iso);
    if (!flow || maxCIF === 0) return '#E5E7EB';
    const ratio = Number(flow.total_valor_cif_usd) / maxCIF;
    if (iso === 'PE') return '#00A651';
    if (ratio > 0.7) return '#D97706';
    if (ratio > 0.4) return '#F59E0B';
    if (ratio > 0.2) return '#FCD34D';
    if (ratio > 0.05) return '#FEF3C7';
    return '#F3F4F6';
  };

  const top = useMemo(() => data.slice(0, 15), [data]);

  // Continent grouping
  const continentMap: Record<string, string> = {
    CN: 'Asia', IN: 'Asia', JP: 'Asia', KR: 'Asia', IL: 'Asia', TR: 'Asia',
    US: 'América', BR: 'América', AR: 'América', MX: 'América', CL: 'América', CO: 'América', EC: 'América', PE: 'América',
    DE: 'Europa', ES: 'Europa', IT: 'Europa', GB: 'Europa', FR: 'Europa', BE: 'Europa', NL: 'Europa', CH: 'Europa',
    AU: 'Oceanía',
  };
  const continentData = useMemo(() => {
    const grouped = new Map<string, number>();
    data.forEach(f => {
      const c = continentMap[f.iso2] || 'Otros';
      grouped.set(c, (grouped.get(c) || 0) + Number(f.total_valor_cif_usd || 0));
    });
    return Array.from(grouped.entries()).map(([continente, cif]) => ({ continente, cif }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return (
    <div className="min-h-screen">
      <Header title="Mapa de Flujos COMEX" subtitle="De dónde viene cada importación de agroquímicos hacia Perú" />

      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <select value={familiaFilter} onChange={e => setFamiliaFilter(e.target.value)} className="input-field text-sm">
            <option value="">Todas las familias PA</option>
            {FAMILIAS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <ComexPeriodFilter year={year} month={month} onChange={(y, mo) => { setYear(y); setMonth(mo); }} />
          <button onClick={load} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Recargar</button>
          <div className="ml-auto text-sm text-gray-500">
            <span className="font-semibold text-gray-700">{data.length}</span> países · CIF: <span className="font-semibold text-brand-700">{fmtUSD(totalCIF)}</span> · {Math.round(totalKg).toLocaleString('es-PE')} kg
          </div>
        </div>

        {!loading && data.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <Globe className="w-14 h-14 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">Sin flujos de origen</h3>
            <p className="text-sm text-gray-500">Aún no hay importaciones para los filtros seleccionados.</p>
          </div>
        )}

        {loading && <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" /></div>}

        {!loading && data.length > 0 && (
          <>
            {/* Mapa mundial choropleth + arcos */}
            <div className="chart-container">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                  <Share2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Panorama Mundial — De dónde llegan los agroquímicos a Perú</h3>
                  <p className="text-xs text-gray-400">Color por CIF importado · Líneas hacia Perú · Hover para detalle</p>
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 text-xs text-gray-600 mb-2">
                <span>CIF:</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: '#FEF3C7' }} />Bajo</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: '#FCD34D' }} />Medio</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: '#F59E0B' }} />Alto</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: '#D97706' }} />Muy alto</span>
                <span className="flex items-center gap-1 ml-2"><span className="w-3 h-3 rounded" style={{ backgroundColor: '#00A651' }} />Perú (destino)</span>
              </div>

              <div className="relative" style={{ minHeight: 500 }}>
                <ComposableMap projection="geoMercator" projectionConfig={{ scale: 130, center: [-60, 10] }} style={{ width: '100%', height: 500 }}>
                  <ZoomableGroup minZoom={1} maxZoom={4}>
                    <Geographies geography={WORLD_GEO_URL}>
                      {({ geographies }: { geographies: any[] }) =>
                        geographies.map((geo: any) => {
                          const numId = String(geo.id).padStart(3, '0');
                          const iso2 = NUM_TO_ISO2[numId];
                          const fill = iso2 ? getColorForIso(iso2) : '#F3F4F6';
                          const flow = iso2 ? flowByIso.get(iso2) : null;
                          return (
                            <Geography
                              key={geo.rsmKey}
                              geography={geo}
                              fill={fill}
                              stroke="#ffffff"
                              strokeWidth={0.4}
                              onMouseEnter={(evt) => {
                                if (flow) {
                                  setHovered(flow);
                                  setTooltipPos({ x: evt.clientX, y: evt.clientY });
                                }
                              }}
                              onMouseMove={(evt) => setTooltipPos({ x: evt.clientX, y: evt.clientY })}
                              onMouseLeave={() => setHovered(null)}
                              onClick={() => flow && setDetailId(flow.pais_id)}
                              style={{
                                default: { outline: 'none', cursor: flow ? 'pointer' : 'default' },
                                hover: { outline: 'none', fill: flow ? '#F59E0B' : fill, opacity: 0.9 },
                                pressed: { outline: 'none' },
                              }}
                            />
                          );
                        })
                      }
                    </Geographies>

                    {/* Líneas/arcos desde cada país de origen a Perú.
                        Para países del hemisferio oriental (lon > 0), restamos 360°
                        para que la línea cruce el Pacífico (ruta visualmente más corta hacia Perú)
                        en vez de dar la vuelta por Europa/Atlántico. */}
                    {top.slice(0, 10).map((f) => {
                      if (!f.latitude || !f.longitude) return null;
                      const lat = Number(f.latitude);
                      const lon = Number(f.longitude);
                      if (!isFinite(lat) || !isFinite(lon)) return null;
                      const fromLon = lon > 25 ? lon - 360 : lon;
                      return (
                        <Line
                          key={`line-${f.iso2}`}
                          from={[fromLon, lat]}
                          to={PERU_COORD}
                          stroke="#EF4444"
                          strokeWidth={Math.max(1, Math.min(3, (Number(f.share_pct) || 0) / 8))}
                          strokeLinecap="round"
                          strokeOpacity={0.6}
                        />
                      );
                    })}

                    {/* Marker Perú */}
                    <Marker coordinates={PERU_COORD}>
                      <circle r={5} fill="#00A651" stroke="#fff" strokeWidth={2} />
                      <text textAnchor="middle" y={-10} style={{ fontSize: 11, fontWeight: 700, fill: '#00A651' }}>Perú</text>
                    </Marker>

                    {/* Markers para top países origen */}
                    {top.slice(0, 8).map((f) => (
                      f.latitude && f.longitude ? (
                        <Marker key={`m-${f.iso2}`} coordinates={[f.longitude, f.latitude]}>
                          <circle r={3} fill="#EF4444" />
                        </Marker>
                      ) : null
                    ))}
                  </ZoomableGroup>
                </ComposableMap>

                {hovered && (
                  <div className="fixed z-50 pointer-events-none bg-white rounded-xl shadow-2xl border border-gray-200 p-3 text-xs min-w-[240px]"
                       style={{ left: tooltipPos.x + 14, top: tooltipPos.y + 14 }}>
                    <div className="font-bold text-gray-900 mb-1.5 flex items-center gap-1.5">
                      <span className="text-base">{COUNTRY_FLAGS[hovered.iso2] || '🌎'}</span>
                      {hovered.pais_origen}
                      <span className="text-[10px] text-gray-400">{hovered.iso2}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-gray-700">
                      <div>CIF: <span className="font-bold">{fmtUSD(hovered.total_valor_cif_usd)}</span></div>
                      <div>Share: <span className="font-bold">{Number(hovered.share_pct).toFixed(2)}%</span></div>
                      <div>Kg: <span className="font-mono">{Number(hovered.total_cantidad_kg || 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}</span></div>
                      <div>Empresas: <span className="font-bold">{hovered.empresas}</span></div>
                    </div>
                    <div className="mt-2 text-[10px] text-brand-600 font-medium">Click para abrir detalle país →</div>
                  </div>
                )}
              </div>
            </div>

            {/* Charts secundarios */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="chart-container">
                <h3 className="text-base font-bold text-gray-900 mb-1">Top 15 Países — CIF USD</h3>
                <p className="text-xs text-gray-400 mb-4">Ranking de origen</p>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={top} layout="vertical" margin={{ left: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="pais_origen" tick={{ fontSize: 11 }} width={100} />
                    <Tooltip formatter={(v: any) => fmtUSD(v)} />
                    <Bar dataKey="total_valor_cif_usd" radius={[0, 6, 6, 0]}>
                      {top.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-container">
                <h3 className="text-base font-bold text-gray-900 mb-1">Distribución por Continente</h3>
                <p className="text-xs text-gray-400 mb-4">CIF total por región del mundo</p>
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie data={continentData} dataKey="cif" nameKey="continente" cx="50%" cy="50%" outerRadius={140} innerRadius={70} stroke="none" label={(e: any) => `${e.continente}: ${fmtUSD(e.cif)}`}>
                      {continentData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmtUSD(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tabla detalle completa */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center gap-3">
                <MapPin className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-base font-bold text-gray-900">Detalle completo por país — {year}{month ? `-${String(month).padStart(2,'0')}` : ''}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Todos los países con importaciones registradas</p>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">#</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">País</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">ISO</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Continente</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase tracking-wide">CIF USD</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase tracking-wide">Kg</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase tracking-wide">Operaciones</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase tracking-wide">Empresas</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase tracking-wide">Share %</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-600 uppercase tracking-wide">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.map((f, i) => (
                      <tr key={f.iso2} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 text-gray-500">{i + 1}</td>
                        <td className="px-3 py-1.5 font-semibold"><span className="mr-1">{COUNTRY_FLAGS[f.iso2] || '🌎'}</span>{f.pais_origen}</td>
                        <td className="px-3 py-1.5 text-gray-400 font-mono">{f.iso2}</td>
                        <td className="px-3 py-1.5 text-gray-600">{continentMap[f.iso2] || 'Otros'}</td>
                        <td className="px-3 py-1.5 text-right font-mono font-bold text-gray-900">{fmtUSD(f.total_valor_cif_usd)}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{Number(f.total_cantidad_kg || 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{Number(f.operaciones || 0).toLocaleString('es-PE')}</td>
                        <td className="px-3 py-1.5 text-right">{f.empresas}</td>
                        <td className="px-3 py-1.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(100, Number(f.share_pct) * 2)}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
                            </div>
                            <span className="font-mono text-xs font-bold">{Number(f.share_pct).toFixed(2)}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <button onClick={() => setDetailId(f.pais_id)} className="p-1.5 hover:bg-brand-50 rounded text-brand-600 hover:text-brand-800 transition-colors" title="Ver detalle del país">
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <ComexSourcesPanel />
      </div>

      {detailId !== null && (
        <ComexDetailModal kind="pais" id={detailId} year={year} month={month} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}
