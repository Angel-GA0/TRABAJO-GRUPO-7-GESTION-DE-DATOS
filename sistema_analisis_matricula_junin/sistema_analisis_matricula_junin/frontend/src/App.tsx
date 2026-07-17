import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BookOpenCheck,
  ChevronRight,
  CircleCheck,
  Download,
  Filter,
  LineChart,
  MapPinned,
  Menu,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import EChart from './components/EChart'
import MultiSelect from './components/MultiSelect'
import { number, percent, signedNumber, titleCase } from './lib/format'
import type { DashboardData, DashboardRequest, Filters, Meta } from './types'

const COLORS = {
  navy: '#102A43',
  blue: '#2563EB',
  teal: '#0F766E',
  green: '#15803D',
  amber: '#D97706',
  red: '#C2413A',
  softRed: '#FEE2E2',
  softGreen: '#DCFCE7',
  gray: '#64748B',
  grid: '#E2E8F0',
  purple: '#6D5BD0',
}

const initialFilters: Filters = {
  province: null,
  district: null,
  ugel: null,
  levels: [],
  managements: [],
  areas: [],
}

const nav = [
  { id: 'resumen', label: 'Resumen general', icon: Activity },
  { id: 'evolucion', label: 'Evolución y comparación', icon: LineChart },
  { id: 'proyeccion', label: 'Proyección 2025–2026', icon: TrendingUp },
  { id: 'alertas', label: 'Alertas y priorización', icon: AlertTriangle },
  { id: 'metodologia', label: 'Metodología y calidad', icon: ShieldCheck },
]

function App() {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [quality, setQuality] = useState<any>(null)
  const [active, setActive] = useState('resumen')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [request, setRequest] = useState<DashboardRequest>({
    start_year: 2021,
    end_year: 2024,
    comparison_group: 'provincia',
    alert_group: 'provincia',
    filters: initialFilters,
  })

  useEffect(() => {
    Promise.all([fetch('/api/meta').then((r) => r.json()), fetch('/api/quality').then((r) => r.json())])
      .then(([metaData, qualityData]) => {
        setMeta(metaData)
        setQuality(qualityData)
      })
      .catch(() => setError('No se pudo cargar la configuración inicial.'))
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError(null)
      fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
        .then(async (r) => {
          if (!r.ok) throw new Error((await r.json()).detail || 'Error de análisis')
          return r.json()
        })
        .then(setData)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(timer)
  }, [request])

  const availableDistricts = useMemo(() => {
    if (!meta) return []
    if (request.filters.province) return meta.districts_by_province[request.filters.province] || []
    return Object.values(meta.districts_by_province).flat().filter((v, i, a) => a.indexOf(v) === i).sort()
  }, [meta, request.filters.province])

  const context = data?.summary?.context || 'Departamento de Junín'
  const resetFilters = () => setRequest((r) => ({ ...r, filters: initialFilters, start_year: 2021, end_year: 2024 }))

  const exportExcel = async () => {
    const response = await fetch('/api/export/excel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'informe_matricula_junin.xlsx'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><MapPinned size={23} /></div>
          <div><strong>Matrícula Junín</strong><span>Análisis y alerta educativa</span></div>
          <button className="mobile-close" onClick={() => setSidebarOpen(false)}><X size={20} /></button>
        </div>
        <nav>
          {nav.map((item) => {
            const Icon = item.icon
            return (
              <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => { setActive(item.id); setSidebarOpen(false) }}>
                <Icon size={18} /><span>{item.label}</span><ChevronRight size={15} className="nav-arrow" />
              </button>
            )
          })}
        </nav>
        <div className="sidebar-note">
          <BookOpenCheck size={18} />
          <div><strong>Alcance</strong><span>Junín · 2021–2024<br />Proyección 2025–2026</span></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setSidebarOpen(true)}><Menu size={22} /></button>
          <div className="topbar-title">
            <span className="eyebrow">Sistema de análisis, proyección y alerta</span>
            <h1>Matrícula escolar en Junín</h1>
          </div>
          <div className="topbar-actions">
            <button className="secondary-button" onClick={() => setFilterOpen(!filterOpen)}><Filter size={17} /> Filtros</button>
            <button className="primary-button" onClick={exportExcel}><Download size={17} /> Informe Excel</button>
          </div>
        </header>

        <section className="context-bar">
          <div><span>Ámbito activo</span><strong>{context}</strong></div>
          <div className="period-pill">Comparación {request.start_year}–{request.end_year}</div>
          <button onClick={resetFilters}><RefreshCcw size={15} /> Restablecer</button>
        </section>

        {filterOpen && meta && (
          <FilterPanel
            meta={meta}
            request={request}
            setRequest={setRequest}
            districts={availableDistricts}
            close={() => setFilterOpen(false)}
          />
        )}

        <div className="content">
          {error && <div className="error-banner"><AlertTriangle size={20} />{error}</div>}
          {loading && <Loading />}
          {!loading && data && active === 'resumen' && <SummaryPage data={data} request={request} setActive={setActive} />}
          {!loading && data && active === 'evolucion' && <EvolutionPage data={data} request={request} setRequest={setRequest} meta={meta!} />}
          {!loading && data && active === 'proyeccion' && <ProjectionPage data={data} />}
          {!loading && data && active === 'alertas' && <AlertsPage data={data} request={request} setRequest={setRequest} meta={meta!} />}
          {!loading && active === 'metodologia' && quality && <QualityPage quality={quality} />}
        </div>
      </main>
    </div>
  )
}

