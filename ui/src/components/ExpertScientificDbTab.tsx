import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Loader2, Download, RefreshCw, Eye, Trash2, X,
  Table2, BarChart2, Activity, CheckSquare, Brain,
  GitCompare, Server, MapPin, Grid3x3, Layers,
  Settings, Play, AlertCircle, Clock, Cpu, HardDrive,
  ChevronDown, ExternalLink, MoreVertical
} from 'lucide-react'
import { tablesApi, api } from '@/services/api'
import { renderCell, statusBadge, qualityBadge } from './expert-table-format'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

/* ─── Design Tokens (SaaS Premium) ─── */
const DT = {
  cardShadow: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)',
  cardBorder: '1px solid #E2E8F0',
  cardRadius: '8px',
  cardBg: '#FFFFFF',
  headerBg: '#F8FAFC',
  headerColor: '#64748B',
  headerFontSize: '11px',
  cellFontSize: '13px',
  cellColor: '#334155',
  hoverBg: '#F8FAFC',
  activeBlue: '#2563EB',
  mutedDash: '#94A3B8',
}

/* ─── helpers ─── */
type Row = Record<string, unknown>

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(4)
  if (typeof v === 'string') return v
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non'
  if (typeof v === 'object') {
    try { return JSON.stringify(v) } catch { return String(v) }
  }
  return String(v)
}

function fmtDash(v: unknown): React.ReactNode {
  if (v === null || v === undefined) return <span style={{ color: DT.mutedDash }}>—</span>
  const s = fmt(v)
  return s === '—' ? <span style={{ color: DT.mutedDash }}>—</span> : s
}

