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

function extractHorizon(parameterId: string): string {
  const match = parameterId.match(/_h(\d)$/)
  if (match) return `H${match[1]}`
  if (parameterId.endsWith('_avg')) return 'Global'
  return '—'
}

function dedupVariograms(rows: Row[]): Row[] {
  const acc: Record<string, Row> = {}
  // Trier les plus récents en premier
  const sorted = [...rows].sort((a, b) =>
    (String(b.created_at ?? '')).localeCompare(String(a.created_at ?? ''))
  )
  for (const row of sorted) {
    // Clé = parameter_id uniquement (pas H1/H2/H3 dupliqué dans la clé)
    const key = String(row.parameter_id ?? '')
    if (!key) continue
    const existing = acc[key]
    if (!existing) { acc[key] = row; continue }
    const rowHasData = row.loo_rmse != null && Number(row.loo_rmse) > 0
    const existHasData = existing.loo_rmse != null && Number(existing.loo_rmse) > 0
    // Préférer la ligne avec loo_rmse non nul, puis la plus récente
    if (rowHasData && !existHasData) {
      acc[key] = row
    }
    // sinon garder le plus récent (déjà trié)
  }
  return Object.values(acc).sort((a, b) =>
    String(a.parameter_id).localeCompare(String(b.parameter_id))
  )
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
const PAGE_SIZE = 15

function DataTable({ columns, rows, maxRows, onRowAction }: {
  columns: { key: string; label: string; align?: 'left' | 'right'; render?: (v: unknown, row: Row) => React.ReactNode }[]
  rows: Row[]
  maxRows?: number
  onRowAction?: (row: Row, action: string) => void
}) {
  const [page, setPage] = useState(0)
  useEffect(() => { setPage(0) }, [rows])

  const source = maxRows ? rows.slice(0, maxRows) : rows
  const totalPages = Math.max(1, Math.ceil(source.length / PAGE_SIZE))
  const display = source.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

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
      {totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 16px', borderTop: `1px solid ${DT.cardBorder.replace('1px solid ', '')}`,
          fontSize: 12, color: DT.headerColor,
        }}>
          <span>{source.length} entrées</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{ padding: '2px 8px', border: `1px solid #E2E8F0`, borderRadius: 4, background: 'none', cursor: 'pointer', opacity: page === 0 ? 0.4 : 1, fontSize: 12 }}
            >‹</button>
            <span>{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              style={{ padding: '2px 8px', border: `1px solid #E2E8F0`, borderRadius: 4, background: 'none', cursor: 'pointer', opacity: page === totalPages - 1 ? 0.4 : 1, fontSize: 12 }}
            >›</button>
          </div>
        </div>
      )}
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

/* ─── Section Navigation (sidebar sticky) ─── */
interface NavItem {
  id: string
  label: string
  badge?: string | number
}

function SectionNav({ items, active, onChange }: { items: NavItem[]; active: string; onChange: (id: string) => void }) {
  return (
    <nav style={{
      width: 160, minWidth: 160, flexShrink: 0,
      borderRight: `1px solid ${DT.cardBorder.replace('1px solid ', '')}`,
      paddingTop: 8, overflowY: 'auto',
      position: 'sticky', top: 0,
      maxHeight: 'calc(100vh - 200px)',
      alignSelf: 'flex-start',
    }}>
      {items.map(item => (
        <button key={item.id} onClick={() => onChange(item.id)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '7px 12px', fontSize: 12,
          fontWeight: active === item.id ? 600 : 400,
          color: active === item.id ? DT.activeBlue : DT.headerColor,
          background: active === item.id ? `${DT.activeBlue}18` : 'transparent',
          border: 'none',
          borderLeft: active === item.id ? `2px solid ${DT.activeBlue}` : '2px solid transparent',
          cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
          borderRadius: '0 4px 4px 0',
        }}>
          <span>{item.label}</span>
          {item.badge != null && (
            <span style={{
              fontSize: 10, background: '#E2E8F0', color: DT.headerColor,
              borderRadius: 10, padding: '1px 5px', marginLeft: 4, minWidth: 18, textAlign: 'center',
            }}>{item.badge}</span>
          )}
        </button>
      ))}
    </nav>
  )
}

function SectionLayout({ nav, children }: { nav: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 0, minHeight: 'calc(100vh - 240px)', flex: 1 }}>
      {nav}
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '16px 20px', maxHeight: 'calc(100vh - 240px)' }}>
        {children}
      </div>
    </div>
  )
}

function useSectionState(tabName: string, defaultSection: string) {
  const [section, setSectionRaw] = useState(() =>
    localStorage.getItem(`atlas-expert-${tabName}-section`) ?? defaultSection
  )
  const setSection = useCallback((id: string) => {
    setSectionRaw(id)
    localStorage.setItem(`atlas-expert-${tabName}-section`, id)
  }, [tabName])
  return [section, setSection] as const
}

/* ═══════════════════════════════════════════════════════════
   SOUS-ONGLET 1 : Données brutes
   ═══════════════════════════════════════════════════════════ */
