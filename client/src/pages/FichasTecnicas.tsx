// ============================================================
// Fichas Técnicas SENASA — Vista tipo SAG (Chile) para mercado peruano
// Fuente: SENASA Perú (SIGIA) — registro oficial de plaguicidas
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import Header from '../components/layout/Header';
import { inteligenciaApi } from '../services/api';
import { Loader2, FileText, Building2, Eye, X, ExternalLink, AlertTriangle, FlaskConical, Bug, Sprout, Award, Leaf } from 'lucide-react';

interface FichaRow {
  plaguicida_id: number;
  numero_registro: string;
  nombre_comercial: string;
  titular_registro: string | null;
  ingrediente_activo: string | null;
  principios_activos: string | null;
  clase: string | null;
  categoria_toxicologica: string | null;
  tipo_producto: string | null;
  categoria_pa_code: string | null;
  categoria_pa_name: string | null;
  cultivos_resumen: string | null;
  usos_count: number;
  estado_registro: string | null;
  etiquetas_ids: string | null;
  secuencia_registro: number | null;
  fecha_primera_etiqueta: string | null;
  fecha_ultima_etiqueta: string | null;
  anio_primer_registro: number | null;
  anio_ultima_actividad: number | null;
  cantidad_etiquetas: number | null;
  tipo_registro_inferido: string | null;
}

interface UsoRow {
  cultivo_nombre_comun: string;
  cultivo_nombre_cient: string;
  plaga_nombre_comun: string;
  plaga_nombre_cient: string;
  unidad_medida: string | null;
  dosis_hectarea: number | null;
  dosis_porcentaje: number | null;
  capacidad_cilindro: number | null;
  dosis_cilindro: number | null;
  limite_max_residuo: number | null;
  periodo_carencia_dias: number | null;
  observacion: string | null;
}

interface EtiquetaRow {
  etiqueta_id: number;
  numeregiarc: string;
  filename: string | null;
  descripcion: string | null;
  fecha_registro: string | null;
  tamano_bytes: number | null;
  extension: string | null;
  presentacion: string | null;
  download_url: string | null;
}

interface EmpresaRow {
  empresa: string;
  productos: number;
  clases_distintas: number;
  ingredientes_activos: number;
  fungicidas: number;
  insecticidas: number;
  herbicidas: number;
}

interface Stats {
  toxicidad: { toxicidad: string; productos: number }[];
  tipos: { tipo: string; productos: number }[];
  top_cultivos: { cultivo: string; productos: number; usos: number }[];
  top_plagas: { plaga: string; productos: number; cultivos: number }[];
  top_ingredientes: { ia: string; productos: number }[];
  point_andina_count: number;
  estados?: { estado: string; productos: number }[];
  por_anio_primer?: { anio: number; productos: number }[];
  por_anio_ultima?: { anio: number; productos: number }[];
}

const PA_HIGHLIGHT = 'POINT ANDINA';
const isPointAndina = (titular?: string | null) => !!titular && titular.toUpperCase().includes(PA_HIGHLIGHT);

const TOX_COLORS: Record<string, string> = {
  'Sumamente Peligroso':       'bg-red-700 text-white',
  'Muy Peligroso':             'bg-red-500 text-white',
  'Moderadamente Peligroso':   'bg-orange-500 text-white',
  'Poco Peligroso':            'bg-yellow-500 text-yellow-950',
  'Ligeramente Peligroso':     'bg-emerald-500 text-white',
};

const CLASE_ICON: Record<string, JSX.Element> = {
  'Fungicida':   <FlaskConical className="w-3.5 h-3.5" />,
  'Insecticida': <Bug className="w-3.5 h-3.5" />,
  'Herbicida':   <Sprout className="w-3.5 h-3.5" />,
};