function exportCsv(rows: Row[], filename: string) {
  if (!rows.length) return
  const keys = Object.keys(rows[0])
  const csv = [keys.join(','), ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

/* ─── Metric Card (Premium KPI) ─── */
function MetricCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <div
      style={{
        background: DT.cardBg,
        border: DT.cardBorder,
        borderRadius: DT.cardRadius,
        boxShadow: DT.cardShadow,
      }}
      className="p-4 min-w-[140px] hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} style={{ color, strokeWidth: 1.5 }} />
        <span style={{ fontSize: DT.headerFontSize, color: DT.headerColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <div className="text-xl font-bold" style={{ color }}>{String(value)}</div>
    </div>
  )
}

/* ─── Section Card (Premium) ─── */
function SectionCard({ title, icon: Icon, children, action }: { title: string; icon?: React.ElementType; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div
      style={{
        background: DT.cardBg,
        border: DT.cardBorder,
        borderRadius: DT.cardRadius,
        boxShadow: DT.cardShadow,
      }}
    >
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid #E2E8F0', background: DT.headerBg }}>
        <div className="flex items-center gap-2">
          {Icon && <Icon size={14} style={{ color: DT.headerColor, strokeWidth: 1.5 }} />}
          <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

/* ─── Data Table (Premium Dense Grid) ─── */
function DataTable({ columns, rows, maxRows, onRowAction }: {
  columns: { key: string; label: string; align?: 'left' | 'right'; render?: (v: unknown, row: Row) => React.ReactNode }[]
  rows: Row[]
  maxRows?: number
  onRowAction?: (row: Row, action: string) => void
}) {
  const display = maxRows ? rows.slice(0, maxRows) : rows
  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ fontSize: DT.cellFontSize }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #CBD5E1' }}>
            {columns.map(c => (
              <th
                key={c.key}
                className="whitespace-nowrap"
                style={{
                  fontSize: DT.headerFontSize,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: DT.headerColor,
                  backgroundColor: DT.headerBg,
                  padding: '12px 16px',
                  textAlign: c.align === 'right' ? 'right' : 'left',
                  fontWeight: 500,
                }}
              >{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {display.length === 0 ? (
            <tr><td colSpan={columns.length} style={{ padding: '24px 16px', textAlign: 'center', color: DT.headerColor }}>Aucune donnée</td></tr>
          ) : display.map((r, i) => (
            <tr key={i} className="group" style={{ borderBottom: '1px solid #F1F5F9' }}>
              {columns.map(c => (
                <td
                  key={c.key}
                  className="align-top max-w-[280px]"
                  style={{
                    padding: '10px 16px',
                    color: DT.cellColor,
                    textAlign: c.align === 'right' ? 'right' : 'left',
                  }}
                >
                  {c.render ? c.render(r[c.key], r) : fmtDash(r[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ─── Databar (mini progress bar in cell) ─── */
function Databar({ value, maxVal, color = DT.activeBlue }: { value: number; maxVal: number; color?: string }) {
  const pct = maxVal > 0 ? Math.min((value / maxVal) * 100, 100) : 0
  return (
    <div className="relative w-full h-5" style={{ fontSize: '12px' }}>
      <div className="absolute inset-0 rounded" style={{ background: `${color}15` }} />
      <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${pct}%`, background: `${color}30` }} />
      <span className="relative z-10 font-medium" style={{ color }}>{value.toFixed(4)}</span>
    </div>
  )
}

/* ─── Quality Pill (Badge discret) ─── */
function QualityPill({ value, sill }: { value: number | null; sill: number | null }) {
  if (value == null || sill == null || sill === 0) return <span style={{ color: DT.mutedDash }}>—</span>
  const ratio = value / sill
  if (ratio < 0.3) return <Badge style={{ background: '#DCFCE7', color: '#166534', border: 'none', fontSize: '11px' }}><span style={{ color: '#22C55E', marginRight: 4 }}>●</span>Excellent</Badge>
  if (ratio < 0.6) return <Badge style={{ background: '#DBEAFE', color: '#1E40AF', border: 'none', fontSize: '11px' }}><span style={{ color: '#3B82F6', marginRight: 4 }}>●</span>Bon</Badge>
  if (ratio < 1.0) return <Badge style={{ background: '#FEF3C7', color: '#92400E', border: 'none', fontSize: '11px' }}><span style={{ color: '#F59E0B', marginRight: 4 }}>●</span>Acceptable</Badge>
  return <Badge style={{ background: '#FEE2E2', color: '#991B1B', border: 'none', fontSize: '11px' }}><span style={{ color: '#EF4444', marginRight: 4 }}>●</span>Faible</Badge>
}

/* ─── Status Pill ─── */
function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase()
  if (s === 'completed' || s === 'done' || s === 'success') return <Badge style={{ background: '#DCFCE7', color: '#166534', border: 'none', fontSize: '11px' }}><span style={{ color: '#22C55E', marginRight: 4 }}>●</span>Terminé</Badge>
  if (s === 'running' || s === 'pending') return <Badge style={{ background: '#DBEAFE', color: '#1E40AF', border: 'none', fontSize: '11px' }}><span style={{ color: '#3B82F6', marginRight: 4 }}>●</span>En cours</Badge>
  if (s === 'failed' || s === 'error') return <Badge style={{ background: '#FEE2E2', color: '#991B1B', border: 'none', fontSize: '11px' }}><span style={{ color: '#EF4444', marginRight: 4 }}>●</span>Échoué</Badge>
  return <Badge style={{ background: '#F1F5F9', color: '#475569', border: 'none', fontSize: '11px' }}>{status}</Badge>
}

/* ─── Active Dot ─── */
function ActiveDot({ active }: { active: unknown }) {
  if (active) return <Badge style={{ background: '#DCFCE7', color: '#166534', border: 'none', fontSize: '11px' }}><span style={{ color: '#22C55E', marginRight: 4 }}>●</span>Actif</Badge>
  return <Badge style={{ background: '#F1F5F9', color: '#94A3B8', border: 'none', fontSize: '11px' }}>Inactif</Badge>
}

/* ─── Export Button (discret) ─── */
function ExportBtn({ rows, filename }: { rows: Row[]; filename: string }) {
  return (
    <button
      onClick={() => exportCsv(rows, filename)}
      className="flex items-center gap-1 text-xs hover:text-primary transition-colors"
      style={{ color: DT.headerColor, background: 'none', border: 'none', cursor: 'pointer' }}
    >
      <Download size={12} strokeWidth={1.5} /> Exporter
    </button>
  )
}

/* ═══════════════════════════════════════════════════════════
   SOUS-ONGLET 1 : Données brutes
   ═══════════════════════════════════════════════════════════ */
function DonneesBrutesTab({ catalog, jobs, plotCache }: { catalog: Row[]; jobs: Row[]; plotCache: Row[] }) {
  const [variograms, setVariograms] = useState<Row[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const vData = await tablesApi.getData('atlas', 'ai_variograms', 100, 0)
        if (!cancelled) setVariograms(vData as Row[])
      } catch { /* best effort */ }
    })()
    return () => { cancelled = true }
  }, [])

  const maxRmse = Math.max(...variograms.map(v => Number(v.loo_rmse ?? 0)), 0.01)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <MetricCard icon={MapPin} label="Sondages" value={123} color="#3B82F6" />
        <MetricCard icon={Grid3x3} label="Mailles" value={29407} color="#22C55E" />
        <MetricCard icon={Layers} label="Interpolations" value={29407} color="#EAB308" />
        <MetricCard icon={Activity} label="Paramètres" value={catalog.length} color="#F97316" />
        <MetricCard icon={Clock} label="Jobs" value={jobs.length} color="#EF4444" />
        <MetricCard icon={HardDrive} label="Cache plots" value={plotCache.length} color="#A855F7" />
      </div>

      <SectionCard icon={Table2} title="Catalogue des paramètres" action={<ExportBtn rows={catalog} filename="parameter_catalog.csv" />}>
        <DataTable
          columns={[
            { key: 'parameter_id', label: 'ID' },
            { key: 'category', label: 'Catégorie' },
            { key: 'unit', label: 'Unité' },
            { key: 'physical_min', label: 'Min phys.', align: 'right' },
            { key: 'physical_max', label: 'Max phys.', align: 'right' },
            { key: 'min_pts_stratified', label: 'Seuil strat.', align: 'right' },
            { key: 'min_pts_rk', label: 'Seuil RK', align: 'right' },
            { key: 'is_active', label: 'Statut', render: (v) => <ActiveDot active={v} /> },
          ]}
          rows={catalog}
          maxRows={50}
        />
      </SectionCard>

      <SectionCard icon={Activity} title="Tableau LOO RMSE" action={<ExportBtn rows={variograms} filename="variograms.csv" />}>
        <DataTable
          columns={[
            { key: 'parameter_id', label: 'Paramètre' },
            { key: 'horizon_label', label: 'Horizon', render: (v, r) => {
              const fq = r.fit_quality as Record<string, unknown> | null
              return fmtDash(fq?.horizon_label ?? v)
            }},
            { key: 'model_type', label: 'Modèle' },
            { key: 'nugget', label: 'Nugget', align: 'right', render: (v) => fmtDash(v) },
            { key: 'sill', label: 'Sill', align: 'right', render: (v) => fmtDash(v) },
            { key: 'range_m', label: 'Portée (km)', align: 'right', render: (v) => v != null ? (Number(v) / 1000).toFixed(1) : <span style={{ color: DT.mutedDash }}>—</span> },
            { key: 'loo_rmse_val', label: 'LOO RMSE', align: 'right', render: (v) => <Databar value={Number(v ?? 0)} maxVal={maxRmse} /> },
            { key: 'loo_rmse_qual', label: 'Qualité', render: (v, r) => <QualityPill value={r.loo_rmse as number | null} sill={r.sill as number | null} /> },
          ]}
          rows={variograms}
          maxRows={50}
        />
      </SectionCard>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   SOUS-ONGLET 2 : Variogrammes
   ═══════════════════════════════════════════════════════════ */
function VariogrammesTab() {
  const [variograms, setVariograms] = useState<Row[]>([])
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const [svgLoading, setSvgLoading] = useState(false)
  const [svgError, setSvgError] = useState<string | null>(null)
  const [selectedParam, setSelectedParam] = useState('eg_avg')
  const [selectedHorizon, setSelectedHorizon] = useState('H1')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await tablesApi.getData('atlas', 'ai_variograms', 100, 0)
        if (!cancelled) setVariograms(data as Row[])
      } catch { /* ok */ }
    })()
    return () => { cancelled = true }
  }, [])

  const loadVariogram = useCallback(async () => {
    setSvgLoading(true)
    setSvgError(null)
    setSvgContent(null)
    try {
      const res = await api.post<any>('/ai/plots/variogram', { parameter_id: selectedParam, horizon: selectedHorizon })
      if (res?.svg && res.svg.includes('<path')) {
        setSvgContent(res.svg)
      } else if (res?.svg) {
        setSvgError('Le variogramme a été généré mais ne contient pas de courbe (métadonnées incomplètes). Vérifiez que nugget, sill et range sont renseignés dans ai_variograms.')
      } else {
        setSvgError('Aucun SVG retourné par le serveur.')
      }
    } catch (e: unknown) {
      setSvgError(e instanceof Error ? e.message : String(e))
    } finally {
      setSvgLoading(false)
    }
  }, [selectedParam, selectedHorizon])

  const params = [...new Set(variograms.map(v => String(v.parameter_id ?? '')))].filter(Boolean)
  const horizons = ['H1', 'H2', 'H3']
  const maxRmse = Math.max(...variograms.map(v => Number(v.loo_rmse ?? 0)), 0.01)

  return (
    <div className="space-y-6">
      {/* Paramètres de calcul */}
      <div style={{ background: DT.cardBg, border: DT.cardBorder, borderRadius: DT.cardRadius, boxShadow: DT.cardShadow }} className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Settings size={14} style={{ color: DT.headerColor, strokeWidth: 1.5 }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>Paramètres de calcul</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: DT.headerFontSize, color: DT.headerColor, textTransform: 'uppercase' }}>Paramètre</span>
            <select className="border rounded px-2 py-1 text-xs" style={{ borderColor: '#E2E8F0', background: DT.cardBg }} value={selectedParam} onChange={e => setSelectedParam(e.target.value)}>
              {params.map(p => <option key={p} value={p}>{p}</option>)}
              {params.length === 0 && <option value="eg_avg">eg_avg</option>}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: DT.headerFontSize, color: DT.headerColor, textTransform: 'uppercase' }}>Horizon</span>
            <select className="border rounded px-2 py-1 text-xs" style={{ borderColor: '#E2E8F0', background: DT.cardBg }} value={selectedHorizon} onChange={e => setSelectedHorizon(e.target.value)}>
              {horizons.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <button
            onClick={loadVariogram}
            disabled={svgLoading}
            className="flex items-center gap-1.5 text-white rounded font-medium text-xs px-3 py-1.5 disabled:opacity-50"
            style={{ background: DT.activeBlue }}
          >
            {svgLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play size={12} strokeWidth={1.5} />}
            Générer modèle
          </button>
        </div>
      </div>

      {/* Split-screen: tableau + visualisation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard icon={Table2} title="Résultats (modèles ajustés)" action={<ExportBtn rows={variograms} filename="variograms_params.csv" />}>
          <DataTable
            columns={[
              { key: 'parameter_id', label: 'Paramètre' },
              { key: 'horizon_label', label: 'Horizon', render: (v, r) => {
                const fq = r.fit_quality as Record<string, unknown> | null
                return fmtDash(fq?.horizon_label ?? v)
              }},
              { key: 'model_type', label: 'Modèle' },
              { key: 'nugget', label: 'Nugget', align: 'right', render: (v) => fmtDash(v) },
              { key: 'sill', label: 'Sill', align: 'right', render: (v) => fmtDash(v) },
              { key: 'loo_rmse_val', label: 'LOO RMSE', align: 'right', render: (v) => <Databar value={Number(v ?? 0)} maxVal={maxRmse} /> },
              { key: 'loo_rmse_qual', label: 'Qualité', render: (v, r) => <QualityPill value={r.loo_rmse as number | null} sill={r.sill as number | null} /> },
            ]}
            rows={variograms.filter(v => String(v.parameter_id) === selectedParam)}
            maxRows={20}
          />
        </SectionCard>

        <SectionCard icon={Activity} title="Visualisation du variogramme">
          {svgError && (
            <div className="flex items-center gap-2 mb-3 p-2 rounded" style={{ background: '#FEF3C7', border: '1px solid #F59E0B' }}>
              <AlertCircle size={14} style={{ color: '#92400E' }} />
              <span style={{ fontSize: '12px', color: '#92400E' }}>{svgError}</span>
            </div>
          )}
          {svgContent ? (
            <div className="rounded p-2" style={{ background: '#0F172A' }} dangerouslySetInnerHTML={{ __html: svgContent }} />
          ) : !svgLoading && (
            <div className="flex flex-col items-center justify-center" style={{ minHeight: '300px', background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: '8px', color: '#94A3B8', padding: '24px' }}>
              <Activity size={32} strokeWidth={1} style={{ color: '#CBD5E1', marginBottom: 8 }} />
              <span style={{ fontSize: '13px' }}>Sélectionnez un paramètre et un horizon</span>
              <span style={{ fontSize: '11px', marginTop: 4 }}>puis cliquez sur « Générer modèle »</span>
            </div>
          )}
          {svgLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" style={{ color: DT.activeBlue }} /></div>}
        </SectionCard>
      </div>

      {/* Multi-domaines */}
      <SectionCard icon={Layers} title="Variogrammes multi-domaines" action={<ExportBtn rows={variograms} filename="variograms_multi_domain.csv" />}>
        <DataTable
          columns={[
            { key: 'parameter_id', label: 'Paramètre' },
            { key: 'horizon_label', label: 'Horizon', render: (v, r) => {
              const fq = r.fit_quality as Record<string, unknown> | null
              return fmtDash(fq?.horizon_label ?? v)
            }},
            { key: 'model_type', label: 'Modèle' },
            { key: 'nugget', label: 'Nugget', align: 'right', render: (v) => fmtDash(v) },
            { key: 'sill', label: 'Sill', align: 'right', render: (v) => fmtDash(v) },
            { key: 'range_m', label: 'Portée (km)', align: 'right', render: (v) => v != null ? (Number(v) / 1000).toFixed(1) : <span style={{ color: DT.mutedDash }}>—</span> },
            { key: 'loo_rmse_val', label: 'LOO RMSE', align: 'right', render: (v) => <Databar value={Number(v ?? 0)} maxVal={maxRmse} /> },
            { key: 'loo_rmse_qual', label: 'Qualité', render: (v, r) => <QualityPill value={r.loo_rmse as number | null} sill={r.sill as number | null} /> },
          ]}
          rows={variograms}
          maxRows={50}
        />
      </SectionCard>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   SOUS-ONGLET 3 : Validation
   ═══════════════════════════════════════════════════════════ */
function ValidationTab() {
  const [variograms, setVariograms] = useState<Row[]>([])
  const [runs, setRuns] = useState<Row[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [vData, rData] = await Promise.all([
          tablesApi.getData('atlas', 'ai_variograms', 100, 0),
          tablesApi.getData('atlas', 'ai_interpolation_runs', 100, 0),
        ])
        if (!cancelled) {
          setVariograms(vData as Row[])
          setRuns(rData as Row[])
        }
      } catch { /* ok */ }
    })()
    return () => { cancelled = true }
  }, [])

  const maxRmse = Math.max(...variograms.map(v => Number(v.loo_rmse ?? 0)), 0.01)

  return (
    <div className="space-y-6">
      <SectionCard icon={CheckSquare} title="Leave-One-Out Validation" action={<ExportBtn rows={variograms} filename="validation_loo.csv" />}>
        <DataTable
          columns={[
            { key: 'parameter_id', label: 'Paramètre' },
            { key: 'horizon_label', label: 'Horizon', render: (v, r) => {
              const fq = r.fit_quality as Record<string, unknown> | null
              return fmtDash(fq?.horizon_label ?? v)
            }},
            { key: 'model_type', label: 'Modèle' },
            { key: 'nugget', label: 'Nugget', align: 'right', render: (v) => fmtDash(v) },
            { key: 'sill', label: 'Sill', align: 'right', render: (v) => fmtDash(v) },
            { key: 'range_m', label: 'Portée (km)', align: 'right', render: (v) => v != null ? (Number(v) / 1000).toFixed(1) : <span style={{ color: DT.mutedDash }}>—</span> },
            { key: 'loo_rmse_val', label: 'LOO RMSE', align: 'right', render: (v) => <Databar value={Number(v ?? 0)} maxVal={maxRmse} /> },
            { key: 'loo_rmse_qual', label: 'Qualité', render: (v, r) => <QualityPill value={r.loo_rmse as number | null} sill={r.sill as number | null} /> },
          ]}
          rows={variograms}
          maxRows={50}
        />
        <p style={{ fontSize: '10px', color: DT.headerColor, marginTop: 8 }}>LOO RMSE calculé sur les localités AMESSEFE</p>
      </SectionCard>

      <SectionCard icon={Activity} title="RMSE par paramètre" action={<ExportBtn rows={variograms} filename="rmse_by_param.csv" />}>
        <DataTable
          columns={[
            { key: 'parameter_id', label: 'Paramètre' },
            { key: 'horizon_label', label: 'Horizon', render: (v, r) => {
              const fq = r.fit_quality as Record<string, unknown> | null
              return fmtDash(fq?.horizon_label ?? v)
            }},
            { key: 'loo_rmse_val', label: 'RMSE', align: 'right', render: (v) => <Databar value={Number(v ?? 0)} maxVal={maxRmse} /> },
            { key: 'loo_rmse_qual', label: 'Qualité', render: (v, r) => <QualityPill value={r.loo_rmse as number | null} sill={r.sill as number | null} /> },
          ]}
          rows={variograms}
          maxRows={30}
        />
      </SectionCard>

      <SectionCard icon={Layers} title="RMSE par domaine géologique" action={<ExportBtn rows={runs} filename="rmse_by_domain.csv" />}>
        <DataTable
          columns={[
            { key: 'parameter_id', label: 'Paramètre' },
            { key: 'method', label: 'Méthode' },
            { key: 'status', label: 'Statut', render: (v) => <StatusPill status={String(v ?? '')} /> },
            { key: 'n_mailles', label: 'Mailles', align: 'right', render: (v) => fmtDash(v) },
          ]}
          rows={runs}
          maxRows={30}
        />
      </SectionCard>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   SOUS-ONGLET 4 : ML
   ═══════════════════════════════════════════════════════════ */
function MLTab() {
  const [models, setModels] = useState<Row[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await tablesApi.getData('atlas', 'ai_model_registry', 50, 0)
        if (!cancelled) setModels(data as Row[])
      } catch { /* ok */ }
    })()
    return () => { cancelled = true }
  }, [])

  if (models.length === 0) {
    return (
      <div style={{ background: DT.cardBg, border: DT.cardBorder, borderRadius: DT.cardRadius, boxShadow: DT.cardShadow }} className="p-8 text-center">
        <Brain size={32} strokeWidth={1} style={{ color: '#CBD5E1' }} className="mx-auto mb-3" />
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1E293B' }} className="mb-1">Aucun modèle ML entraîné</h3>
        <p style={{ fontSize: '13px', color: DT.headerColor }} className="mb-4">Le pipeline CatBoost n'a pas encore été exécuté.</p>
        <p style={{ fontSize: '12px', color: DT.headerColor }}>Aller dans l'onglet Infer/Opti et cliquer sur « Train supervisé »</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionCard icon={Brain} title="Registre des modèles" action={<ExportBtn rows={models} filename="model_registry.csv" />}>
        <DataTable
          columns={[
            { key: 'model_target', label: 'Cible' },
            { key: 'model_version', label: 'Version', render: (v) => <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace' }}>{String(v ?? '—')}</code> },
            { key: 'n_training_points', label: 'Dataset', align: 'right', render: (v) => fmtDash(v) },
            { key: 'features_used', label: 'Features', render: (v) => renderCell(v) },
            { key: 'rmse_cv', label: 'RMSE CV', align: 'right', render: (v) => fmtDash(v) },
            { key: 'r2_cv', label: 'R² CV', align: 'right', render: (v) => fmtDash(v) },
            { key: 'created_at', label: 'Date' },
            { key: 'is_active', label: 'Statut', render: (v) => v ? <Badge style={{ background: '#DCFCE7', color: '#166534', border: 'none', fontSize: '11px' }}><span style={{ color: '#22C55E', marginRight: 4 }}>●</span>En production</Badge> : <Badge style={{ background: '#F1F5F9', color: '#94A3B8', border: 'none', fontSize: '11px' }}>Non déployé</Badge> },
          ]}
          rows={models}
        />
      </SectionCard>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   SOUS-ONGLET 5 : Comparaison
   ═══════════════════════════════════════════════════════════ */
function ComparaisonTab() {
  const [variograms, setVariograms] = useState<Row[]>([])
  const [runs, setRuns] = useState<Row[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [vData, rData] = await Promise.all([
          tablesApi.getData('atlas', 'ai_variograms', 100, 0),
          tablesApi.getData('atlas', 'ai_interpolation_runs', 100, 0),
        ])
        if (!cancelled) {
          setVariograms(vData as Row[])
          setRuns(rData as Row[])
        }
      } catch { /* ok */ }
    })()
    return () => { cancelled = true }
  }, [])

  const maxRmse = Math.max(...variograms.map(v => Number(v.loo_rmse ?? 0)), 0.01)

  return (
    <div className="space-y-6">
      <SectionCard icon={GitCompare} title="Comparaison des méthodes d'interpolation" action={<ExportBtn rows={variograms} filename="comparaison_methodes.csv" />}>
        <DataTable
          columns={[
            { key: 'parameter_id', label: 'Paramètre' },
            { key: 'horizon_label', label: 'Horizon', render: (v, r) => {
              const fq = r.fit_quality as Record<string, unknown> | null
              return fmtDash(fq?.horizon_label ?? v)
            }},
            { key: 'model_type', label: 'Méthode' },
            { key: 'nugget', label: 'Nugget', align: 'right', render: (v) => fmtDash(v) },
            { key: 'sill', label: 'Sill', align: 'right', render: (v) => fmtDash(v) },
            { key: 'loo_rmse_val', label: 'RMSE', align: 'right', render: (v) => <Databar value={Number(v ?? 0)} maxVal={maxRmse} /> },
            { key: 'loo_rmse_qual', label: 'Qualité', render: (v, r) => <QualityPill value={r.loo_rmse as number | null} sill={r.sill as number | null} /> },
          ]}
          rows={variograms}
          maxRows={50}
        />
        <p style={{ fontSize: '10px', color: DT.headerColor, marginTop: 8 }}>
          Le KED pédologique améliore le kriging global en exploitant la covariable type_sol.
          La régression kriging sera activée automatiquement dès 30 sondages par domaine.
        </p>
      </SectionCard>

      <SectionCard icon={Table2} title="Tableau comparatif méthodes" action={<ExportBtn rows={runs} filename="runs_comparaison.csv" />}>
        <DataTable
          columns={[
            { key: 'parameter_id', label: 'Paramètre' },
            { key: 'method', label: 'Méthode' },
            { key: 'status', label: 'Statut', render: (v) => <StatusPill status={String(v ?? '')} /> },
            { key: 'n_mailles', label: 'Mailles interp.', align: 'right', render: (v) => fmtDash(v) },
          ]}
          rows={runs}
          maxRows={30}
        />
      </SectionCard>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   SOUS-ONGLET 6 : Système
   ═══════════════════════════════════════════════════════════ */
function SystemeTab({ catalog, jobs, plotCache, onRefresh }: { catalog: Row[]; jobs: Row[]; plotCache: Row[]; onRefresh: () => void }) {
  const [svgModal, setSvgModal] = useState<string | null>(null)

  const purgeCache = async () => {
    try {
      await api.delete('/ai/plots/cache')
      onRefresh()
    } catch { /* ok */ }
  }

  return (
    <div className="space-y-6">
      <SectionCard icon={Server} title="File de jobs IA" action={<button onClick={onRefresh} className="flex items-center gap-1 text-xs" style={{ color: DT.headerColor, background: 'none', border: 'none', cursor: 'pointer' }}><RefreshCw size={12} strokeWidth={1.5} /> Rafraîchir</button>}>
        <DataTable
          columns={[
            { key: 'parameter_id', label: 'Paramètre' },
            { key: 'job_type', label: 'Type' },
            { key: 'status', label: 'Statut', render: (v) => <StatusPill status={String(v ?? '')} /> },
            { key: 'requested_at', label: 'Demandé' },
            { key: 'started_at', label: 'Démarré' },
            { key: 'finished_at', label: 'Terminé' },
            { key: 'error_message', label: 'Erreur', render: (v) => v ? <span style={{ color: '#DC2626', fontSize: '10px' }}>{String(v)}</span> : <span style={{ color: DT.mutedDash }}>—</span> },
            { key: 'payload', label: 'Payload', render: (v) => renderCell(v) },
          ]}
          rows={jobs}
          maxRows={30}
        />
      </SectionCard>

      <SectionCard
        icon={HardDrive}
        title="Cache graphiques"
        action={
          <button
            onClick={purgeCache}
            className="flex items-center gap-1 text-xs font-medium rounded px-2 py-1 transition-colors"
            style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', cursor: 'pointer' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.color = '#FFF' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#FEE2E2'; e.currentTarget.style.color = '#DC2626' }}
          >
            <Trash2 size={12} strokeWidth={1.5} /> Purger tout
          </button>
        }
      >
        <DataTable
          columns={[
            { key: 'parameter_id', label: 'Paramètre' },
            { key: 'horizon_label', label: 'Horizon' },
            { key: 'svg_size', label: 'Taille SVG', align: 'right', render: (v, r) => r.svg_content ? `${(String(r.svg_content).length / 1024).toFixed(1)} KB` : <span style={{ color: DT.mutedDash }}>—</span> },
            { key: 'cached_at', label: 'Créé le' },
            { key: 'svg_view', label: 'Voir', render: (v, r) => r.svg_content ? <Button variant="ghost" size="sm" onClick={() => setSvgModal(String(r.svg_content))}><Eye size={12} strokeWidth={1.5} /></Button> : null },
          ]}
          rows={plotCache}
          maxRows={30}
        />
      </SectionCard>

      {svgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setSvgModal(null)}>
          <div style={{ background: DT.cardBg, borderRadius: '12px' }} className="p-4 max-w-4xl max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
              <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>Aperçu SVG</h3>
              <button onClick={() => setSvgModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: DT.headerColor }}><X size={16} strokeWidth={1.5} /></button>
            </div>
            <div dangerouslySetInnerHTML={{ __html: svgModal }} />
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   SOUS-ONGLET EDA : Analyse exploratoire des données
   ═══════════════════════════════════════════════════════════ */
const PARAMETERS = ['vbs', 'ip', 'wl', 'wp', 'eg_avg', 'eg_ked_h1']

function EdaTab() {
  const [selectedParam, setSelectedParam] = useState('vbs')
  const [descStats, setDescStats] = useState<Row | null>(null)
  const [histogram, setHistogram] = useState<Row[]>([])
  const [correlations, setCorrelations] = useState<Row[]>([])
  const [variograms, setVariograms] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const [desc, eda, corr, vData] = await Promise.all([
          api.get<any>(`/api/stats/descriptive?parameter=${selectedParam}`),
          api.get<any>(`/api/stats/eda?parameter=${selectedParam}&bins=10`),
          api.get<any>('/api/stats/correlations'),
          tablesApi.getData('atlas', 'ai_variograms', 100, 0),
        ])
        if (!cancelled) {
          setDescStats(desc)
          setHistogram(eda?.histogram ?? [])
          setCorrelations(corr?.items ?? [])
          setVariograms(vData as Row[])
        }
      } catch { /* ok */ }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [selectedParam])

  const maxCount = Math.max(...histogram.map(h => Number(h.count ?? 0)), 1)

  return (
    <div className="space-y-6">
      <SectionCard icon={BarChart2} title="Histogrammes et statistiques descriptives">
        <div className="flex items-center gap-3 mb-4">
          <span style={{ fontSize: DT.headerFontSize, color: DT.headerColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Paramètre</span>
          <select className="border rounded px-2 py-1 text-xs" style={{ borderColor: '#E2E8F0', background: DT.cardBg }} value={selectedParam} onChange={e => setSelectedParam(e.target.value)}>
            {PARAMETERS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {descStats && (
          <div className="mb-6">
            <div className="grid grid-cols-3 lg:grid-cols-5 gap-2">
              {[
                ['N', descStats.n],
                ['Moyenne', descStats.mean],
                ['Variance', descStats.variance],
                ['Écart-type', descStats.stddev],
                ['Min', descStats.min],
                ['Q1 (25%)', descStats.q1],
                ['Médiane', descStats.median],
                ['Q3 (75%)', descStats.q3],
                ['Max', descStats.max],
              ].map(([label, val]) => (
                <div key={String(label)} style={{ background: DT.headerBg, border: '1px solid #E2E8F0', borderRadius: '6px' }} className="p-2 text-center">
                  <div style={{ fontSize: DT.headerFontSize, color: DT.headerColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{String(label)}</div>
                  <div className="text-sm font-bold" style={{ color: DT.cellColor }}>{fmt(val)}</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '10px', color: DT.headerColor, marginTop: 4 }}>Source : {String(descStats.source ?? '—')}</p>
          </div>
        )}

        {histogram.length > 0 && (
          <div className="mb-4">
            <div className="flex items-end gap-1 h-32 border-b pb-1" style={{ borderColor: '#CBD5E1' }}>
              {histogram.map((h, i) => {
                const pct = (Number(h.count) / maxCount) * 100
                return (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <div style={{ fontSize: '8px', color: DT.headerColor }}>{Number(h.count)}</div>
                    <div
                      className="w-full rounded-t transition-colors"
                      style={{ height: `${pct}%`, minHeight: '2px', background: `${DT.activeBlue}90` }}
                      title={`${fmt(h.bin_min)} – ${fmt(h.bin_max)} : ${h.count}`}
                    />
                  </div>
                )
              })}
            </div>
            <div className="flex gap-1 mt-1">
              {histogram.map((h, i) => (
                <div key={i} className="flex-1 text-center truncate" style={{ fontSize: '7px', color: DT.headerColor }}>{fmt(h.bin_min)}</div>
              ))}
            </div>
          </div>
        )}

        {loading && <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" style={{ color: DT.activeBlue }} /></div>}
      </SectionCard>

      <SectionCard icon={GitCompare} title="Matrice de corrélation" action={<ExportBtn rows={correlations} filename="correlations.csv" />}>
        <DataTable
          columns={[
            { key: 'parameter_id', label: 'Paramètre' },
            { key: 'horizon', label: 'Horizon', render: (v) => fmtDash(v) },
            { key: 'loo_rmse', label: 'LOO RMSE', align: 'right', render: (v) => fmtDash(v) },
            { key: 'sill', label: 'Sill', align: 'right', render: (v) => fmtDash(v) },
            { key: 'nugget', label: 'Nugget', align: 'right', render: (v) => fmtDash(v) },
            { key: 'range_m', label: 'Portée (km)', align: 'right', render: (v) => v != null ? (Number(v) / 1000).toFixed(1) : <span style={{ color: DT.mutedDash }}>—</span> },
          ]}
          rows={correlations}
          maxRows={30}
        />
      </SectionCard>

      <SectionCard icon={Activity} title="Boxplots par domaine géologique" action={<ExportBtn rows={variograms} filename="variograms_by_domain.csv" />}>
        <DataTable
          columns={[
            { key: 'parameter_id', label: 'Paramètre' },
            { key: 'horizon_label', label: 'Horizon', render: (v, r) => {
              const fq = r.fit_quality as Record<string, unknown> | null
              return fmtDash(fq?.horizon_label ?? v)
            }},
            { key: 'model_type', label: 'Modèle' },
            { key: 'nugget', label: 'Nugget', align: 'right', render: (v) => fmtDash(v) },
            { key: 'sill', label: 'Sill', align: 'right', render: (v) => fmtDash(v) },
            { key: 'loo_rmse', label: 'LOO RMSE', align: 'right', render: (v) => fmtDash(v) },
          ]}
          rows={variograms}
          maxRows={30}
        />
      </SectionCard>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
   ═══════════════════════════════════════════════════════════ */
export function ExpertScientificDbTab() {
  const [catalog, setCatalog] = useState<Row[]>([])
  const [jobs, setJobs] = useState<Row[]>([])
  const [plotCache, setPlotCache] = useState<Row[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [a, b, c] = await Promise.all([
        tablesApi.getData('atlas', 'ai_parameter_catalog', 50, 0),
        tablesApi.getData('atlas', 'ai_job_queue', 50, 0),
        tablesApi.getData('atlas', 'ai_plot_cache', 50, 0),
      ])
      setCatalog(a as Row[])
      setJobs(b as Row[])
      setPlotCache(c as Row[])
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: DT.activeBlue }} />
      </div>
    )
  }

  if (err) {
    return (
      <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: '8px', color: '#991B1B' }} className="p-4 text-sm">
        {err}
      </div>
    )
  }

  return (
    <div className="max-w-[1400px]">
      <div className="flex items-center justify-between mb-2">
        <p style={{ fontSize: '13px', color: DT.headerColor }} className="leading-relaxed">
          Données en lecture seule (mêmes tables que le modal « Gestion BDD » sur la carte).
        </p>
        <button
          onClick={() => window.dispatchEvent(new Event('close-expert-scientific'))}
          title="Fermer le panneau"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: DT.headerColor }}
          className="hover:text-primary transition-colors"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>
      <Tabs defaultValue="donnees" className="w-full">
        <TabsList className="mb-4 flex-wrap" style={{ background: 'transparent', borderBottom: '1px solid #E2E8F0', borderRadius: 0, gap: 0 }}>
          <TabsTrigger value="donnees" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-3 py-2 text-sm" style={{ color: DT.headerColor }}><Table2 size={16} strokeWidth={1.5} className="mr-1.5 inline" /> Données brutes</TabsTrigger>
          <TabsTrigger value="eda" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-3 py-2 text-sm" style={{ color: DT.headerColor }}><BarChart2 size={16} strokeWidth={1.5} className="mr-1.5 inline" /> EDA</TabsTrigger>
          <TabsTrigger value="variogrammes" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-3 py-2 text-sm" style={{ color: DT.headerColor }}><Activity size={16} strokeWidth={1.5} className="mr-1.5 inline" /> Variogrammes</TabsTrigger>
          <TabsTrigger value="validation" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-3 py-2 text-sm" style={{ color: DT.headerColor }}><CheckSquare size={16} strokeWidth={1.5} className="mr-1.5 inline" /> Validation</TabsTrigger>
          <TabsTrigger value="ml" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-3 py-2 text-sm" style={{ color: DT.headerColor }}><Brain size={16} strokeWidth={1.5} className="mr-1.5 inline" /> Registre ML</TabsTrigger>
          <TabsTrigger value="comparaison" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-3 py-2 text-sm" style={{ color: DT.headerColor }}><GitCompare size={16} strokeWidth={1.5} className="mr-1.5 inline" /> Comparaison</TabsTrigger>
          <TabsTrigger value="systeme" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-3 py-2 text-sm" style={{ color: DT.headerColor }}><Server size={16} strokeWidth={1.5} className="mr-1.5 inline" /> Système</TabsTrigger>
        </TabsList>
        <TabsContent value="donnees"><DonneesBrutesTab catalog={catalog} jobs={jobs} plotCache={plotCache} /></TabsContent>
        <TabsContent value="eda"><EdaTab /></TabsContent>
        <TabsContent value="variogrammes"><VariogrammesTab /></TabsContent>
        <TabsContent value="validation"><ValidationTab /></TabsContent>
        <TabsContent value="ml"><MLTab /></TabsContent>
        <TabsContent value="comparaison"><ComparaisonTab /></TabsContent>
        <TabsContent value="systeme"><SystemeTab catalog={catalog} jobs={jobs} plotCache={plotCache} onRefresh={loadData} /></TabsContent>
      </Tabs>
    </div>
  )
}