function DonneesBrutesTab({ catalog, jobs, plotCache }: { catalog: Row[]; jobs: Row[]; plotCache: Row[] }) {
  const [variograms, setVariograms] = useState<Row[]>([])
  const [coverage, setCoverage] = useState<Row[]>([])
  const [familleFilter, setFamilleFilter] = useState('')
  const [section, setSection] = useSectionState('donnees-brutes', 'resume')
  const [showCoverageMap, setShowCoverageMap] = useState(false)
  const [mapParam, setMapParam] = useState<string>('vbs_avg')
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMapRef = useRef<any>(null)
  const coverageLayerRef = useRef<any>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Promise.allSettled : si l'un échoue (ex: DB Manager désactivé),
      // l'autre charge quand même (résilience individuelle)
      const [vRes, covRes] = await Promise.allSettled([
        tablesApi.getData('atlas', 'ai_variograms', 100, 0),
        api.get<any>('/api/stats/coverage'),
      ])
      if (!cancelled) {
        if (vRes.status === 'fulfilled') setVariograms(vRes.value as Row[])
        if (covRes.status === 'fulfilled') setCoverage(((covRes.value as any)?.items ?? []) as Row[])
      }
    })()
    return () => { cancelled = true }
  }, [])

  const loadCoverageMap = useCallback(async (param: string) => {
    if (!mapRef.current) return
    const L = (window as any).L
    if (!L) return

    if (!leafletMapRef.current) {
      leafletMapRef.current = L.map(mapRef.current, {
        center: [8.5, 1.0], zoom: 7, zoomControl: true,
      })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OSM', maxZoom: 12,
      }).addTo(leafletMapRef.current)
    }

    if (coverageLayerRef.current) {
      leafletMapRef.current.removeLayer(coverageLayerRef.current)
      coverageLayerRef.current = null
    }

    try {
      const data = await api.get<any>(`/api/stats/coverage-map?parameter=${encodeURIComponent(param)}`)
      if (!data?.features?.length) return

      const layer = L.geoJSON(data, {
        style: (feature: any) => ({
          fillColor: feature.properties.status === 'interpolated' ? '#22C55E' : '#EF4444',
          fillOpacity: 0.5,
          color: feature.properties.status === 'interpolated' ? '#16A34A' : '#DC2626',
          weight: 0.5,
        }),
        onEachFeature: (feature: any, lyr: any) => {
          lyr.bindPopup(`<b>${feature.properties.code}</b><br/>Statut: ${feature.properties.status}`)
        },
      })
      layer.addTo(leafletMapRef.current)
      coverageLayerRef.current = layer
      leafletMapRef.current.invalidateSize()
    } catch { /* best effort */ }
  }, [])

  const deduped = dedupVariograms(variograms)
  const filtered = familleFilter === '' ? deduped
    : familleFilter === 'avg' ? deduped.filter(r => String(r.parameter_id).endsWith('_avg'))
    : familleFilter === 'ked' ? deduped.filter(r => String(r.parameter_id).includes('_ked_'))
    : deduped.filter(r => String(r.parameter_id).includes('_derived_'))
  const maxRmse = Math.max(...filtered.map(v => Number(v.loo_rmse ?? 0)), 0.01)

  const navItems: NavItem[] = [
    { id: 'resume', label: 'Résumé', badge: '6' },
    { id: 'catalogue', label: 'Catalogue', badge: String(catalog.length) },
    { id: 'loo', label: 'LOO RMSE', badge: String(filtered.length) },
    { id: 'coverage', label: 'Couverture', badge: String(coverage.length) },
  ]

  return (
    <SectionLayout nav={<SectionNav items={navItems} active={section} onChange={setSection} />}>
      {section === 'resume' && (
        <div className="flex flex-wrap gap-3">
          <MetricCard icon={MapPin} label="Sondages" value={123} color="#3B82F6" />
          <MetricCard icon={Grid3x3} label="Mailles" value={29407} color="#22C55E" />
          <MetricCard icon={Layers} label="Interpolations" value={29407} color="#EAB308" />
          <MetricCard icon={Activity} label="Paramètres" value={catalog.length} color="#F97316" />
          <MetricCard icon={Clock} label="Jobs" value={jobs.length} color="#EF4444" />
          <MetricCard icon={HardDrive} label="Cache plots" value={plotCache.length} color="#A855F7" />
        </div>
      )}
      {section === 'catalogue' && (
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
      )}
      {section === 'loo' && (
        <SectionCard icon={Activity} title="Tableau LOO RMSE" action={<ExportBtn rows={filtered} filename="variograms.csv" />}>
          <div className="flex items-center gap-2 mb-2">
            <span style={{ fontSize: '11px', color: DT.headerColor }}>Famille :</span>
            <select value={familleFilter} onChange={e => setFamilleFilter(e.target.value)} style={{ fontSize: '12px', border: '1px solid #E2E8F0', borderRadius: '4px', padding: '2px 6px', color: DT.cellColor }}>
              <option value="">Toutes les familles</option>
              <option value="avg">Kriging global (avg)</option>
              <option value="ked">KED par horizon</option>
              <option value="derived">IP dérivé</option>
            </select>
            <span style={{ fontSize: '11px', color: DT.headerColor, marginLeft: 'auto' }}>{filtered.length} entrées dédoublonnées</span>
          </div>
          <DataTable
            columns={[
              { key: 'parameter_id', label: 'Paramètre' },
              { key: 'horizon_display', label: 'Horizon', render: (_v, r) => extractHorizon(String(r.parameter_id)) },
              { key: 'model_type', label: 'Modèle' },
              { key: 'nugget', label: 'Nugget', align: 'right', render: (v) => fmtDash(v) },
              { key: 'sill', label: 'Sill', align: 'right', render: (v) => fmtDash(v) },
              { key: 'range_m', label: 'Portée (km)', align: 'right', render: (v) => v != null ? (Number(v) / 1000).toFixed(1) : <span style={{ color: DT.mutedDash }}>—</span> },
              { key: 'loo_rmse', label: 'LOO RMSE', align: 'right', render: (v) => {
                if (v === null || v === undefined) return <span style={{ color: DT.mutedDash }}>—</span>
                const n = Number(v)
                if (!Number.isFinite(n) || n === 0) return <span style={{ color: DT.mutedDash }}>—</span>
                return <Databar value={n} maxVal={maxRmse} />
              }},
            ]}
            rows={filtered}
            maxRows={50}
          />
        </SectionCard>
      )}
      {section === 'coverage' && (
        <SectionCard icon={Layers} title="Couverture d'interpolation" action={<ExportBtn rows={coverage} filename="coverage.csv" />}>
          <DataTable
            columns={[
              { key: 'parameter_id', label: 'Paramètre' },
              { key: 'method', label: 'Méthode' },
              { key: 'n_mailles', label: 'Mailles', align: 'right', render: (v) => fmtDash(v) },
              { key: 'coverage_pct', label: 'Couverture %', align: 'right', render: (v) => v != null ? <span style={{ color: Number(v) >= 90 ? '#22C55E' : Number(v) >= 50 ? '#EAB308' : '#EF4444' }}>{Number(v).toFixed(1)}%</span> : <span style={{ color: DT.mutedDash }}>—</span> },
              { key: 'loo_rmse', label: 'LOO RMSE', align: 'right', render: (v) => v != null && Number(v) > 0 ? <Databar value={Number(v)} maxVal={maxRmse} /> : <span style={{ color: DT.mutedDash }}>—</span> },
              { key: 'status', label: 'Statut', render: (v) => {
                const s = String(v ?? '')
                if (s === 'complet') return <Badge style={{ background: '#DCFCE7', color: '#166534', border: 'none', fontSize: '11px' }}><span style={{ color: '#22C55E', marginRight: 4 }}>●</span>Complet</Badge>
                if (s === 'partiel') return <Badge style={{ background: '#FEF9C3', color: '#854D0E', border: 'none', fontSize: '11px' }}><span style={{ color: '#EAB308', marginRight: 4 }}>●</span>Partiel</Badge>
                return <Badge style={{ background: '#FEE2E2', color: '#991B1B', border: 'none', fontSize: '11px' }}><span style={{ color: '#EF4444', marginRight: 4 }}>●</span>Vide</Badge>
              }},
            ]}
            rows={coverage}
            maxRows={30}
          />
          <div style={{ marginTop: 16, borderTop: '1px solid #E2E8F0', paddingTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1E293B' }}>Visualisation spatiale</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={mapParam}
                  onChange={e => setMapParam(e.target.value)}
                  style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: '1px solid #E2E8F0', background: DT.headerBg, color: DT.cellColor }}
                >
                  {coverage.map((c: any) => (
                    <option key={String(c.parameter_id)} value={String(c.parameter_id)}>
                      {String(c.parameter_id)} ({Number(c.coverage_pct ?? 0).toFixed(0)}%)
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const next = !showCoverageMap
                    setShowCoverageMap(next)
                    if (next) setTimeout(() => loadCoverageMap(mapParam), 100)
                  }}
                  style={{
                    padding: '4px 12px', borderRadius: 4, fontSize: 11,
                    border: `1px solid #E2E8F0`,
                    background: showCoverageMap ? DT.activeBlue : 'transparent',
                    color: showCoverageMap ? '#fff' : DT.headerColor, cursor: 'pointer',
                  }}
                >
                  {showCoverageMap ? 'Masquer carte' : 'Voir carte'}
                </button>
              </div>
            </div>
            {showCoverageMap && (
              <div style={{ position: 'relative' }}>
                <div ref={mapRef} style={{ height: 350, borderRadius: 8, border: '1px solid #E2E8F0', overflow: 'hidden' }} />
                <div style={{
                  position: 'absolute', bottom: 8, right: 8, zIndex: 1000,
                  background: 'rgba(15,23,42,0.85)', padding: '6px 10px',
                  borderRadius: 4, fontSize: 11, color: '#F8FAFC',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 2, background: '#22C55E', display: 'block' }} />
                    Interpolé
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 2, background: '#EF4444', display: 'block' }} />
                    Manquant
                  </div>
                </div>
              </div>
            )}
            {showCoverageMap && (
              <p style={{ fontSize: 10, color: DT.headerColor, marginTop: 4 }}>
                Vert = mailles interpolées • Rouge = mailles sans données • Cliquer une maille pour les détails
              </p>
            )}
          </div>
        </SectionCard>
      )}
    </SectionLayout>
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
  const [variogramAlert, setVariogramAlert] = useState<{ type: 'warning' | 'error'; msg: string } | null>(null)
  const [comparingHorizons, setComparingHorizons] = useState(false)
  const [section, setSection] = useSectionState('variogrammes', 'params')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const token = localStorage.getItem('atlas_token') ?? ''
        const res = await fetch(
          `${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/ai/variograms/summary`,
          { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
        )
        if (!res.ok) throw new Error(`variograms/summary: ${res.status}`)
        const json = await res.json()
        if (!cancelled) setVariograms((json.items ?? []) as Row[])
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
        // É6 : alerte variogramme incomplet / pur effet pépite
        const matchRow = variograms.find(v => String(v.parameter_id) === selectedParam)
        if (matchRow && matchRow.nugget != null && matchRow.sill != null) {
          const diff = Math.abs(Number(matchRow.nugget) - Number(matchRow.sill))
          if (diff < 1e-6) {
            setVariogramAlert({ type: 'warning', msg: '⚠️ Variogramme pur effet pépite (nugget ≈ sill = ' + Number(matchRow.nugget).toFixed(4) + '). Aucune structure spatiale détectable à cette échelle. Résultat mathématiquement valide mais non informatif pour le kriging.' })
          } else {
            setVariogramAlert(null)
          }
        } else {
          setVariogramAlert({ type: 'error', msg: '⚠️ Métadonnées manquantes (nugget/sill/portée = NULL en DB). Relancer le pipeline via Infer/Opti → KED + RGA.' })
        }
      } else if (res?.svg) {
        setSvgError('Le variogramme a été généré mais ne contient pas de courbe (métadonnées incomplètes). Vérifiez que nugget, sill et range sont renseignés dans ai_variograms.')
        setVariogramAlert({ type: 'error', msg: '⚠️ Métadonnées manquantes (nugget/sill/portée = NULL en DB). Relancer le pipeline via Infer/Opti → KED + RGA.' })
      } else {
        setSvgError('Aucun SVG retourné par le serveur.')
      }
    } catch (e: unknown) {
      setSvgError(e instanceof Error ? e.message : String(e))
    } finally {
      setSvgLoading(false)
    }
  }, [selectedParam, selectedHorizon, variograms])

  const handleCompareHorizons = useCallback(async () => {
    setComparingHorizons(true)
    setVariogramAlert(null)
    try {
      const base = selectedParam.replace(/_h[123]$/, '')
      const res = await api.post<any>('/ai/plots/variogram-compare', {
        parameter_base: base,
        horizons: ['h1', 'h2', 'h3'],
      })
      if (res?.svg) {
        setSvgContent(String(res.svg))
        setSection('visualisation')
      } else {
        setVariogramAlert({ type: 'error', msg: res?.error ?? 'Aucun variogramme avec métadonnées pour ce paramètre' })
      }
    } catch (e: unknown) {
      setVariogramAlert({ type: 'error', msg: e instanceof Error ? e.message : String(e) })
    } finally {
      setComparingHorizons(false)
    }
  }, [selectedParam])

  const params = [...new Set(variograms.map(v => String(v.parameter_id ?? '')))].filter(Boolean)
  const horizons = ['H1', 'H2', 'H3']
  const maxRmse = Math.max(...variograms.map(v => Number(v.loo_rmse ?? 0)), 0.01)

  const navItems: NavItem[] = [
    { id: 'params', label: 'Paramètres' },
    { id: 'resultats', label: 'Résultats', badge: String(variograms.filter(v => String(v.parameter_id) === selectedParam).length) },
    { id: 'visualisation', label: 'Visualisation' },
    { id: 'multi', label: 'Multi-domaines', badge: String(variograms.length) },
  ]

  return (
    <SectionLayout nav={<SectionNav items={navItems} active={section} onChange={setSection} />}>
      {section === 'params' && (
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
            {selectedParam.includes('_ked_') && (
              <button
                onClick={handleCompareHorizons}
                disabled={comparingHorizons}
                className="flex items-center gap-1.5 text-white rounded font-medium text-xs px-3 py-1.5 disabled:opacity-50"
                style={{ background: comparingHorizons ? '#94A3B8' : '#7C3AED' }}
              >
                {comparingHorizons ? <Loader2 className="h-3 w-3 animate-spin" /> : <GitCompare size={12} strokeWidth={1.5} />}
                Comparer H1/H2/H3
              </button>
            )}
          </div>
        </div>
      )}
      {section === 'resultats' && (
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
              { key: 'loo_rmse', label: 'LOO RMSE', align: 'right', render: (v) => {
                if (v === null || v === undefined) return <span style={{ color: DT.mutedDash }}>—</span>
                const n = Number(v)
                if (!Number.isFinite(n) || n === 0) return <span style={{ color: DT.mutedDash }}>—</span>
                return <Databar value={n} maxVal={maxRmse} />
              }},
              { key: 'loo_rmse_qual', label: 'Qualité', render: (_v, r) => <QualityPill value={r.loo_rmse as number | null} sill={r.sill as number | null} /> },
            ]}
            rows={variograms.filter(v => String(v.parameter_id) === selectedParam)}
            maxRows={20}
          />
        </SectionCard>
      )}
      {section === 'visualisation' && (
        <SectionCard icon={Activity} title="Visualisation du variogramme">
          {svgError && (
            <div className="flex items-center gap-2 mb-3 p-2 rounded" style={{ background: '#FEF3C7', border: '1px solid #F59E0B' }}>
              <AlertCircle size={14} style={{ color: '#92400E' }} />
              <span style={{ fontSize: '12px', color: '#92400E' }}>{svgError}</span>
            </div>
          )}
          {variogramAlert && (
            <div style={{
              margin: '0 0 12px', padding: '10px 14px', borderRadius: 6,
              background: variogramAlert.type === 'warning' ? '#FFF7ED' : '#FEF3C7',
              border: `1px solid ${variogramAlert.type === 'warning' ? '#FB923C' : '#F59E0B'}`,
              fontSize: 12, color: '#92400E', lineHeight: 1.5,
            }}>
              {variogramAlert.msg}
            </div>
          )}
          {svgContent ? (
            <div className="rounded p-2" style={{ background: '#0F172A', width: '100%', overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: svgContent }} />
          ) : !svgLoading && (
            <div className="flex flex-col items-center justify-center" style={{ minHeight: '300px', background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: '8px', color: '#94A3B8', padding: '24px' }}>
              <Activity size={32} strokeWidth={1} style={{ color: '#CBD5E1', marginBottom: 8 }} />
              <span style={{ fontSize: '13px' }}>Sélectionnez un paramètre et un horizon</span>
              <span style={{ fontSize: '11px', marginTop: 4 }}>puis cliquez sur « Générer modèle » dans l'onglet Paramètres</span>
            </div>
          )}
          {svgLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" style={{ color: DT.activeBlue }} /></div>}
          {svgContent && (() => {
            const matchRow = variograms.find(v => String(v.parameter_id) === selectedParam)
            if (!matchRow) return null
            return (
              <div className="mt-3 grid grid-cols-5 gap-2">
                {[
                  ['Nugget', matchRow.nugget],
                  ['Sill', matchRow.sill],
                  ['Portée (km)', matchRow.range_m != null ? (Number(matchRow.range_m) / 1000).toFixed(1) : null],
                  ['Modèle', matchRow.model_type],
                  ['LOO RMSE', matchRow.loo_rmse],
                ].map(([label, val]) => (
                  <div key={String(label)} style={{ background: DT.headerBg, border: '1px solid #E2E8F0', borderRadius: '6px' }} className="p-2 text-center">
                    <div style={{ fontSize: DT.headerFontSize, color: DT.headerColor, textTransform: 'uppercase' }}>{String(label)}</div>
                    <div className="text-sm font-bold" style={{ color: DT.cellColor }}>{fmt(val)}</div>
                  </div>
                ))}
              </div>
            )
          })()}
        </SectionCard>
      )}
      {section === 'multi' && (
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
              { key: 'loo_rmse', label: 'LOO RMSE', align: 'right', render: (_v, r) => {
                const val = r.loo_rmse
                if (val === null || val === undefined) return <span style={{color: DT.mutedDash}}>—</span>
                const n = Number(val)
                if (!Number.isFinite(n) || n === 0) return <span style={{color: DT.mutedDash}}>—</span>
                return <Databar value={n} maxVal={maxRmse} />
              }},
              { key: 'loo_rmse_qual', label: 'Qualité', render: (_v, r) => <QualityPill value={r.loo_rmse as number | null} sill={r.sill as number | null} /> },
            ]}
            rows={dedupVariograms(variograms)}
            maxRows={50}
          />
        </SectionCard>
      )}
    </SectionLayout>
  )
}