export default function FichasTecnicas() {
  const [filters, setFilters] = useState<any>(null);
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [rows, setRows] = useState<FichaRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeEmpresa, setActiveEmpresa] = useState<string>('');
  const [q, setQ] = useState({
    nombre_comercial: '', titular: '', ingrediente_activo: '',
    clase: '', toxicidad: '', cultivo: '', plaga: '', tipo_producto: '',
    estado_registro: '',
    anio_primer_desde: '', anio_primer_hasta: '',
    anio_ultima_desde: '', anio_ultima_hasta: '',
    tipo_registro: '',
  });
  const [sortMode, setSortMode] = useState<'alfabetico' | 'recientes' | 'antiguos'>('alfabetico');
  const [detail, setDetail] = useState<{ ficha: any; usos: UsoRow[]; etiquetas?: EtiquetaRow[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Carga inicial
  useEffect(() => {
    inteligenciaApi.getPlaguicidasFilters().then(r => setFilters(r.data.data)).catch(() => {});
    inteligenciaApi.getPlaguicidasByEmpresa().then(r => setEmpresas(r.data.data || [])).catch(() => {});
    inteligenciaApi.getPlaguicidasStats().then(r => setStats(r.data.data)).catch(() => {});
    refresh({});
  }, []);

  function refresh(params: any) {
    setLoading(true);
    inteligenciaApi.getPlaguicidas({ limit: 1000, sort: sortMode, ...params })
      .then(r => { setRows(r.data.data.rows || []); setTotal(r.data.data.total || 0); })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }

  // Re-fetch al cambiar sortMode
  useEffect(() => {
    if (rows.length > 0 || activeEmpresa) {
      const params: any = { ...q };
      if (activeEmpresa) params.titular = activeEmpresa;
      Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
      refresh(params);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortMode]);

  function applyFilters() {
    applyFiltersWith(q);
  }

  // Aplica filtros con un snapshot específico de q (útil para auto-apply en onChange)
  function applyFiltersWith(qSnap: typeof q) {
    const params: any = { ...qSnap };
    if (activeEmpresa) params.titular = activeEmpresa;
    Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
    refresh(params);
    // Stats y empresas también respetan los filtros para que los gráficos cascadeen
    inteligenciaApi.getPlaguicidasStats(params).then(r => setStats(r.data.data)).catch(() => {});
    inteligenciaApi.getPlaguicidasByEmpresa(params).then(r => setEmpresas(r.data.data || [])).catch(() => {});
  }

  function clearFilters() {
    setQ({ nombre_comercial: '', titular: '', ingrediente_activo: '', clase: '', toxicidad: '', cultivo: '', plaga: '', tipo_producto: '', estado_registro: '',
      anio_primer_desde: '', anio_primer_hasta: '', anio_ultima_desde: '', anio_ultima_hasta: '', tipo_registro: '' });
    setActiveEmpresa('');
    refresh({});
  }

  function selectEmpresa(empresa: string) {
    setActiveEmpresa(empresa === activeEmpresa ? '' : empresa);
    const params: any = { ...q };
    if (empresa !== activeEmpresa) params.titular = empresa;
    Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
    refresh(params);
  }

  async function openDetail(plaguicidaId: number) {
    setDetailLoading(true);
    setDetail({ ficha: null, usos: [], etiquetas: [] });
    try {
      const r = await inteligenciaApi.getPlaguicidaDetail(plaguicidaId);
      setDetail(r.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  }

  const totalEmpresas = empresas.length;
  const totalProductos = useMemo(() => empresas.reduce((s, e) => s + e.productos, 0), [empresas]);

  return (
    <div className="min-h-screen">
      <Header
        title="Fichas Técnicas — SENASA Perú"
        subtitle={`Registro oficial de plaguicidas químicos · clasificación por empresa · ${new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}`}
      />

      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard icon={Building2} label="Empresas registradas" value={totalEmpresas} color="brand" />
          <KpiCard icon={FileText} label="Productos totales" value={totalProductos.toLocaleString('es-PE')} color="emerald" />
          <KpiCard icon={FlaskConical} label="Fungicidas" value={empresas.reduce((s, e) => s + e.fungicidas, 0)} color="cyan" />
          <KpiCard icon={Bug} label="Insecticidas" value={empresas.reduce((s, e) => s + e.insecticidas, 0)} color="orange" />
          <KpiCard icon={Award} label="Point Andina" value={stats?.point_andina_count ?? 0} color="amber" />
        </div>

        {/* Distribución toxicidad + Tipos producto */}
        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 lg:col-span-2">
              <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Distribución por Toxicidad OMS
              </h3>
              <div className="space-y-1.5">
                {stats.toxicidad.map(t => {
                  const total = stats.toxicidad.reduce((s, x) => s + x.productos, 0);
                  const pct = total ? (t.productos / total) * 100 : 0;
                  return (
                    <div key={t.toxicidad}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="font-semibold text-gray-700">{t.toxicidad}</span>
                        <span className="text-gray-500"><strong className="text-gray-800">{t.productos}</strong> · {pct.toFixed(1)}%</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded overflow-hidden">
                        <div
                          className={`h-full rounded ${TOX_COLORS[t.toxicidad]?.split(' ')[0] || 'bg-gray-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
                <Leaf className="w-4 h-4 text-emerald-500" />
                Por tipo de producto
              </h3>
              <div className="space-y-2">
                {stats.tipos.map(t => (
                  <div key={t.tipo} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-sm font-semibold text-gray-700">{t.tipo}</span>
                    <span className="text-sm font-bold text-brand-600">{t.productos}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Two-pane layout: empresas (left) + tabla maestra (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* PANEL EMPRESAS */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-600" />
              <h3 className="font-semibold text-gray-800 text-sm">Empresas titulares</h3>
              <span className="ml-auto text-xs text-gray-400">{totalEmpresas}</span>
            </div>
            <div className="max-h-[640px] overflow-y-auto">
              {empresas.length === 0 && <div className="p-6 text-center text-sm text-gray-400">Cargando…</div>}
              {empresas.map(e => {
                const active = e.empresa === activeEmpresa;
                const isPA = isPointAndina(e.empresa);
                return (
                  <button
                    key={e.empresa}
                    onClick={() => selectEmpresa(e.empresa)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 transition hover:bg-brand-50/40
                      ${active ? 'bg-brand-50 border-l-4 border-l-brand-500' : ''}
                      ${isPA && !active ? 'bg-amber-50/60 border-l-4 border-l-amber-400' : ''}`}
                  >
                    <div className={`text-sm font-semibold truncate flex items-center gap-1.5 ${isPA ? 'text-amber-800' : 'text-gray-800'}`}>
                      {isPA && <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      {e.empresa}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      <Badge label={`${e.productos} prods`} color="brand" />
                      {e.fungicidas > 0 && <Badge label={`${e.fungicidas} F`} color="cyan" />}
                      {e.insecticidas > 0 && <Badge label={`${e.insecticidas} I`} color="orange" />}
                      {e.herbicidas > 0 && <Badge label={`${e.herbicidas} H`} color="emerald" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PANEL TABLA */}
          <div className="lg:col-span-8 space-y-4">
            {/* Filtros */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Input label="Nombre comercial" value={q.nombre_comercial} onChange={v => setQ({ ...q, nombre_comercial: v })} />
                <Input label="Ingrediente activo" value={q.ingrediente_activo} onChange={v => setQ({ ...q, ingrediente_activo: v })} />
                <Input label="Cultivo" value={q.cultivo} onChange={v => setQ({ ...q, cultivo: v })} />
                <Input label="Plaga" value={q.plaga} onChange={v => setQ({ ...q, plaga: v })} />
                <Select label="Clase" value={q.clase} onChange={v => setQ({ ...q, clase: v })} options={filters?.clases || []} />
                <Select label="Toxicidad OMS" value={q.toxicidad} onChange={v => setQ({ ...q, toxicidad: v })} options={filters?.toxicidades || []} />
                <Select label="Tipo producto" value={q.tipo_producto} onChange={v => setQ({ ...q, tipo_producto: v })} options={filters?.tipos_producto || []} />
                <Select label="Estado registro" value={q.estado_registro} onChange={v => setQ({ ...q, estado_registro: v })} options={filters?.estados_registro || []} />
                <Select label="Tipo registro" value={q.tipo_registro} onChange={v => setQ({ ...q, tipo_registro: v })} options={['NUEVO', 'CON EXTENSIONES']} />
                <Select label="Titular" value={q.titular} onChange={v => setQ({ ...q, titular: v })} options={filters?.titulares || []} />
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Ordenar por</label>
                  <select
                    value={sortMode}
                    onChange={e => setSortMode(e.target.value as any)}
                    className="input-field text-sm py-1.5 w-full"
                  >
                    <option value="alfabetico">Alfabético (titular + nombre)</option>
                    <option value="recientes">Más recientes primero</option>
                    <option value="antiguos">Más antiguos primero</option>
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <button onClick={applyFilters} className="btn-primary flex-1 py-1.5 text-sm">Aplicar</button>
                  <button onClick={clearFilters} className="btn-secondary py-1.5 text-sm">Limpiar</button>
                </div>
              </div>

              {/* Filtros temporales — usando fechas reales de etiquetas SENASA */}
              <div className="mt-4 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">📅 Filtros temporales (basado en etiquetas oficiales SENASA)</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <SelectAnio
                    label="Año primer registro desde"
                    value={q.anio_primer_desde}
                    onChange={v => { const next = { ...q, anio_primer_desde: v }; setQ(next); applyFiltersWith(next); }}
                    options={(stats?.por_anio_primer || []).map(x => x.anio).filter(Boolean) as number[]}
                  />
                  <SelectAnio
                    label="Año primer registro hasta"
                    value={q.anio_primer_hasta}
                    onChange={v => { const next = { ...q, anio_primer_hasta: v }; setQ(next); applyFiltersWith(next); }}
                    options={(stats?.por_anio_primer || []).map(x => x.anio).filter(Boolean) as number[]}
                  />
                  <SelectAnio
                    label="Año última actividad desde"
                    value={q.anio_ultima_desde}
                    onChange={v => { const next = { ...q, anio_ultima_desde: v }; setQ(next); applyFiltersWith(next); }}
                    options={(stats?.por_anio_ultima || []).map(x => x.anio).filter(Boolean) as number[]}
                  />
                  <SelectAnio
                    label="Año última actividad hasta"
                    value={q.anio_ultima_hasta}
                    onChange={v => { const next = { ...q, anio_ultima_hasta: v }; setQ(next); applyFiltersWith(next); }}
                    options={(stats?.por_anio_ultima || []).map(x => x.anio).filter(Boolean) as number[]}
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                <span>
                  Plaguicidas encontrados: <span className="font-bold text-gray-800">{total.toLocaleString('es-PE')}</span>
                  {activeEmpresa && <span className="ml-2 text-brand-600">· filtrando por <strong>{activeEmpresa}</strong></span>}
                </span>
                <span>Fuente: <a href="https://servicios.senasa.gob.pe/SIGIAWeb/sigia_consulta_cultivo.html" target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">SENASA SIGIA</a></span>
              </div>
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">N° Registro</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Estado</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tipo Registro</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Nombre Comercial</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Ingrediente Activo</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Clase</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Toxicidad OMS</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Cultivos</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Usos</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading && (
                      <tr><td colSpan={8} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin text-brand-600 inline" /></td></tr>
                    )}
                    {!loading && rows.length === 0 && (
                      <tr><td colSpan={8} className="text-center py-12 text-gray-400">Sin resultados</td></tr>
                    )}
                    {!loading && rows.map(r => {
                      const isPA = isPointAndina(r.titular_registro);
                      return (
                      <tr key={r.plaguicida_id} className={`hover:bg-gray-50 ${isPA ? 'bg-amber-50/40' : ''}`}>
                        <td className="px-3 py-2.5 font-mono text-xs text-gray-600 whitespace-nowrap">
                          {isPA && <Award className="w-3 h-3 text-amber-500 inline mr-1" />}
                          {r.numero_registro}
                        </td>
                        <td className="px-3 py-2.5">
                          {r.estado_registro && (
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                              r.estado_registro === 'Vigente' ? 'bg-emerald-100 text-emerald-700' :
                              r.estado_registro === 'Prohibido' ? 'bg-red-100 text-red-700' :
                              r.estado_registro === 'Cancelado' ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {r.estado_registro}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {r.tipo_registro_inferido && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
                              r.tipo_registro_inferido === 'NUEVO' ? 'bg-cyan-100 text-cyan-700' :
                              r.tipo_registro_inferido === 'CON EXTENSIONES' ? 'bg-violet-100 text-violet-700' :
                              'bg-gray-100 text-gray-700'
                            }`} title={r.cantidad_etiquetas ? `${r.cantidad_etiquetas} etiquetas / resoluciones SENASA` : undefined}>
                              {r.tipo_registro_inferido}
                              {r.cantidad_etiquetas && r.cantidad_etiquetas > 1 && (
                                <span className="text-[10px] opacity-75">({r.cantidad_etiquetas - 1} ext.)</span>
                              )}
                            </span>
                          )}
                        </td>
                        <td className={`px-3 py-2.5 font-semibold ${isPA ? 'text-amber-800' : 'text-gray-800'}`}>{r.nombre_comercial}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[200px] truncate" title={r.ingrediente_activo || ''}>
                          {r.ingrediente_activo || '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          {r.clase && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700">
                              {CLASE_ICON[r.clase] || null}
                              {r.clase}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {r.categoria_toxicologica && (
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${TOX_COLORS[r.categoria_toxicologica] || 'bg-gray-200 text-gray-700'}`}>
                              {r.categoria_toxicologica}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[200px] truncate" title={r.cultivos_resumen || ''}>
                          {r.cultivos_resumen || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center text-xs text-gray-600">{r.usos_count}</td>
                        <td className="px-3 py-2.5 text-right">
                          <button onClick={() => openDetail(r.plaguicida_id)} className="text-brand-600 hover:text-brand-800 inline-flex items-center gap-1 text-xs font-semibold">
                            <Eye className="w-3.5 h-3.5" /> Ver
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {rows.length >= 1000 && (
                <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 text-xs text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Mostrando primeros 1,000 resultados. Aplica filtros para reducir el set.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tops auxiliares: cultivos, plagas, IAs */}
        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <TopList title="Top 10 cultivos por # productos" icon={<Sprout className="w-4 h-4 text-emerald-500" />}
              items={stats.top_cultivos.map(c => ({ label: c.cultivo, primary: c.productos, secondary: `${c.usos} usos` }))}
              onClick={(label) => { setQ(prev => ({ ...prev, cultivo: label })); refresh({ ...q, cultivo: label }); }}
            />
            <TopList title="Top 10 plagas más combatidas" icon={<Bug className="w-4 h-4 text-orange-500" />}
              items={stats.top_plagas.map(p => ({ label: p.plaga, primary: p.productos, secondary: `${p.cultivos} cultivos` }))}
              onClick={(label) => { setQ(prev => ({ ...prev, plaga: label })); refresh({ ...q, plaga: label }); }}
            />
            <TopList title="Top 10 ingredientes activos" icon={<FlaskConical className="w-4 h-4 text-cyan-500" />}
              items={stats.top_ingredientes.map(i => ({ label: i.ia, primary: i.productos, secondary: '' }))}
              onClick={(label) => { setQ(prev => ({ ...prev, ingrediente_activo: label })); refresh({ ...q, ingrediente_activo: label }); }}
            />
          </div>
        )}
      </div>

      {/* MODAL FICHA DETALLE */}
      {detail !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-brand-600" />
                  <h2 className="text-xl font-bold text-gray-800">{detailLoading ? 'Cargando…' : (detail.ficha?.nombre_comercial || '—')}</h2>
                </div>
                {detail.ficha && (
                  <p className="text-sm text-gray-500 font-mono mt-0.5">{detail.ficha.numero_registro}</p>
                )}
              </div>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-6 space-y-4">
              {detailLoading && <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin text-brand-600 inline" /></div>}
              {detail.ficha && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <Field label="Titular" value={detail.ficha.titular_registro} />
                    <Field label="Clase" value={detail.ficha.clase} />
                    <Field label="Tipo Producto" value={detail.ficha.tipo_producto} />
                    <Field label="Ingrediente Activo" value={detail.ficha.ingrediente_activo} />
                    <Field label="Principios Activos" value={detail.ficha.principios_activos} />
                    <Field label="Toxicidad OMS" value={detail.ficha.categoria_toxicologica} highlight={!!detail.ficha.categoria_toxicologica} />
                    <Field label="Categoría PA" value={detail.ficha.categoria_pa_name} />
                    <Field label="Estado del registro" value={detail.ficha.estado_registro} highlight={detail.ficha.estado_registro === 'Vigente'} />
                    <Field label="Tipo de registro" value={detail.ficha.tipo_registro_inferido ? `${detail.ficha.tipo_registro_inferido}${detail.ficha.cantidad_etiquetas > 1 ? ` (${detail.ficha.cantidad_etiquetas - 1} extensiones)` : ''}` : null} highlight={detail.ficha.tipo_registro_inferido === 'NUEVO'} />
                    <Field label="Cantidad de etiquetas/resoluciones" value={detail.ficha.cantidad_etiquetas} mono />
                    <Field label="Año primer registro" value={detail.ficha.anio_primer_registro} mono />
                    <Field label="Año última actividad" value={detail.ficha.anio_ultima_actividad} mono />
                    <Field label="Fecha primera etiqueta" value={detail.ficha.fecha_primera_etiqueta ? new Date(detail.ficha.fecha_primera_etiqueta).toLocaleDateString('es-PE') : null} />
                    <Field label="Fecha última etiqueta" value={detail.ficha.fecha_ultima_etiqueta ? new Date(detail.ficha.fecha_ultima_etiqueta).toLocaleDateString('es-PE') : null} />
                    <Field label="Secuencia (antigüedad)" value={detail.ficha.secuencia_registro} mono />
                    <Field label="Estado físico" value={detail.ficha.estado_fisico} />
                    <Field label="Tipo formulación" value={detail.ficha.tipo_formulacion} />
                    <Field label="IDs de etiquetas (PDFs SENASA)" value={detail.ficha.etiquetas_ids} mono />
                    <Field label="Resolución directoral" value={detail.ficha.resolucion_directoral} mono />
                    <Field label="Empresa ID SAP/SENASA" value={detail.ficha.empresa_id} mono />
                    <Field label="Producto ID SIGIA" value={detail.ficha.producto_id} mono />
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <Sprout className="w-4 h-4 text-brand-600" /> Usos autorizados ({detail.usos.length})
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-gray-100">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Cultivo</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Plaga</th>
                            <th className="px-3 py-2 text-center font-semibold text-gray-600">Unidad</th>
                            <th className="px-3 py-2 text-right font-semibold text-gray-600">Dosis/ha</th>
                            <th className="px-3 py-2 text-right font-semibold text-gray-600">Dosis %</th>
                            <th className="px-3 py-2 text-right font-semibold text-gray-600">Cap. cilindro (l)</th>
                            <th className="px-3 py-2 text-right font-semibold text-gray-600">Dosis/cil.</th>
                            <th className="px-3 py-2 text-right font-semibold text-gray-600">LMR</th>
                            <th className="px-3 py-2 text-right font-semibold text-gray-600">Carencia (d)</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Observación</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {detail.usos.map((u, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-3 py-2">
                                <div className="font-semibold text-gray-800">{u.cultivo_nombre_comun}</div>
                                <div className="text-gray-400 italic">{u.cultivo_nombre_cient}</div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="text-gray-700">{u.plaga_nombre_comun}</div>
                                <div className="text-gray-400 italic">{u.plaga_nombre_cient}</div>
                              </td>
                              <td className="px-3 py-2 text-center text-xs text-gray-600">{u.unidad_medida || '—'}</td>
                              <td className="px-3 py-2 text-right font-mono">{u.dosis_hectarea ?? '—'}</td>
                              <td className="px-3 py-2 text-right font-mono">{u.dosis_porcentaje ?? '—'}</td>
                              <td className="px-3 py-2 text-right font-mono">{u.capacidad_cilindro ?? '—'}</td>
                              <td className="px-3 py-2 text-right font-mono">{u.dosis_cilindro ?? '—'}</td>
                              <td className="px-3 py-2 text-right font-mono">{u.limite_max_residuo ?? '—'}</td>
                              <td className="px-3 py-2 text-right font-mono">{u.periodo_carencia_dias ?? '—'}</td>
                              <td className="px-3 py-2 text-gray-600">{u.observacion || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {/* Etiquetas oficiales SENASA */}
                  {detail.etiquetas && detail.etiquetas.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2 mt-4">
                        <FileText className="w-4 h-4 text-amber-500" /> Etiquetas oficiales SENASA ({detail.etiquetas.length})
                      </h3>
                      <div className="overflow-x-auto rounded-xl border border-gray-100">
                        <table className="min-w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-gray-600">Presentación / Envase</th>
                              <th className="px-3 py-2 text-left font-semibold text-gray-600">Fecha registro</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-600">Tamaño</th>
                              <th className="px-3 py-2 text-center font-semibold text-gray-600">Archivo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {detail.etiquetas.map(e => (
                              <tr key={e.etiqueta_id} className="hover:bg-gray-50">
                                <td className="px-3 py-2">
                                  <div className="font-semibold text-gray-800">{e.presentacion || e.filename || '—'}</div>
                                  {e.descripcion && e.descripcion !== e.filename && <div className="text-gray-400 italic">{e.descripcion}</div>}
                                </td>
                                <td className="px-3 py-2 text-gray-700">
                                  {e.fecha_registro ? new Date(e.fecha_registro).toLocaleDateString('es-PE') : '—'}
                                </td>
                                <td className="px-3 py-2 text-right text-gray-600 font-mono">
                                  {e.tamano_bytes ? `${(e.tamano_bytes / 1024).toFixed(0)} KB` : '—'}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {e.download_url ? (
                                    <a href={e.download_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:text-brand-800 inline-flex items-center gap-1 font-semibold">
                                      <ExternalLink className="w-3 h-3" /> Abrir PDF
                                    </a>
                                  ) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-gray-400 pt-2 border-t">
                    <a href="https://servicios.senasa.gob.pe/SIGIAWeb/sigia_consulta_cultivo.html" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                      Ver en SENASA SIGIA <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ----- helpers UI -----
function KpiCard({ icon: Icon, label, value, color }: any) {
  const palette: Record<string, string> = {
    brand:   'bg-brand-50 text-brand-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    cyan:    'bg-cyan-50 text-cyan-600',
    orange:  'bg-orange-50 text-orange-600',
    amber:   'bg-amber-50 text-amber-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${palette[color] || palette.brand}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  const palette: Record<string, string> = {
    brand:   'bg-brand-100 text-brand-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    cyan:    'bg-cyan-100 text-cyan-700',
    orange:  'bg-orange-100 text-orange-700',
  };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${palette[color] || palette.brand}`}>{label}</span>;
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} className="input-field text-sm py-1.5 w-full" placeholder="Buscar…" />
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="input-field text-sm py-1.5 w-full">
        <option value="">Todos</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function SelectAnio({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: number[] }) {
  const ordered = [...new Set(options)].sort((a, b) => b - a); // años descendentes
  return (
    <div>
      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="input-field text-sm py-1.5 w-full">
        <option value="">Todos los años</option>
        {ordered.map(a => <option key={a} value={String(a)}>{a}</option>)}
      </select>
    </div>
  );
}

function TopList({ title, icon, items, onClick }: {
  title: string;
  icon: JSX.Element;
  items: { label: string; primary: number; secondary: string }[];
  onClick: (label: string) => void;
}) {
  const max = Math.max(...items.map(i => i.primary), 1);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">{icon} {title}</h3>
      <div className="space-y-1.5">
        {items.map((it, idx) => (
          <button key={idx} onClick={() => onClick(it.label)}
            className="w-full text-left group hover:bg-brand-50/40 rounded px-2 py-1.5 transition">
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className="font-semibold text-gray-700 truncate flex-1 group-hover:text-brand-700" title={it.label}>
                {idx + 1}. {it.label}
              </span>
              <span className="text-gray-500 ml-2 shrink-0">
                <strong className="text-gray-800">{it.primary}</strong>
                {it.secondary && <span className="text-gray-400"> · {it.secondary}</span>}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded">
              <div className="h-full bg-brand-400 rounded" style={{ width: `${(it.primary / max) * 100}%` }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value, mono, highlight }: { label: string; value: any; mono?: boolean; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`mt-0.5 ${mono ? 'font-mono text-xs' : 'text-sm'} ${highlight ? 'font-bold text-gray-900' : 'text-gray-700'}`}>{value || '—'}</div>
    </div>
  );
}