function FilterPanel({ meta, request, setRequest, districts, close }: { meta: Meta; request: DashboardRequest; setRequest: React.Dispatch<React.SetStateAction<DashboardRequest>>; districts: string[]; close: () => void }) {
  const setFilter = (key: keyof Filters, value: any) => setRequest((r) => ({ ...r, filters: { ...r.filters, [key]: value } }))
  return (
    <section className="filter-panel">
      <div className="filter-panel-head"><div><Filter size={18} /><strong>Configurar análisis</strong><span>Los resultados se actualizan automáticamente.</span></div><button onClick={close}><X size={19} /></button></div>
      <div className="filter-grid">
        <div className="field"><label>Provincia</label><select value={request.filters.province || ''} onChange={(e) => { setFilter('province', e.target.value || null); setFilter('district', null) }}><option value="">Todas</option>{meta.provinces.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="field"><label>Distrito</label><select value={request.filters.district || ''} onChange={(e) => setFilter('district', e.target.value || null)}><option value="">Todos</option>{districts.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="field"><label>UGEL</label><select value={request.filters.ugel || ''} onChange={(e) => setFilter('ugel', e.target.value || null)}><option value="">Todas</option>{meta.ugels.map((x) => <option key={x}>{x}</option>)}</select></div>
        <MultiSelect label="Nivel educativo" options={meta.levels} value={request.filters.levels} onChange={(v) => setFilter('levels', v)} />
        <MultiSelect label="Gestión" options={meta.managements} value={request.filters.managements} onChange={(v) => setFilter('managements', v)} />
        <MultiSelect label="Área" options={meta.areas} value={request.filters.areas} onChange={(v) => setFilter('areas', v)} />
      </div>
    </section>
  )
}

function Loading() {
  return <div className="loading"><div className="spinner" /><strong>Procesando el análisis</strong><span>Calculando evolución, comparación, proyección y señales territoriales…</span></div>
}

function SectionHeader({ kicker, title, description, action }: { kicker: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="section-head"><div><span className="section-kicker">{kicker}</span><h2>{title}</h2><p>{description}</p></div>{action}</div>
}

function MetricCard({ icon, label, value, detail, tone = 'blue' }: { icon: React.ReactNode; label: string; value: string; detail: string; tone?: string }) {
  return <article className={`metric-card tone-${tone}`}><div className="metric-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>
}

function SummaryPage({ data, request, setActive }: { data: any; request: DashboardRequest; setActive: (v: string) => void }) {
  const s = data.summary
  const totalEvolutionOption = buildObservedForecastOption(data.projection)
  const topAlerts = data.alerts.rows.filter((x: any) => x.classification !== 'Comportamiento estable').slice(0, 5)
  const changePositive = (s.percentage_change || 0) >= 0

  return (
    <>
      <section className="hero-card">
        <div className="hero-copy"><span className="hero-kicker"><Sparkles size={15} /> Lectura ejecutiva del periodo</span><h2>¿Qué cambió, qué podría ocurrir y dónde conviene prestar atención?</h2><div className="narrative">{s.narrative.map((text: string) => <p key={text}>{text}</p>)}</div></div>
        <div className="hero-badge"><Target size={28} /><strong>{s.context}</strong><span>Resultados calculados con los filtros activos</span></div>
      </section>

      <div className="metrics-grid">
        <MetricCard icon={<Users size={22} />} label={`Matrícula ${request.start_year}`} value={number(s.start_total)} detail="Punto de partida seleccionado" />
        <MetricCard icon={<Users size={22} />} label={`Matrícula ${request.end_year}`} value={number(s.end_total)} detail="Punto final seleccionado" tone="teal" />
        <MetricCard icon={changePositive ? <ArrowUpRight size={22} /> : <ArrowDownRight size={22} />} label="Cambio del periodo" value={percent(s.percentage_change)} detail={`${signedNumber(s.absolute_change)} estudiantes`} tone={changePositive ? 'green' : 'red'} />
        <MetricCard icon={<TrendingUp size={22} />} label="Proyección 2025" value={number(s.forecast_2025)} detail={`Método: ${data.projection.model}`} tone="purple" />
        <MetricCard icon={<TrendingUp size={22} />} label="Proyección 2026" value={number(s.forecast_2026)} detail="Proyección tendencial referencial" tone="purple" />
        <MetricCard icon={<AlertTriangle size={22} />} label="Ámbitos con atención" value={number(s.attention_count)} detail={`${number(s.growth_count)} con demanda creciente`} tone="amber" />
      </div>

      <div className="two-column wide-left">
        <article className="panel">
          <PanelTitle title="Evolución observada y proyección referencial" subtitle="La línea continua corresponde a datos observados; la discontinua a 2025–2026." />
          <EChart option={totalEvolutionOption} height={400} />
        </article>
        <article className="panel priority-panel">
          <PanelTitle title="Señales territoriales destacadas" subtitle="Los primeros ámbitos según cantidad y combinación de señales." />
          <div className="priority-list">
            {topAlerts.map((row: any, index: number) => (
              <div className="priority-item" key={row.territory}>
                <span className="rank">{index + 1}</span>
                <div><strong>{titleCase(row.territory)}</strong><span>{row.attention_signals[0] || row.growth_signals[0]}</span></div>
                <Badge value={row.classification} />
              </div>
            ))}
          </div>
          <button className="text-button" onClick={() => setActive('alertas')}>Ver priorización completa <ChevronRight size={16} /></button>
        </article>
      </div>

      <div className="insight-grid">
        <Insight icon={<BarChart3 />} title="Evolución completa" text="Revise la trayectoria 2021–2024 y compare cualquier par de años sin limitar el análisis a 2024." action="Explorar evolución" onClick={() => setActive('evolucion')} />
        <Insight icon={<TrendingUp />} title="Proyección sustentada" text="Conozca el método elegido, su validación retrospectiva y el rango de sensibilidad para 2025–2026." action="Revisar proyección" onClick={() => setActive('proyeccion')} />
        <Insight icon={<AlertTriangle />} title="Prioridad explicable" text="Cada señal indica la evidencia observada y una acción de revisión, sin puntajes ocultos." action="Analizar alertas" onClick={() => setActive('alertas')} />
      </div>
    </>
  )
}

function EvolutionPage({ data, request, setRequest, meta }: { data: any; request: DashboardRequest; setRequest: React.Dispatch<React.SetStateAction<DashboardRequest>>; meta: Meta }) {
  const [view, setView] = useState<'serie' | 'comparacion' | 'trayectoria'>('serie')
  const evolutionOption = buildLevelsOption(data.evolution)
  const comparisonOption = buildDivergingOption(data.comparison.rows)
  const slopeOption = buildSlopeOption(data.comparison.rows, request.start_year, request.end_year)
  const heatmapOption = buildHeatmapOption(data.comparison.heatmap)
  const scatterOption = buildTrajectoryScatter(data.comparison.rows)

  return (
    <>
      <SectionHeader
        kicker="Análisis histórico"
        title="Evolución y comparación temporal"
        description="Observe los cuatro años o seleccione dos periodos para medir cuánto cambió cada ámbito territorial o nivel educativo."
        action={<PeriodControls request={request} setRequest={setRequest} meta={meta} />}
      />
      <div className="segmented">
        <button className={view === 'serie' ? 'active' : ''} onClick={() => setView('serie')}>Serie 2021–2024</button>
        <button className={view === 'comparacion' ? 'active' : ''} onClick={() => setView('comparacion')}>Comparación entre años</button>
        <button className={view === 'trayectoria' ? 'active' : ''} onClick={() => setView('trayectoria')}>Atraso y retiro</button>
      </div>

      {view === 'serie' && (
        <>
          <div className="two-column wide-left">
            <article className="panel"><PanelTitle title="Matrícula por nivel educativo" subtitle="Inicial, Primaria y Secundaria a través de los cuatro años observados." /><EChart option={evolutionOption} height={420} /></article>
            <article className="panel"><PanelTitle title="Lectura anual" subtitle="Variación de la matrícula total frente al año anterior." /><YearChangeCards values={data.evolution.overall} /></article>
          </div>
          <article className="panel"><PanelTitle title="Mapa de cambios anuales" subtitle="Cada celda muestra la variación porcentual frente al año anterior. Permite identificar persistencia o cambios de dirección." /><EChart option={heatmapOption} height={Math.max(360, data.comparison.rows.length * 28)} /></article>
        </>
      )}

      {view === 'comparacion' && (
        <>
          <ComparisonToolbar request={request} setRequest={setRequest} meta={meta} />
          <div className="two-column">
            <article className="panel"><PanelTitle title={`Cambio porcentual ${request.start_year}–${request.end_year}`} subtitle="Barras a la izquierda indican disminución; a la derecha, crecimiento." /><EChart option={comparisonOption} height={480} /></article>
            <article className="panel"><PanelTitle title="Punto inicial frente a punto final" subtitle="Conecta la matrícula de cada ámbito entre los dos años elegidos." /><EChart option={slopeOption} height={480} /></article>
          </div>
          <ComparisonTable rows={data.comparison.rows} startYear={request.start_year} endYear={request.end_year} />
        </>
      )}

      {view === 'trayectoria' && (
        <>
          <div className="two-column wide-left">
            <article className="panel"><PanelTitle title="Cambio de matrícula y atraso escolar" subtitle="El tamaño del punto representa la matrícula del año final. Los cuadrantes facilitan la lectura conjunta." /><EChart option={scatterOption} height={500} /></article>
            <article className="panel"><PanelTitle title="Indicadores de trayectoria" subtitle="Tasas respecto a la matrícula anual del ámbito seleccionado." /><TrajectoryCards values={data.evolution.overall} /></article>
          </div>
          <div className="method-note"><AlertTriangle size={19} /><div><strong>Interpretación responsable</strong><p>La coincidencia entre una variación de matrícula y un cambio del atraso o retiro no prueba causalidad. El sistema identifica señales para revisión, no causas definitivas.</p></div></div>
        </>
      )}
    </>
  )
}

function ProjectionPage({ data }: { data: any }) {
  const p = data.projection
  return (
    <>
      <SectionHeader kicker="Estimación referencial" title="Proyección tendencial 2025–2026" description="La estimación prolonga la trayectoria observada mediante un método simple, validado retrospectivamente y fácil de explicar." />
      <div className="projection-banner"><div><span>Método seleccionado</span><strong>{p.model}</strong><p>Se eligió el método con menor error al intentar estimar 2024 usando únicamente la información disponible hasta 2023.</p></div><div className="projection-values"><div><span>2025</span><strong>{number(p.forecast?.[0]?.value)}</strong></div><div><span>2026</span><strong>{number(p.forecast?.[1]?.value)}</strong></div></div></div>
      <article className="panel"><PanelTitle title="Serie observada, estimación y sensibilidad" subtitle="La franja muestra un rango de sensibilidad basado en el desacuerdo entre métodos y el error retrospectivo." /><EChart option={buildObservedForecastOption(p, true)} height={500} /></article>
      <div className="two-column">
        <article className="panel"><PanelTitle title="Validación retrospectiva" subtitle="Prueba del método antes de proyectar 2025–2026." /><BacktestCard backtest={p.backtest} /></article>
        <article className="panel"><PanelTitle title="Comparación de métodos" subtitle="Valores obtenidos por los dos métodos transparentes considerados." /><MethodComparison alternatives={p.alternatives} /></article>
      </div>
      <article className="panel"><PanelTitle title="Proyección por nivel educativo" subtitle="La dirección esperada puede ser distinta entre Inicial, Primaria y Secundaria." /><LevelProjectionCards rows={data.projection_by_level} /></article>
      <div className="method-note"><ShieldCheck size={20} /><div><strong>Alcance de la proyección</strong><p>Se denomina proyección tendencial referencial porque utiliza solo cuatro observaciones anuales. Sirve para anticipar una dirección posible y orientar la revisión, no para afirmar con certeza cuántos estudiantes habrá.</p></div></div>
    </>
  )
}

function AlertsPage({ data, request, setRequest, meta }: { data: any; request: DashboardRequest; setRequest: React.Dispatch<React.SetStateAction<DashboardRequest>>; meta: Meta }) {
  const [filter, setFilter] = useState('Todos')
  const rows = data.alerts.rows.filter((row: any) => filter === 'Todos' || row.classification === filter)
  const classes = ['Todos', 'Atención prioritaria', 'Seguimiento', 'Demanda creciente', 'Comportamiento estable']
  return (
    <>
      <SectionHeader
        kicker="Señales para la gestión"
        title="Alertas y priorización territorial"
        description="La clasificación se sustenta en cambios observados, persistencia, atraso, retiro y dirección proyectada. Cada resultado puede auditarse."
        action={<div className="field compact"><label>Analizar por</label><select value={request.alert_group} onChange={(e) => setRequest((r) => ({ ...r, alert_group: e.target.value }))}>{meta.comparison_groups.slice(0, 3).map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select></div>}
      />
      <div className="alert-summary">
        <AlertStat label="Atención prioritaria" value={data.alerts.rows.filter((r: any) => r.classification === 'Atención prioritaria').length} tone="red" />
        <AlertStat label="Seguimiento" value={data.alerts.rows.filter((r: any) => r.classification === 'Seguimiento').length} tone="amber" />
        <AlertStat label="Demanda creciente" value={data.alerts.rows.filter((r: any) => r.classification === 'Demanda creciente').length} tone="green" />
        <AlertStat label="Comportamiento estable" value={data.alerts.rows.filter((r: any) => r.classification === 'Comportamiento estable').length} tone="gray" />
      </div>
      <div className="classification-tabs">{classes.map((c) => <button className={filter === c ? 'active' : ''} onClick={() => setFilter(c)} key={c}>{c}</button>)}</div>
      <div className="alerts-list">{rows.map((row: any) => <AlertCard key={row.territory} row={row} />)}</div>
      <article className="panel threshold-panel"><PanelTitle title="Cómo se determinan las señales" subtitle="Los límites de disminución y crecimiento provienen de los cuartiles del comportamiento real de los territorios filtrados." /><Thresholds values={data.alerts.thresholds} /></article>
    </>
  )
}

function QualityPage({ quality }: { quality: any }) {
  return (
    <>
      <SectionHeader kicker="Trazabilidad del proyecto" title="Metodología y calidad de datos" description="Esta sección evidencia el proceso ETL, las validaciones aplicadas y las condiciones bajo las cuales deben interpretarse los resultados." />
      <div className="quality-grid">{quality.metrics.map((m: any) => <div className="quality-card" key={m.label}><CircleCheck size={20} /><span>{m.label}</span><strong>{number(m.value)}</strong></div>)}</div>
      <div className="two-column wide-left">
        <article className="panel"><PanelTitle title="Flujo de preparación e integración" subtitle="Desde las fuentes originales hasta las dos bases finales conciliadas." /><div className="etl-flow">{quality.flow.map((step: string, i: number) => <div className="etl-step" key={step}><span>{i + 1}</span><p>{step}</p>{i < quality.flow.length - 1 && <ChevronRight size={18} />}</div>)}</div></article>
        <article className="panel"><PanelTitle title="Limitaciones y uso responsable" subtitle="Condiciones importantes para evitar conclusiones excesivas." /><div className="limitations">{quality.limitations.map((item: string) => <div key={item}><AlertTriangle size={17} /><p>{item}</p></div>)}</div></article>
      </div>
      <article className="panel"><PanelTitle title="Totales anuales conciliados" subtitle="Los resultados de la base histórica y resumida coinciden exactamente." /><AnnualQualityTable rows={quality.annual_totals} /></article>
    </>
  )
}

function PanelTitle({ title, subtitle }: { title: string; subtitle: string }) { return <div className="panel-title"><h3>{title}</h3><p>{subtitle}</p></div> }
function Badge({ value }: { value: string }) { return <span className={`badge ${value.toLowerCase().replace(/ /g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`}>{value}</span> }
function Insight({ icon, title, text, action, onClick }: any) { return <article className="insight"><div className="insight-icon">{icon}</div><h3>{title}</h3><p>{text}</p><button onClick={onClick}>{action}<ChevronRight size={16} /></button></article> }

function PeriodControls({ request, setRequest, meta }: any) {
  return <div className="period-controls"><div className="field compact"><label>Año inicial</label><select value={request.start_year} onChange={(e) => setRequest((r: any) => ({ ...r, start_year: Number(e.target.value) }))}>{meta.years.filter((y: number) => y < request.end_year).map((y: number) => <option key={y}>{y}</option>)}</select></div><div className="arrow-separator">→</div><div className="field compact"><label>Año final</label><select value={request.end_year} onChange={(e) => setRequest((r: any) => ({ ...r, end_year: Number(e.target.value) }))}>{meta.years.filter((y: number) => y > request.start_year).map((y: number) => <option key={y}>{y}</option>)}</select></div></div>
}
function ComparisonToolbar({ request, setRequest, meta }: any) { return <div className="comparison-toolbar"><div><strong>Comparar</strong><span>Seleccione el nivel territorial o categoría que desea ordenar y contrastar.</span></div><div className="field compact"><label>Agrupar por</label><select value={request.comparison_group} onChange={(e) => setRequest((r: any) => ({ ...r, comparison_group: e.target.value }))}>{meta.comparison_groups.map((g: any) => <option value={g.value} key={g.value}>{g.label}</option>)}</select></div></div> }

function YearChangeCards({ values }: any) {
  return <div className="year-change-list">{values.slice(1).map((row: any, i: number) => { const prev = values[i]; const pct = ((row.enrollment - prev.enrollment) / prev.enrollment) * 100; return <div className="year-change" key={row.year}><div><span>{prev.year} → {row.year}</span><strong>{pct >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}{percent(pct)}</strong></div><p>{signedNumber(row.enrollment - prev.enrollment)} estudiantes</p></div> })}</div>
}
function TrajectoryCards({ values }: any) { const last = values[values.length - 1]; const first = values[0]; return <div className="trajectory-cards"><div><span>Tasa de atraso {first.year}</span><strong>{number(first.delay_rate, 2)} %</strong></div><div><span>Tasa de atraso {last.year}</span><strong>{number(last.delay_rate, 2)} %</strong><small>{signedNumber(last.delay_rate - first.delay_rate, 2)} pp</small></div><div><span>Tasa de retiro {first.year}</span><strong>{number(first.retirement_rate, 2)} %</strong></div><div><span>Tasa de retiro {last.year}</span><strong>{number(last.retirement_rate, 2)} %</strong><small>{signedNumber(last.retirement_rate - first.retirement_rate, 2)} pp</small></div></div> }

function ComparisonTable({ rows, startYear, endYear }: any) {
  const [sort, setSort] = useState('percentage_change')
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc')
  const sorted = [...rows].sort((a, b) => (a[sort] - b[sort]) * (direction === 'asc' ? 1 : -1))
  const clickSort = (key: string) => { if (sort === key) setDirection(direction === 'asc' ? 'desc' : 'asc'); else { setSort(key); setDirection('asc') } }
  return <article className="panel table-panel"><PanelTitle title="Detalle comparativo" subtitle="Ordene los resultados para encontrar disminuciones, crecimientos o mayores volúmenes." /><div className="table-wrap"><table><thead><tr><th>Ámbito</th><th onClick={() => clickSort('start')}>{startYear}</th><th onClick={() => clickSort('end')}>{endYear}</th><th onClick={() => clickSort('absolute_change')}>Cambio absoluto</th><th onClick={() => clickSort('percentage_change')}>Cambio %</th><th>Atraso (pp)</th><th>Comportamiento</th></tr></thead><tbody>{sorted.map((r: any) => <tr key={r.territory}><td><strong>{titleCase(r.territory)}</strong></td><td>{number(r.start)}</td><td>{number(r.end)}</td><td className={r.absolute_change < 0 ? 'negative' : 'positive'}>{signedNumber(r.absolute_change)}</td><td className={r.percentage_change < 0 ? 'negative' : 'positive'}>{percent(r.percentage_change)}</td><td>{signedNumber(r.delay_rate_change_pp, 2)}</td><td><span className={`trend ${r.trend.toLowerCase()}`}>{r.trend}</span></td></tr>)}</tbody></table></div></article>
}

function BacktestCard({ backtest }: any) { if (!backtest) return <p>Datos insuficientes.</p>; return <div className="backtest"><div className="backtest-flow"><div><span>Entrenamiento</span><strong>{backtest.train_period}</strong></div><ChevronRight /><div><span>Estimación {backtest.estimated_year}</span><strong>{number(backtest.estimated_value)}</strong></div><ChevronRight /><div><span>Valor real</span><strong>{number(backtest.actual_value)}</strong></div></div><div className="error-result"><Target size={22} /><div><span>Error porcentual absoluto</span><strong>{number(backtest.percentage_error, 2)} %</strong><small>{number(backtest.absolute_error)} estudiantes de diferencia</small></div></div></div> }
function MethodComparison({ alternatives }: any) { return <div className="method-comparison"><div><span>Tendencia lineal</span><strong>{number(alternatives.linear_2025)}</strong><small>2025</small><strong>{number(alternatives.linear_2026)}</strong><small>2026</small></div><div><span>Cambio medio anual</span><strong>{number(alternatives.average_2025)}</strong><small>2025</small><strong>{number(alternatives.average_2026)}</strong><small>2026</small></div></div> }
function LevelProjectionCards({ rows }: any) { return <div className="level-projection-grid">{rows.map((r: any) => { const f25 = r.forecast?.find((x: any) => x.year === 2025)?.value; const f26 = r.forecast?.find((x: any) => x.year === 2026)?.value; const last = r.observed?.[r.observed.length - 1]?.value; const pct = last ? ((f26 - last) / last) * 100 : 0; return <div className="level-projection" key={r.level}><div className={`level-dot ${r.level.toLowerCase()}`} /><span>{r.level}</span><strong>{number(f26)}</strong><small>Proyección 2026</small><div className={pct < 0 ? 'direction down' : 'direction up'}>{pct < 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />}{percent(pct)} frente a 2024</div><p>{r.model}</p></div> })}</div> }
function AlertStat({ label, value, tone }: any) { return <div className={`alert-stat ${tone}`}><span>{label}</span><strong>{value}</strong></div> }
function AlertCard({ row }: any) { const signals = row.attention_signals.length ? row.attention_signals : row.growth_signals; return <article className="alert-card"><div className="alert-card-head"><div><Badge value={row.classification} /><h3>{titleCase(row.territory)}</h3></div><div className="alert-change"><span>Cambio del periodo</span><strong className={(row.change_pct || 0) < 0 ? 'negative' : 'positive'}>{percent(row.change_pct)}</strong></div></div><div className="alert-body"><div className="signal-list">{signals.map((s: string) => <div key={s}>{row.attention_signals.length ? <AlertTriangle size={16} /> : <TrendingUp size={16} />}<span>{s}</span></div>)}</div><MiniSeries values={row.series} /><div className="action-box"><strong>Acción de revisión sugerida</strong><p>{row.action}</p></div></div></article> }
function MiniSeries({ values }: any) { return <div className="mini-series">{values.map((v: any, i: number) => { const min = Math.min(...values.map((x: any) => x.value)); const max = Math.max(...values.map((x: any) => x.value)); const h = max === min ? 55 : 25 + ((v.value - min) / (max - min)) * 55; return <div key={v.year}><span style={{ height: h }} /><small>{v.year}</small></div> })}</div> }
function Thresholds({ values }: any) { return <div className="threshold-grid"><div><span>Cuartil inferior acumulado</span><strong>{percent(values.cumulative_low)}</strong></div><div><span>Cuartil superior acumulado</span><strong>{percent(values.cumulative_high)}</strong></div><div><span>Cuartil inferior reciente</span><strong>{percent(values.recent_low)}</strong></div><div><span>Cuartil superior reciente</span><strong>{percent(values.recent_high)}</strong></div><div><span>Cuartil superior de atraso</span><strong>{signedNumber(values.delay_high, 2)} pp</strong></div><div><span>Cuartil superior de retiro</span><strong>{signedNumber(values.retirement_high, 2)} pp</strong></div></div> }
function AnnualQualityTable({ rows }: any) { return <div className="table-wrap"><table><thead><tr><th>Año</th><th>Matrícula</th><th>Mujeres</th><th>Hombres</th><th>Retirados</th><th>Atraso</th></tr></thead><tbody>{rows.map((r: any) => <tr key={r.year}><td><strong>{r.year}</strong></td><td>{number(r.total_estudiantes)}</td><td>{number(r.mujeres)}</td><td>{number(r.hombres)}</td><td>{number(r.retirados)}</td><td>{number(r.total_atraso)}</td></tr>)}</tbody></table></div> }

function buildObservedForecastOption(p: any, detailed = false): any {
  const years = [...p.observed.map((x: any) => x.year), ...p.forecast.map((x: any) => x.year)]
  const observed = years.map((year) => p.observed.find((x: any) => x.year === year)?.value ?? (year === 2025 ? p.observed[p.observed.length - 1]?.value : null))
  const forecast = years.map((year) => year === 2024 ? p.observed[p.observed.length - 1]?.value : p.forecast.find((x: any) => x.year === year)?.value ?? null)
  const lower = years.map((year) => p.forecast.find((x: any) => x.year === year)?.lower ?? null)
  const upper = years.map((year) => p.forecast.find((x: any) => x.year === year)?.upper ?? null)
  return {
    tooltip: { trigger: 'axis', valueFormatter: (v: any) => number(v) },
    legend: { bottom: 0, data: ['Matrícula observada', 'Proyección referencial', ...(detailed ? ['Rango de sensibilidad'] : [])] },
    grid: { left: 64, right: 30, top: 30, bottom: 70 },
    xAxis: { type: 'category', data: years, axisLine: { lineStyle: { color: COLORS.grid } }, axisTick: { show: false } },
    yAxis: { type: 'value', scale: true, splitLine: { lineStyle: { color: '#EEF2F7' } }, axisLabel: { formatter: (v: number) => Intl.NumberFormat('es-PE', { notation: 'compact' }).format(v) } },
    series: [
      ...(detailed ? [
        { name: 'Rango inferior', type: 'line', data: lower, stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 } },
        { name: 'Rango de sensibilidad', type: 'line', data: upper.map((v: any, i: number) => v && lower[i] ? v - lower[i] : null), stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { color: 'rgba(109,91,208,.16)' } },
      ] : []),
      { name: 'Matrícula observada', type: 'line', data: observed, smooth: 0.2, symbolSize: 9, lineStyle: { width: 4, color: COLORS.navy }, itemStyle: { color: COLORS.navy }, label: { show: true, position: 'top', formatter: ({ value }: any) => value ? number(value) : '' } },
      { name: 'Proyección referencial', type: 'line', data: forecast, smooth: 0.2, symbolSize: 9, lineStyle: { width: 4, type: 'dashed', color: COLORS.purple }, itemStyle: { color: COLORS.purple }, label: { show: true, position: 'top', formatter: ({ value }: any) => value ? number(value) : '' }, markLine: { silent: true, symbol: 'none', data: [{ xAxis: 2024, lineStyle: { color: '#94A3B8', type: 'dotted' }, label: { formatter: 'Inicio de proyección', color: COLORS.gray } }] } },
    ],
  }
}

function buildLevelsOption(e: any): any {
  const years = e.overall.map((x: any) => x.year)
  const colors: Record<string, string> = { Inicial: '#0EA5A4', Primaria: '#2563EB', Secundaria: '#6D5BD0' }
  return { tooltip: { trigger: 'axis', valueFormatter: (v: any) => number(v) }, legend: { bottom: 0 }, grid: { left: 65, right: 30, top: 35, bottom: 70 }, xAxis: { type: 'category', data: years, boundaryGap: false }, yAxis: { type: 'value', scale: true, splitLine: { lineStyle: { color: '#EEF2F7' } }, axisLabel: { formatter: (v: number) => Intl.NumberFormat('es-PE', { notation: 'compact' }).format(v) } }, series: Object.entries(e.levels).map(([level, rows]: any) => ({ name: level, type: 'line', smooth: 0.25, symbolSize: 8, lineStyle: { width: 3, color: colors[level] }, itemStyle: { color: colors[level] }, data: years.map((y: number) => rows.find((r: any) => r.year === y)?.enrollment || 0), label: { show: true, formatter: ({ value }: any) => number(value) } })) }
}
function buildDivergingOption(rows: any[]): any { const selected = [...rows].sort((a, b) => a.percentage_change - b.percentage_change).slice(0, 18); return { tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: any) => `${number(v, 2)} %` }, grid: { left: 150, right: 55, top: 20, bottom: 40 }, xAxis: { type: 'value', splitLine: { lineStyle: { color: '#EEF2F7' } }, axisLabel: { formatter: '{value} %' } }, yAxis: { type: 'category', data: selected.map((r) => titleCase(r.territory)), axisLabel: { width: 135, overflow: 'truncate' } }, series: [{ type: 'bar', data: selected.map((r) => ({ value: r.percentage_change, itemStyle: { color: r.percentage_change < 0 ? COLORS.red : COLORS.teal } })), barMaxWidth: 18, label: { show: true, position: (p: any) => p.value < 0 ? 'left' : 'right', formatter: ({ value }: any) => `${number(value, 1)} %` } }] } }
function buildSlopeOption(rows: any[], startYear: number, endYear: number): any { const selected = [...rows].sort((a, b) => Math.abs(b.absolute_change) - Math.abs(a.absolute_change)).slice(0, 12); return { tooltip: { trigger: 'item', formatter: (p: any) => `${p.seriesName}<br>${p.name}: ${number(p.value)}` }, grid: { left: 80, right: 80, top: 35, bottom: 45 }, xAxis: { type: 'category', data: [startYear, endYear], axisTick: { show: false } }, yAxis: { type: 'value', scale: true, splitLine: { lineStyle: { color: '#EEF2F7' } }, axisLabel: { formatter: (v: number) => Intl.NumberFormat('es-PE', { notation: 'compact' }).format(v) } }, series: selected.map((r, i) => ({ name: titleCase(r.territory), type: 'line', data: [r.start, r.end], symbolSize: 7, lineStyle: { width: i < 5 ? 2.5 : 1.5, opacity: i < 5 ? 1 : .45, color: r.absolute_change < 0 ? COLORS.red : COLORS.teal }, itemStyle: { color: r.absolute_change < 0 ? COLORS.red : COLORS.teal }, label: { show: i < 5, formatter: ({ dataIndex }: any) => dataIndex === 1 ? titleCase(r.territory) : '', position: 'right', color: COLORS.navy } })) } }
function buildHeatmapOption(rows: any[]): any { const territories = [...new Set(rows.map((r) => r.territory))]; const periods = [...new Set(rows.map((r) => r.period))]; const values = rows.map((r) => [periods.indexOf(r.period), territories.indexOf(r.territory), r.change_pct]); const max = Math.max(...rows.map((r) => Math.abs(r.change_pct || 0)), 1); return { tooltip: { formatter: (p: any) => `${titleCase(territories[p.value[1]])}<br>${periods[p.value[0]]}: ${number(p.value[2], 2)} %` }, grid: { left: 145, right: 50, top: 20, bottom: 70 }, xAxis: { type: 'category', data: periods, splitArea: { show: true } }, yAxis: { type: 'category', data: territories.map(titleCase), axisLabel: { width: 130, overflow: 'truncate' }, splitArea: { show: true } }, visualMap: { min: -max, max, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#B91C1C', '#FEE2E2', '#F8FAFC', '#CCFBF1', '#0F766E'] }, text: ['Crecimiento', 'Disminución'] }, series: [{ type: 'heatmap', data: values, label: { show: true, formatter: ({ value }: any) => `${number(value[2], 1)}%`, color: '#334155' }, emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,.2)' } } }] } }
function buildTrajectoryScatter(rows: any[]): any { const maxSize = Math.max(...rows.map((r) => r.end), 1); return { tooltip: { formatter: (p: any) => `${titleCase(p.data.name)}<br>Cambio matrícula: ${number(p.data.value[0], 2)} %<br>Cambio atraso: ${number(p.data.value[1], 2)} pp<br>Matrícula final: ${number(p.data.value[2])}` }, grid: { left: 70, right: 30, top: 45, bottom: 70 }, xAxis: { name: 'Cambio de matrícula (%)', nameLocation: 'middle', nameGap: 42, splitLine: { lineStyle: { color: '#EEF2F7' } }, axisLine: { onZero: true, lineStyle: { color: '#94A3B8' } } }, yAxis: { name: 'Cambio de tasa de atraso (pp)', nameLocation: 'middle', nameGap: 50, splitLine: { lineStyle: { color: '#EEF2F7' } }, axisLine: { onZero: true, lineStyle: { color: '#94A3B8' } } }, series: [{ type: 'scatter', data: rows.map((r) => ({ name: r.territory, value: [r.percentage_change || 0, r.delay_rate_change_pp || 0, r.end], symbolSize: 12 + Math.sqrt(r.end / maxSize) * 36, itemStyle: { color: (r.percentage_change || 0) < 0 && (r.delay_rate_change_pp || 0) > 0 ? COLORS.red : (r.percentage_change || 0) > 0 && (r.delay_rate_change_pp || 0) <= 0 ? COLORS.teal : COLORS.amber, opacity: .82 } })), label: { show: rows.length <= 15, formatter: ({ name }: any) => titleCase(name), position: 'top', fontSize: 10 }, markArea: { silent: true, data: [[{ xAxis: -Infinity, yAxis: 0, itemStyle: { color: 'rgba(194,65,58,.05)' }, label: { show: true, formatter: 'Matrícula baja / atraso sube', color: COLORS.red } }, { xAxis: 0, yAxis: Infinity }], [{ xAxis: 0, yAxis: -Infinity, itemStyle: { color: 'rgba(15,118,110,.05)' }, label: { show: true, formatter: 'Matrícula sube / atraso baja', color: COLORS.teal } }, { xAxis: Infinity, yAxis: 0 }]] } }] } }

export default App