/* ═══════════════════════════════════════════════════════════
   SOUS-ONGLET 3 : Validation
   ═══════════════════════════════════════════════════════════ */
function ValidationTab() {
  const [variograms, setVariograms] = useState<Row[]>([])
  const [runs, setRuns] = useState<Row[]>([])
  const [section, setSection] = useSectionState('validation', 'loo')

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

  const navItems: NavItem[] = [
    { id: 'loo', label: 'LOO Validation', badge: String(variograms.length) },
    { id: 'rmse_param', label: 'RMSE param.', badge: String(variograms.length) },
    { id: 'rmse_domaine', label: 'RMSE domaine', badge: String(runs.length) },
  ]

  return (
    <SectionLayout nav={<SectionNav items={navItems} active={section} onChange={setSection} />}>
      {section === 'loo' && (
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
              { key: 'loo_rmse', label: 'LOO RMSE', align: 'right', render: (v) => {
                if (v === null || v === undefined) return <span style={{ color: DT.mutedDash }}>—</span>
                const n = Number(v)
                if (!Number.isFinite(n) || n === 0) return <span style={{ color: DT.mutedDash }}>—</span>
                return <Databar value={n} maxVal={maxRmse} />
              }},
              { key: 'loo_rmse_qual', label: 'Qualité', render: (_v, r) => <QualityPill value={r.loo_rmse as number | null} sill={r.sill as number | null} /> },
            ]}
            rows={variograms}
            maxRows={50}
          />
          <p style={{ fontSize: '10px', color: DT.headerColor, marginTop: 8 }}>LOO RMSE calculé sur les localités AMESSEFE</p>
        </SectionCard>
      )}
      {section === 'rmse_param' && (
        <SectionCard icon={Activity} title="RMSE par paramètre" action={<ExportBtn rows={variograms} filename="rmse_by_param.csv" />}>
          <DataTable
            columns={[
              { key: 'parameter_id', label: 'Paramètre' },
              { key: 'horizon_label', label: 'Horizon', render: (v, r) => {
                const fq = r.fit_quality as Record<string, unknown> | null
                return fmtDash(fq?.horizon_label ?? v)
              }},
              { key: 'loo_rmse', label: 'RMSE', align: 'right', render: (v) => {
                if (v === null || v === undefined) return <span style={{ color: DT.mutedDash }}>—</span>
                const n = Number(v)
                if (!Number.isFinite(n) || n === 0) return <span style={{ color: DT.mutedDash }}>—</span>
                return <Databar value={n} maxVal={maxRmse} />
              }},
              { key: 'loo_rmse_qual', label: 'Qualité', render: (_v, r) => <QualityPill value={r.loo_rmse as number | null} sill={r.sill as number | null} /> },
            ]}
            rows={variograms}
            maxRows={30}
          />
        </SectionCard>
      )}
      {section === 'rmse_domaine' && (
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
      )}
    </SectionLayout>
  )
}

/* ═══════════════════════════════════════════════════════════
   SOUS-ONGLET 4 : ML — Pipeline L1-L5 + Supervisés
   ═══════════════════════════════════════════════════════════ */
interface PipelineModel {
  id: string; label: string; method_db: string; status: string
  n_mailles: number; n_params: number; last_run_at: string | null
  metrics: Record<string, any>; warnings: string[]
}
interface JobState { jobId: string; status: 'running' | 'done' | 'error'; message: string }

const LEVEL_MAP: Record<string, string> = {
  L1_KED_H: 'L1', L2a_RK: 'L2a', L2b_BLUP: 'L2b',
  L3_VFS: 'L3', L4_MTGP: 'L4', L5_SGS: 'L5',
}
const JOB_TYPE_MAP: Record<string, string> = {
  L1_KED_H: 'ked_recompute', L2a_RK: 'rk_recompute', L2b_BLUP: 'blup_recompute',
  L3_VFS: 'vfs_extract', L4_MTGP: 'mtgp_recompute', L5_SGS: 'sgs_compute',
}

function MLTab() {
  const [pipelineModels, setPipelineModels] = useState<PipelineModel[]>([])
  const [supervisedModels, setSupervisedModels] = useState<Row[]>([])
  const [loadingPipeline, setLoadingPipeline] = useState(true)
  const [jobStates, setJobStates] = useState<Record<string, JobState>>({})
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [section, setSection] = useSectionState('ml', 'pipeline')

  const getHeaders = () => {
    const token = localStorage.getItem('atlas_token') ?? ''
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  const refreshPipeline = useCallback(async () => {
    try {
      const resp = await fetch('/api/ai/models/status', { headers: getHeaders() })
      if (resp.ok) {
        const data = await resp.json()
        setPipelineModels(data.models ?? [])
      }
    } catch { /* ok */ }
  }, [])

  const pollJob = useCallback((modelId: string, jobId: string) => {
    const check = async () => {
      try {
        const resp = await fetch(`/api/ai/jobs/${jobId}`, { headers: getHeaders() })
        if (!resp.ok) return
        const job = await resp.json()
        if (job.status === 'finished') {
          setJobStates(prev => ({ ...prev, [modelId]: { jobId, status: 'done', message: 'Terminé ✓' } }))
          setTimeout(refreshPipeline, 1000)
        } else if (job.status === 'failed') {
          setJobStates(prev => ({ ...prev, [modelId]: { jobId, status: 'error', message: job.error_message ?? 'Erreur script' } }))
        } else {
          setJobStates(prev => ({ ...prev, [modelId]: { jobId, status: 'running', message: `${job.status}…` } }))
          setTimeout(check, 3000)
        }
      } catch { setTimeout(check, 5000) }
    }
    setTimeout(check, 3000)
  }, [refreshPipeline])

  const handleTrigger = useCallback(async (modelId: string) => {
    const jobType = JOB_TYPE_MAP[modelId]
    if (!jobType) return
    setJobStates(prev => ({ ...prev, [modelId]: { jobId: '', status: 'running', message: 'Envoi en queue…' } }))
    try {
      const resp = await fetch('/api/ai/jobs/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify({ job_type: jobType, requested_by: 'expert-panel' }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }))
        throw new Error(err.error ?? `HTTP ${resp.status}`)
      }
      const data = await resp.json()
      const jobId = data.job_id
      setJobStates(prev => ({ ...prev, [modelId]: { jobId, status: 'running', message: 'En queue…' } }))
      pollJob(modelId, jobId)
    } catch (e) {
      setJobStates(prev => ({ ...prev, [modelId]: { jobId: '', status: 'error', message: String(e) } }))
    }
  }, [pollJob])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingPipeline(true)
      try {
        const [pRes, mlRes] = await Promise.allSettled([
          fetch('/api/ai/models/status', { headers: getHeaders() }).then(r => r.json()),
          api.get<any>('/api/stats/ml-registry'),
        ])
        if (!cancelled) {
          if (pRes.status === 'fulfilled') setPipelineModels(pRes.value.models ?? [])
          if (mlRes.status === 'fulfilled') setSupervisedModels((mlRes.value?.items ?? []) as Row[])
        }
      } catch { /* ok */ }
      finally { if (!cancelled) setLoadingPipeline(false) }
    })()
    return () => { cancelled = true }
  }, [])

  const statusBadgeNode = (status: string) => {
    if (status === 'ready') return <Badge style={{ background: '#DCFCE7', color: '#166534', border: 'none', fontSize: '11px' }}><span style={{ color: '#22C55E', marginRight: 4 }}>●</span>Prêt</Badge>
    if (status === 'partial') return <Badge style={{ background: '#FEF9C3', color: '#854D0E', border: 'none', fontSize: '11px' }}><span style={{ color: '#EAB308', marginRight: 4 }}>●</span>Partiel</Badge>
    if (status === 'running') return <Badge style={{ background: '#DBEAFE', color: '#1E40AF', border: 'none', fontSize: '11px' }}><span style={{ color: '#3B82F6', marginRight: 4 }}>●</span>En cours</Badge>
    return <Badge style={{ background: '#F1F5F9', color: '#475569', border: 'none', fontSize: '11px' }}><span style={{ color: '#94A3B8', marginRight: 4 }}>●</span>Non calculé</Badge>
  }

  const navItems: NavItem[] = [
    { id: 'pipeline', label: 'Pipeline L1-L5', badge: String(pipelineModels.length) },
    { id: 'supervised', label: 'Supervisés CatBoost', badge: String(supervisedModels.length) },
  ]

  const supervisedColumns = [
    { key: 'model_target', label: 'Cible' },
    { key: 'model_version', label: 'Version', render: (v: any) => <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>{String(v ?? '—')}</code> },
    { key: 'dataset_size', label: 'Dataset', align: 'right' as const, render: (v: any) => v ? <span>{v} sondages</span> : <span style={{ color: DT.mutedDash }}>—</span> },
    { key: 'rmse_cv', label: 'RMSE CV', align: 'right' as const, render: (v: any) => v != null ? <span>{Number(v).toFixed(3)}</span> : <span style={{ color: DT.mutedDash }}>—</span> },
    { key: 'r2_cv', label: 'R² CV', align: 'right' as const, render: (v: any) => {
      if (v == null) return <span style={{ color: DT.mutedDash }}>—</span>
      const n = Number(v)
      return <span style={{ color: n > 0 ? '#22C55E' : '#EF4444', fontWeight: 600 }}>{n.toFixed(3)}</span>
    }},
    { key: 'status', label: 'Statut', render: (v: any) => v === 'active'
      ? <Badge style={{ background: '#DCFCE7', color: '#166534', border: 'none', fontSize: '11px' }}><span style={{ color: '#22C55E', marginRight: 4 }}>●</span>En production</Badge>
      : <Badge style={{ background: '#F1F5F9', color: '#94A3B8', border: 'none', fontSize: '11px' }}>Non déployé</Badge> },
    { key: 'actions', label: '', render: (_v: any, r: Row) => (
      <button onClick={() => setExpandedRow(expandedRow === String(r.model_target) ? null : String(r.model_target))}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: DT.activeBlue, fontSize: '11px' }}>
        {expandedRow === String(r.model_target) ? 'Masquer' : 'Voir détails'}
      </button>
    )},
  ]

  return (
    <SectionLayout nav={<SectionNav items={navItems} active={section} onChange={setSection} />}>

      {section === 'pipeline' && (
        <SectionCard icon={Cpu} title="Pipeline géostatistique L1-L5"
          action={
            <button onClick={refreshPipeline} className="flex items-center gap-1 text-xs transition-colors"
              style={{ color: DT.headerColor, background: 'none', border: 'none', cursor: 'pointer' }}>
              <RefreshCw size={12} strokeWidth={1.5} /> Rafraîchir
            </button>
          }
        >
          {loadingPipeline ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" style={{ color: DT.activeBlue }} /></div>
          ) : pipelineModels.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: DT.headerColor }}>
              <AlertCircle size={28} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              <p style={{ fontSize: 13 }}>Impossible de charger le statut des modèles</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full" style={{ fontSize: '12px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #CBD5E1' }}>
                      {['Niveau','Modèle','Statut','Params','Mailles','LOO-RMSE VBS H1','Dernier run','Action'].map(h => (
                        <th key={h} style={{ padding: '10px 8px', textAlign: h === 'Action' || h === 'Niveau' || h === 'Statut' ? 'center' : h === 'Params' || h === 'Mailles' || h === 'LOO-RMSE VBS H1' ? 'right' : 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: DT.headerColor, background: DT.headerBg, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pipelineModels.map(m => {
                      const jState = jobStates[m.id]
                      const isVfs = m.id === 'L3_VFS'
                      const isRunning = jState?.status === 'running' || m.status === 'running'
                      const level = LEVEL_MAP[m.id] ?? '?'
                      const rmseRaw = m.metrics?.['vbs_ked_h1']?.loo_rmse ?? m.metrics?.['variance_reduction_pct']
                      const rmseCell = rmseRaw != null
                        ? (m.id === 'L2b_BLUP' ? `σ²↓${Number(rmseRaw).toFixed(1)}%` : Number(rmseRaw).toFixed(2))
                        : '—'
                      const lastRun = m.last_run_at ? new Date(m.last_run_at).toLocaleDateString('fr-FR') : '—'

                      return (
                        <tr key={m.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <code style={{ fontSize: 11, background: '#EFF6FF', color: '#1D4ED8', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>{level}</code>
                          </td>
                          <td style={{ padding: '8px', maxWidth: 220 }}>
                            <strong style={{ fontSize: 12, color: DT.cellColor }}>{m.label}</strong>
                            <code style={{ display: 'block', fontSize: 10, color: '#64748B', marginTop: 2 }}>{m.method_db}</code>
                            {m.warnings?.[0] && (
                              <span style={{ display: 'block', fontSize: 10, color: '#F59E0B', marginTop: 2 }}>
                                ⚠ {m.warnings[0]}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{statusBadgeNode(m.status)}</td>
                          <td style={{ padding: '8px', textAlign: 'right', color: DT.cellColor }}>{m.n_params ?? '—'}</td>
                          <td style={{ padding: '8px', textAlign: 'right', color: DT.cellColor }}>{(m.n_mailles ?? 0).toLocaleString('fr-FR')}</td>
                          <td style={{ padding: '8px', textAlign: 'right', color: '#3B82F6', fontFamily: 'monospace' }}>{rmseCell}</td>
                          <td style={{ padding: '8px', color: DT.headerColor, whiteSpace: 'nowrap' }}>{lastRun}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            {isVfs ? (
                              <span style={{ fontSize: 10, color: '#94A3B8' }} title="Requiert connexion internet + Google Earth Engine">GEE requis</span>
                            ) : jState?.status === 'done' ? (
                              <span style={{ fontSize: 11, color: '#22C55E', fontWeight: 600 }}>✓ Terminé</span>
                            ) : jState?.status === 'error' ? (
                              <span style={{ fontSize: 11, color: '#EF4444', cursor: 'help' }} title={jState.message}>✗ Erreur</span>
                            ) : (
                              <button
                                disabled={isRunning}
                                onClick={() => handleTrigger(m.id)}
                                style={{
                                  fontSize: 10, padding: '3px 10px',
                                  border: `1px solid ${isRunning ? '#475569' : '#334155'}`,
                                  borderRadius: 4, background: isRunning ? '#0F172A' : '#1E293B',
                                  color: '#E2E8F0', cursor: isRunning ? 'not-allowed' : 'pointer',
                                  opacity: isRunning ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                                }}
                              >
                                {isRunning
                                  ? <><Loader2 size={10} className="animate-spin" />{jState?.message ?? 'En cours…'}</>
                                  : m.status === 'not_computed'
                                    ? <><Play size={10} /> Calculer</>
                                    : <><RefreshCw size={10} /> Recalculer</>
                                }
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 10, color: DT.headerColor, marginTop: 10, paddingTop: 8, borderTop: `1px solid #F1F5F9` }}>
                Les calculs sont mis en file d'attente (atlas.ai_job_queue) et exécutés par le worker Rust en arrière-plan.
                KED ~5 min • RK ~5 min • BLUP ~1 min • MTGP ~60 min • SGS ~30 min.
                L3-VFS requiert une connexion internet + accès Google Earth Engine.
              </p>
            </>
          )}
        </SectionCard>
      )}

      {section === 'supervised' && (
        <SectionCard icon={Brain} title="Modèles supervisés CatBoost" action={<ExportBtn rows={supervisedModels} filename="model_registry.csv" />}>
          {supervisedModels.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: DT.headerColor }}>
              <Brain size={32} strokeWidth={1} style={{ color: '#CBD5E1', margin: '0 auto 8px' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1E293B', marginBottom: 4 }}>Aucun modèle supervisé entraîné</h3>
              <p style={{ fontSize: '12px' }}>Aller dans Infer/Opti → Train supervisé</p>
            </div>
          ) : (
            <>
              <DataTable columns={supervisedColumns} rows={supervisedModels} />
              {expandedRow && (() => {
                const row = supervisedModels.find(m => String(m.model_target) === expandedRow)
                if (!row?.details) return null
                const d = row.details as any
                return (
                  <div className="mt-4 p-4 rounded" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <h4 style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', marginBottom: 8 }}>Détail par target ({String(row.model_target)})</h4>
                    {Number(row.r2_cv) < 0 && (
                      <div className="mb-3 p-3 rounded" style={{ background: '#FFF7ED', border: '1px solid #FB923C', fontSize: '12px', color: '#9A3412' }}>
                        <strong>⚠ R² négatifs</strong> — modèle moins précis que la moyenne. Données d'entraînement insuffisantes.
                      </div>
                    )}
                    <table className="w-full text-sm">
                      <thead><tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                        {['Target','N train','RMSE','R²'].map(h => <th key={h} style={{ textAlign: h === 'Target' ? 'left' : 'right', padding: '6px 10px' }}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {[['cg', d.n_cg, d.rmse_cg, d.r2_cg], ['ip', d.n_ip, d.rmse_ip, d.r2_ip], ['vbs', d.n_vbs, d.rmse_vbs, d.r2_vbs]].map(([tgt, n, rmse, r2]) => (
                          <tr key={String(tgt)} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '6px 10px', fontWeight: 500 }}>{tgt}</td>
                            <td style={{ textAlign: 'right', padding: '6px 10px' }}>{n ?? '—'}</td>
                            <td style={{ textAlign: 'right', padding: '6px 10px' }}>{rmse != null ? Number(rmse).toFixed(3) : '—'}</td>
                            <td style={{ textAlign: 'right', padding: '6px 10px', color: (Number(r2) ?? 0) > 0 ? '#16A34A' : '#DC2626' }}>{r2 != null ? Number(r2).toFixed(3) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })()}
            </>
          )}
        </SectionCard>
      )}

    </SectionLayout>
  )
}

/* ═══════════════════════════════════════════════════════════
   SOUS-ONGLET 5 : Comparaison
   ═══════════════════════════════════════════════════════════ */
function ComparaisonTab() {
  const [variograms, setVariograms] = useState<Row[]>([])
  const [runs, setRuns] = useState<Row[]>([])
  const [section, setSection] = useSectionState('comparaison', 'methodes')

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

  const navItems: NavItem[] = [
    { id: 'methodes', label: 'Méthodes', badge: String(variograms.length) },
    { id: 'comparaison', label: 'Comparatif', badge: String(runs.length) },
  ]

  return (
    <SectionLayout nav={<SectionNav items={navItems} active={section} onChange={setSection} />}>
      {section === 'methodes' && (
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
              { key: 'loo_rmse', label: 'RMSE', align: 'right', render: (v) => {
                if (v === null || v === undefined) return <span style={{ color: DT.mutedDash }}>—</span>
                const n = Number(v)
                if (!Number.isFinite(n) || n === 0) return <span style={{ color: DT.mutedDash }}>—</span>
                return <Databar value={n} maxVal={maxRmse} />
              }},
              { key: 'loo_rmse_qual', label: 'Qualité', render: (_v, r) => <QualityPill value={r.loo_rmse as number | null} sill={r.sill as number | null} /> },
            ]}
            rows={variograms}
            maxRows={50}
          />
          <p style={{ fontSize: '10px', color: DT.headerColor, marginTop: 8 }}>
            Le KED pédologique améliore le kriging global en exploitant la covariable type_sol.
            La régression kriging sera activée automatiquement dès 30 sondages par domaine.
          </p>
        </SectionCard>
      )}
      {section === 'comparaison' && (
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
      )}
    </SectionLayout>
  )
}

/* ═══════════════════════════════════════════════════════════
   SOUS-ONGLET 6 : Système
   ═══════════════════════════════════════════════════════════ */
function SystemeTab({ catalog, jobs, plotCache, plotCacheCount, onRefresh }: { catalog: Row[]; jobs: Row[]; plotCache: Row[]; plotCacheCount: number; onRefresh: () => void }) {
  const [svgModal, setSvgModal] = useState<string | null>(null)
  const [section, setSection] = useSectionState('systeme', 'jobs')

  const purgeCache = async () => {
    try {
      await api.delete('/ai/plots/cache')
      onRefresh()
    } catch { /* ok */ }
  }

  const navItems: NavItem[] = [
    { id: 'jobs', label: 'File de jobs', badge: String(jobs.length) },
    { id: 'cache', label: 'Cache graphiques', badge: String(plotCacheCount) },
  ]

  return (
    <SectionLayout nav={<SectionNav items={navItems} active={section} onChange={setSection} />}>
      {section === 'jobs' && (
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
      )}
      {section === 'cache' && (
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
              { key: 'svg_size', label: 'Taille SVG', align: 'right', render: (_v, r) => {
                const content = r.svg ?? r.svg_content ?? ''
                return content ? <span>{(String(content).length / 1024).toFixed(1)} KB</span> : <span style={{ color: DT.mutedDash }}>—</span>
              }},
              { key: 'created_at', label: 'Créé le', render: (v) => v ? new Date(String(v)).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : <span style={{ color: DT.mutedDash }}>—</span> },
              { key: 'svg_view', label: 'Voir', render: (_v, r) => {
                const content = r.svg ?? r.svg_content ?? ''
                return content ? <Button variant="ghost" size="sm" onClick={() => setSvgModal(String(content))}><Eye size={12} strokeWidth={1.5} /></Button> : null
              }},
            ]}
            rows={plotCache}
            maxRows={30}
          />
        </SectionCard>
      )}

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
    </SectionLayout>
  )
}

/* ─── HistogramChart SVG inline ─── */
interface HistoBin {
  bin: number
  count: number
  bin_min: number
  bin_max: number
}

function HistogramChart({ bins, paramLabel }: {
  bins: HistoBin[]
  paramLabel: string
}) {
  if (!bins || bins.length === 0) return (
    <div style={{
      minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#94A3B8', fontSize: 12, border: '1px dashed #334155', borderRadius: 6,
    }}>
      Aucune donnée de distribution disponible
    </div>
  )

  const maxCount = Math.max(...bins.map(b => b.count), 1)
  const W = 560, H = 180, PADX = 48, PADY = 20
  const plotW = W - PADX * 2
  const plotH = H - PADY * 2
  const barW = plotW / bins.length

  const color = paramLabel.startsWith('vbs') ? '#8B5CF6' :
                paramLabel.startsWith('eg')  ? '#F59E0B' :
                paramLabel.startsWith('ip')  ? '#EF4444' :
                paramLabel.startsWith('wl')  ? '#06B6D4' :
                paramLabel.startsWith('wp')  ? '#10B981' :
                '#3B82F6'

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 24}`} style={{ fontFamily: 'Inter, sans-serif', overflow: 'visible' }}>
      {[0.25, 0.5, 0.75, 1].map(ratio => {
        const y = PADY + plotH - plotH * ratio
        return (
          <g key={ratio}>
            <line x1={PADX} y1={y} x2={W - PADX} y2={y} stroke="#1E293B" strokeWidth={1} strokeDasharray="3 3" />
            <text x={PADX - 4} y={y + 4} fontSize={9} fill="#64748B" textAnchor="end">
              {Math.round(maxCount * ratio).toLocaleString()}
            </text>
          </g>
        )
      })}
      {bins.map((bin, i) => {
        const barH = Math.max(2, (bin.count / maxCount) * plotH)
        const x = PADX + i * barW
        const y = PADY + plotH - barH
        return (
          <g key={i}>
            <rect x={x + 1} y={y} width={Math.max(1, barW - 2)} height={barH} fill={color} opacity={0.85} rx={2} />
            <title>[{bin.bin_min.toFixed(2)}, {bin.bin_max.toFixed(2)}]{'\n'}n = {bin.count.toLocaleString()}</title>
          </g>
        )
      })}
      <line x1={PADX} y1={PADY + plotH} x2={W - PADX} y2={PADY + plotH} stroke="#475569" strokeWidth={1} />
      {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
        const idx = Math.round(ratio * (bins.length - 1))
        const bin = bins[idx]
        if (!bin) return null
        const x = PADX + (idx + 0.5) * barW
        return (
          <text key={ratio} x={x} y={PADY + plotH + 14} fontSize={9} fill="#94A3B8" textAnchor="middle">
            {bin.bin_min.toFixed(1)}
          </text>
        )
      })}
      <text x={W / 2} y={H + 22} fontSize={9} fill="#64748B" textAnchor="middle">{paramLabel}</text>
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════════
   SOUS-ONGLET EDA : Analyse exploratoire des données
   ═══════════════════════════════════════════════════════════ */
const PARAMETERS = ['vbs', 'ip', 'wl', 'wp', 'eg_avg', 'eg_ked_h1']

function EdaTab() {
  const [selectedParam, setSelectedParam] = useState('vbs')
  const [descStats, setDescStats] = useState<Row | null>(null)
  const [histogram, setHistogram] = useState<HistoBin[]>([])
  const [correlations, setCorrelations] = useState<Row[]>([])
  const [variograms, setVariograms] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [edaHorizon, setEdaHorizon] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const horizonParam = edaHorizon ? `&horizon=${edaHorizon}` : ''
        const [desc, eda, corr, vData] = await Promise.all([
          api.get<any>(`/api/stats/descriptive?parameter=${selectedParam}${horizonParam}`),
          api.get<any>(`/api/stats/eda?parameter=${selectedParam}&bins=10${horizonParam}`),
          api.get<any>('/api/stats/correlations'),
          tablesApi.getData('atlas', 'ai_variograms', 100, 0),
        ])
        if (!cancelled) {
          setDescStats(desc)
          setHistogram((eda?.histogram ?? []) as HistoBin[])
          setCorrelations(corr?.items ?? [])
          setVariograms(vData as Row[])
        }
      } catch { /* ok */ }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [selectedParam, edaHorizon])

  return (
    <div className="space-y-6">
      <SectionCard icon={BarChart2} title="Histogrammes et statistiques descriptives">
        <div className="flex items-center gap-3 mb-4">
          <span style={{ fontSize: DT.headerFontSize, color: DT.headerColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Paramètre</span>
          <select className="border rounded px-2 py-1 text-xs" style={{ borderColor: '#E2E8F0', background: DT.cardBg }} value={selectedParam} onChange={e => { setSelectedParam(e.target.value); setEdaHorizon(null) }}>
            {PARAMETERS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {selectedParam.includes('_ked_') && (
            <div style={{ display: 'flex', gap: 8 }}>
              {['H1', 'H2', 'H3'].map(h => (
                <button
                  key={h}
                  onClick={() => setEdaHorizon(edaHorizon === h ? null : h)}
                  style={{
                    padding: '4px 12px', borderRadius: 4,
                    border: `1px solid ${edaHorizon === h ? DT.activeBlue : '#E2E8F0'}`,
                    background: edaHorizon === h ? `${DT.activeBlue}20` : 'transparent',
                    color: edaHorizon === h ? DT.activeBlue : DT.headerColor,
                    cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  }}
                >
                  {h}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <h4 style={{ fontSize: 12, fontWeight: 600, color: DT.cellColor, marginBottom: 8 }}>
            Distribution des valeurs interpolées
          </h4>
          <HistogramChart bins={histogram} paramLabel={selectedParam} />
        </div>

        {descStats && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { label: 'N', value: (descStats.n as number)?.toLocaleString() },
                { label: 'Moyenne', value: (descStats.mean as number)?.toFixed(3) },
                { label: 'Médiane', value: (descStats.median as number)?.toFixed(3) },
                { label: 'Écart-type', value: (descStats.stddev as number)?.toFixed(3) },
                { label: 'Min', value: (descStats.min as number)?.toFixed(3) },
                { label: 'Max', value: (descStats.max as number)?.toFixed(3) },
                { label: 'Q1 (25%)', value: (descStats.q1 as number)?.toFixed(3) },
                { label: 'Q2 (50%)', value: (descStats.median as number)?.toFixed(3) },
                { label: 'Q3 (75%)', value: (descStats.q3 as number)?.toFixed(3) },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: '8px 12px', background: DT.headerBg, border: `1px solid #E2E8F0`, borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: DT.headerColor, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: DT.cellColor }}>{value ?? '—'}</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '10px', color: DT.headerColor, marginTop: 4 }}>Source : {String(descStats.source ?? '—')}</p>
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
  const [plotCacheCount, setPlotCacheCount] = useState<number>(0)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [a, b, c, cacheInfo] = await Promise.all([
        tablesApi.getData('atlas', 'ai_parameter_catalog', 50, 0),
        tablesApi.getData('atlas', 'ai_job_queue', 50, 0),
        tablesApi.getData('atlas', 'ai_plot_cache', 50, 0),
        tablesApi.getTableInfo('atlas', 'ai_plot_cache'),
      ])
      setCatalog(a as Row[])
      setJobs(b as Row[])
      setPlotCache(c as Row[])
      setPlotCacheCount(cacheInfo?.row_count ?? (c as Row[]).length)
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
    <div className="w-full">
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
        <TabsContent value="systeme"><SystemeTab catalog={catalog} jobs={jobs} plotCache={plotCache} plotCacheCount={plotCacheCount} onRefresh={loadData} /></TabsContent>
      </Tabs>
    </div>
  )
}
