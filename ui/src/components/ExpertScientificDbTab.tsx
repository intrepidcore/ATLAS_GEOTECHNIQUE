import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
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

/* ─── Data Table (Premium Dense Grid) — sortable + loading ─── */
const PAGE_SIZE = 15
const SKEL_WIDTHS = [75, 55, 65, 45, 60, 50, 70, 40]

function SkeletonRows({ cols = 4, rows = 5 }: { cols?: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} style={{ padding: '10px 16px' }}>
              <div className="animate-pulse" style={{ height: 12, borderRadius: 4, background: '#E2E8F0', width: `${SKEL_WIDTHS[(i + j) % SKEL_WIDTHS.length]}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function DataTable({ columns, rows, maxRows, onRowAction, sortable = true, loading = false, emptyState }: {
  columns: { key: string; label: string; align?: 'left' | 'right'; render?: (v: unknown, row: Row) => React.ReactNode }[]
  rows: Row[]
  maxRows?: number
  onRowAction?: (row: Row, action: string) => void
  sortable?: boolean
  loading?: boolean
  emptyState?: React.ReactNode
}) {
  const [page, setPage] = useState(0)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  useEffect(() => { setPage(0) }, [rows])

  const handleSort = (key: string) => {
    if (!sortable) return
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortKey(null); setSortDir('asc') }
    } else { setSortKey(key); setSortDir('asc') }
  }

  const source = useMemo(() => {
    const base = maxRows ? rows.slice(0, maxRows) : rows
    if (!sortable || !sortKey) return base
    return [...base].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey]
      const an = Number(av); const bn = Number(bv)
      const cmp = Number.isFinite(an) && Number.isFinite(bn)
        ? an - bn
        : String(av ?? '').localeCompare(String(bv ?? ''), 'fr', { sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, maxRows, sortKey, sortDir, sortable])

  const totalPages = Math.max(1, Math.ceil(source.length / PAGE_SIZE))
  const display = source.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ fontSize: DT.cellFontSize }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #CBD5E1' }}>
            {columns.map(c => {
              const isActive = sortKey === c.key
              return (
                <th
                  key={c.key}
                  className="whitespace-nowrap"
                  onClick={() => sortable && handleSort(c.key)}
                  style={{
                    fontSize: DT.headerFontSize,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: isActive ? DT.activeBlue : DT.headerColor,
                    backgroundColor: DT.headerBg,
                    padding: '12px 16px',
                    textAlign: c.align === 'right' ? 'right' : 'left',
                    fontWeight: 500,
                    cursor: sortable ? 'pointer' : 'default',
                    userSelect: 'none',
                    transition: 'color 0.1s',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    {c.label}
                    {sortable && (
                      <span style={{ fontSize: 9, opacity: isActive ? 1 : 0.3, color: isActive ? DT.activeBlue : DT.headerColor }}>
                        {isActive ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    )}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows cols={columns.length} rows={5} />
          ) : display.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '32px 16px', textAlign: 'center', color: DT.headerColor }}>
                {emptyState ?? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 22, opacity: 0.2 }}>⊘</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#1E293B' }}>Aucune donnée</span>
                    <span style={{ fontSize: 11 }}>Vérifier que le pipeline ML a été exécuté</span>
                  </div>
                )}
              </td>
            </tr>
          ) : display.map((r, i) => (
            <tr key={i} className="group" style={{ borderBottom: '1px solid #F1F5F9' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = DT.hoverBg }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
            >
              {columns.map(c => (
                <td
                  key={c.key}
                  className="align-top max-w-[280px]"
                  style={{ padding: '10px 16px', color: DT.cellColor, textAlign: c.align === 'right' ? 'right' : 'left' }}
                >
                  {c.render ? c.render(r[c.key], r) : fmtDash(r[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderTop: `1px solid #E2E8F0`, fontSize: 12, color: DT.headerColor }}>
          <span>{source.length} entrées{sortKey ? ` • trié par ${sortKey} ${sortDir === 'asc' ? '▲' : '▼'}` : ''}</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              style={{ padding: '2px 8px', border: `1px solid #E2E8F0`, borderRadius: 4, background: 'none', cursor: 'pointer', opacity: page === 0 ? 0.4 : 1, fontSize: 12 }}>‹</button>
            <span>{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
              style={{ padding: '2px 8px', border: `1px solid #E2E8F0`, borderRadius: 4, background: 'none', cursor: 'pointer', opacity: page === totalPages - 1 ? 0.4 : 1, fontSize: 12 }}>›</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Databar (mini progress bar in cell) with optional legend ─── */
function Databar({ value, maxVal, color = DT.activeBlue, minVal = 0, showLegend = false }: {
  value: number; maxVal: number; color?: string; minVal?: number; showLegend?: boolean
}) {
  const range = maxVal - minVal
  const pct = range > 0 ? Math.min(((value - minVal) / range) * 100, 100) : 0
  return (
    <div style={{ fontSize: '12px', width: '100%' }}>
      <div className="relative w-full h-5">
        <div className="absolute inset-0 rounded" style={{ background: `${color}15` }} />
        <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${pct}%`, background: `${color}30`, transition: 'width 0.3s ease' }} />
        <span className="relative z-10 font-medium" style={{ color, paddingLeft: 4 }}>{value.toFixed(4)}</span>
      </div>
      {showLegend && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: DT.headerColor, marginTop: 2 }}>
          <span>{minVal.toFixed(3)}</span>
          <span>{maxVal.toFixed(3)}</span>
        </div>
      )}
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

/* ─── Auth helper (module-level, stable reference) ─── */
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('atlas_token') ?? ''
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/* ─── 11 paramètres géotechniques de base ─── */
const BASE_PARAMS = [
  { id: 'vbs', label: 'VBS — Valeur Bleu Soleil', unit: 'g/100g' },
  { id: 'ip', label: 'IP — Indice de plasticité', unit: '%' },
  { id: 'wl', label: 'WL — Limite de liquidité', unit: '%' },
  { id: 'wp', label: 'WP — Limite de plasticité', unit: '%' },
  { id: 'eg', label: 'EG — Équivalent Sable', unit: '%' },
  { id: 'passant_80um', label: 'Passant 80 μm', unit: '%' },
  { id: 'passant_2mm', label: 'Passant 2 mm', unit: '%' },
  { id: 'kriging_vbs', label: 'Kriging VBS', unit: 'g/100g' },
  { id: 'kriging_ip', label: 'Kriging IP', unit: '%' },
  { id: 'cg', label: 'CG — Teneur en gros', unit: '%' },
  { id: 'cbr', label: 'CBR — California Bearing Ratio', unit: '%' },
]

/* ─── Horizons pédologiques (profondeurs réelles Togo) ─── */
const HORIZONS = [
  { id: 'H1', label: 'H1 — 0–0.5 m', depth: '0–0.5 m' },
  { id: 'H2', label: 'H2 — 0.5–1 m', depth: '0.5–1 m' },
  { id: 'H3', label: 'H3 — 1–1.5 m', depth: '1–1.5 m' },
  { id: 'all', label: 'Tous les horizons', depth: '' },
]

/* ─── Design Tokens dark mode (nouvelles sections uniquement) ─── */
const DT_DARK = {
  cardBg: '#1E293B',
  cardBorder: '1px solid #334155',
  headerBg: '#0F172A',
  headerColor: '#94A3B8',
  cellColor: '#CBD5E1',
  hoverBg: '#334155',
  activeBlue: '#60A5FA',
  mutedDash: '#475569',
}

function useDarkTokens(): typeof DT | typeof DT_DARK {
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
  )
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains('dark'))
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return dark ? DT_DARK : DT
}

/* ─── Scientific Alert Banner ─── */
type AlertLevel = 'warning' | 'info' | 'critical'
interface SciAlert { level: AlertLevel; message: string; detail?: string }

function ScientificAlertBanner({ alerts }: { alerts: SciAlert[] }) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())
  if (!alerts.length) return null
  const active = alerts.filter((_, i) => !dismissed.has(i))
  if (!active.length) return null
  const colorMap: Record<AlertLevel, { bg: string; border: string; text: string; icon: string }> = {
    critical: { bg: '#FEF2F2', border: '#FECACA', text: '#DC2626', icon: '⚠' },
    warning:  { bg: '#FFFBEB', border: '#FDE68A', text: '#D97706', icon: '△' },
    info:     { bg: '#EFF6FF', border: '#BFDBFE', text: '#2563EB', icon: 'ℹ' },
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
      {active.map((a, i) => {
        const c = colorMap[a.level]
        const origIdx = alerts.indexOf(a)
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: 6 }}>
            <span style={{ color: c.text, fontSize: 14, flexShrink: 0, marginTop: 1 }}>{c.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: c.text }}>{a.message}</span>
              {a.detail && <span style={{ fontSize: 11, color: '#64748B', marginLeft: 6 }}>{a.detail}</span>}
            </div>
            <button onClick={() => setDismissed(s => new Set([...s, origIdx]))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.text, fontSize: 14, flexShrink: 0, padding: 0, opacity: 0.5, lineHeight: 1 }}>×</button>
          </div>
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   SOUS-ONGLET 1 : Données brutes
   ═══════════════════════════════════════════════════════════ */
function DonneesBrutesTab({ catalog, jobs, plotCache }: { catalog: Row[]; jobs: Row[]; plotCache: Row[] }) {
  const [section, setSection] = useSectionState('donnees-brutes', 'resume')
  const [sondages, setSondages] = useState<Row[]>([])
  const [sondagesLoading, setSondagesLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setSondagesLoading(true)
    ;(async () => {
      try {
        const data = await tablesApi.getData('atlas', 'sondages', 300, 0)
        if (!cancelled) setSondages(data as Row[])
      } catch { /* ok */ } finally {
        if (!cancelled) setSondagesLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const byRegion: Record<string, { total: number; haute: number }> = {}
  for (const s of sondages) {
    const r = String(s.region ?? s.commune ?? 'Inconnue')
    if (!byRegion[r]) byRegion[r] = { total: 0, haute: 0 }
    const entry = byRegion[r]!
    entry.total++
    if (['A', 'B', 'haute', 'good'].includes(String(s.fiabilite ?? s.quality ?? '').toLowerCase())) entry.haute++
  }
  const regionEntries = Object.entries(byRegion).sort(([, a], [, b]) => b.total - a.total)
  const maxSondages = Math.max(...regionEntries.map(([, v]) => v.total), 1)

  const navItems: NavItem[] = [
    { id: 'resume', label: 'Résumé', badge: '6' },
    { id: 'sondages', label: 'Sondages', badge: String(sondages.length) },
    { id: 'catalogue', label: 'Catalogue', badge: String(catalog.length) },
  ]

  return (
    <SectionLayout nav={<SectionNav items={navItems} active={section} onChange={setSection} />}>
      {section === 'sondages' && (
        <SectionCard icon={MapPin} title="Distribution & fiabilité régionale des sondages" action={<ExportBtn rows={sondages} filename="sondages.csv" />}>
          {sondagesLoading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: DT.headerColor, fontSize: 13 }}>
              <div className="animate-pulse" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[80, 65, 75, 55, 70].map((w, i) => (
                  <div key={i} style={{ height: 16, borderRadius: 4, background: '#E2E8F0', width: `${w}%`, margin: '0 auto' }} />
                ))}
              </div>
            </div>
          ) : sondages.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: DT.headerColor, fontSize: 13 }}>
              <MapPin size={28} style={{ margin: '0 auto 8px', opacity: 0.2 }} />
              <div style={{ fontWeight: 600, color: '#1E293B', marginBottom: 4 }}>Aucun sondage chargé</div>
              <div style={{ fontSize: 12 }}>Vérifier que la table <code style={{ background: '#F1F5F9', padding: '1px 5px', borderRadius: 3 }}>atlas.sondages</code> est peuplée</div>
              <button
                onClick={() => { setSondagesLoading(true); tablesApi.getData('atlas', 'sondages', 300, 0).then(d => setSondages(d as Row[])).catch(() => {}).finally(() => setSondagesLoading(false)) }}
                style={{ marginTop: 12, padding: '6px 16px', fontSize: 12, background: DT.activeBlue, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >Réessayer</button>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={{ background: DT.headerBg, border: DT.cardBorder, borderRadius: 6, padding: '12px 16px' }}>
                  <div style={{ fontSize: 11, color: DT.headerColor, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Total sondages</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#1E293B' }}>{sondages.length}</div>
                </div>
                <div style={{ background: DT.headerBg, border: DT.cardBorder, borderRadius: 6, padding: '12px 16px' }}>
                  <div style={{ fontSize: 11, color: DT.headerColor, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Zones couvertes</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#1E293B' }}>{regionEntries.length}</div>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: DT.headerColor, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Distribution par région / commune</div>
                {regionEntries.map(([region, { total, haute }]) => (
                  <div key={region} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 120, fontSize: 12, color: DT.cellColor, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={region}>{region}</div>
                    <div style={{ flex: 1, background: '#F1F5F9', borderRadius: 4, height: 16, overflow: 'hidden', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${(total / maxSondages) * 100}%`, background: '#DBEAFE', borderRadius: 4 }} />
                      {haute > 0 && <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${(haute / maxSondages) * 100}%`, background: '#3B82F6', borderRadius: 4 }} />}
                    </div>
                    <div style={{ fontSize: 11, color: '#3B82F6', fontFamily: 'monospace', width: 28, textAlign: 'right', flexShrink: 0 }}>{total}</div>
                    {haute > 0 && <div style={{ fontSize: 10, color: '#22C55E', width: 44, textAlign: 'right', flexShrink: 0 }}>{((haute / total) * 100).toFixed(0)}% A/B</div>}
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 10 }}>
                <div style={{ fontSize: 11, color: DT.headerColor, marginBottom: 8, display: 'flex', gap: 12 }}>
                  <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#3B82F6', marginRight: 4 }} />Haute fiabilité (A/B)</span>
                  <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#DBEAFE', marginRight: 4 }} />Tous sondages</span>
                </div>
              </div>
              <DataTable
                columns={[
                  { key: 'code', label: 'Code sondage' },
                  { key: 'commune', label: 'Commune' },
                  { key: 'region', label: 'Région' },
                  { key: 'latitude', label: 'Lat.', align: 'right', render: (v) => v != null ? Number(v).toFixed(4) : <span style={{ color: DT.mutedDash }}>—</span> },
                  { key: 'longitude', label: 'Lon.', align: 'right', render: (v) => v != null ? Number(v).toFixed(4) : <span style={{ color: DT.mutedDash }}>—</span> },
                  { key: 'fiabilite', label: 'Fiab.', render: (v) => {
                    const s = String(v ?? '—')
                    const color = ['A', 'B', 'haute', 'good'].includes(s.toLowerCase()) ? '#166534' : s === 'C' ? '#854D0E' : DT.headerColor
                    const bg = ['A', 'B', 'haute', 'good'].includes(s.toLowerCase()) ? '#DCFCE7' : s === 'C' ? '#FEF9C3' : '#F1F5F9'
                    return <span style={{ background: bg, color, padding: '1px 6px', borderRadius: 3, fontSize: 11 }}>{s}</span>
                  }},
                ]}
                rows={sondages}
                maxRows={30}
              />
            </>
          )}
        </SectionCard>
      )}
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
   ONGLET PERFORMANCES
   Fusion : ex-Validation + LOO RMSE + Couverture + Matrice
   ═══════════════════════════════════════════════════════════ */
function PerformancesTab() {
  const [variograms, setVariograms] = useState<Row[]>([])
  const [runs, setRuns] = useState<Row[]>([])
  const [coverage, setCoverage] = useState<Row[]>([])
  const [familleFilter, setFamilleFilter] = useState('')
  const [showCoverageMap, setShowCoverageMap] = useState(false)
  const [mapParam, setMapParam] = useState<string>('vbs_avg')
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMapRef = useRef<any>(null)
  const coverageLayerRef = useRef<any>(null)
  const [section, setSection] = useSectionState('performances', 'loo')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [vRes, rRes, covRes] = await Promise.allSettled([
        tablesApi.getData('atlas', 'ai_variograms', 100, 0),
        tablesApi.getData('atlas', 'ai_interpolation_runs', 100, 0),
        api.get<any>('/api/stats/coverage'),
      ])
      if (!cancelled) {
        if (vRes.status === 'fulfilled') setVariograms(vRes.value as Row[])
        if (rRes.status === 'fulfilled') setRuns(rRes.value as Row[])
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
      leafletMapRef.current = L.map(mapRef.current, { center: [8.5, 1.0], zoom: 7, zoomControl: true })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM', maxZoom: 12 }).addTo(leafletMapRef.current)
    }
    if (coverageLayerRef.current) { leafletMapRef.current.removeLayer(coverageLayerRef.current); coverageLayerRef.current = null }
    try {
      const data = await api.get<any>(`/api/stats/coverage-map?parameter=${encodeURIComponent(param)}`)
      if (!data?.features?.length) return
      const layer = L.geoJSON(data, {
        style: (feature: any) => ({
          fillColor: feature.properties.status === 'interpolated' ? '#22C55E' : '#EF4444',
          fillOpacity: 0.5, color: feature.properties.status === 'interpolated' ? '#16A34A' : '#DC2626', weight: 0.5,
        }),
        onEachFeature: (feature: any, lyr: any) => { lyr.bindPopup(`<b>${feature.properties.code}</b><br/>Statut: ${feature.properties.status}`) },
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

  const METHODS = [
    { key: 'ked_hierarchical_5levels', label: 'KED-H' },
    { key: 'regression_kriging_scorpan', label: 'RK SCORPAN' },
    { key: 'ked_rk_fusion_bayesian', label: 'Fusion BLUP' },
    { key: 'mtgp_icm_gpflow', label: 'MTGP' },
    { key: 'sgs_gstools', label: 'SGS' },
  ]
  const matrixParams = [...new Set(runs.map(r => String(r.parameter_id ?? '')))].filter(Boolean).sort()
  const matrixByParam: Record<string, Record<string, string>> = {}
  for (const r of runs) {
    const pid = String(r.parameter_id ?? '')
    const m = String(r.method ?? '')
    if (!matrixByParam[pid]) matrixByParam[pid] = {}
    matrixByParam[pid][m] = String(r.status ?? 'unknown')
  }

  const blocRows = deduped.filter(r => r.block_cv_rmse != null && Number(r.block_cv_rmse) > 0 && r.loo_rmse != null && Number(r.loo_rmse) > 0)

  /* ─── Alertes scientifiques automatiques ─── */
  const sciAlerts = useMemo<SciAlert[]>(() => {
    const alerts: SciAlert[] = []
    // n < 30 : effectif insuffisant
    const smallN = deduped.filter(r => r.n_obs != null && Number(r.n_obs) > 0 && Number(r.n_obs) < 30)
    if (smallN.length > 0) {
      alerts.push({
        level: 'warning',
        message: `${smallN.length} paramètre(s) avec n < 30 observations`,
        detail: 'Résultats de kriging statistiquement non fiables — collecter davantage de données.',
      })
    }
    // LOO bias > 20% vs bloc-spatial
    if (blocRows.length > 0) {
      const avgBias = blocRows.reduce((s, r) => {
        const loo = Number(r.loo_rmse); const bloc = Number(r.block_cv_rmse)
        return s + ((loo - bloc) / bloc) * 100
      }, 0) / blocRows.length
      if (avgBias > 20) {
        alerts.push({
          level: 'critical',
          message: `Biais LOO-CV moyen : +${avgBias.toFixed(1)}% vs Bloc-Spatial`,
          detail: 'LOO-CV surestimé par autocorrélation spatiale (Roberts et al. 2017). Utiliser Bloc-Spatial pour reporter.',
        })
      } else if (avgBias > 10) {
        alerts.push({
          level: 'warning',
          message: `Biais LOO-CV modéré : +${avgBias.toFixed(1)}% vs Bloc-Spatial`,
          detail: 'Surveiller — le biais peut augmenter avec davantage de données.',
        })
      }
    }
    // Pipeline gaps : paramètres sans run
    const paramsWithRun = new Set(runs.map(r => String(r.parameter_id ?? '')))
    const paramsTotal = new Set(deduped.map(r => String(r.parameter_id ?? '')))
    const missing = [...paramsTotal].filter(p => !paramsWithRun.has(p))
    if (missing.length > 0) {
      alerts.push({
        level: 'info',
        message: `${missing.length} paramètre(s) sans run pipeline`,
        detail: `Exemples : ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}`,
      })
    }
    return alerts
  }, [deduped, blocRows, runs])

  const navItems: NavItem[] = [
    { id: 'loo', label: 'LOO-RMSE', badge: String(filtered.length) },
    { id: 'bloc', label: 'Bloc-Spatial', badge: String(blocRows.length) },
    { id: 'rmse_param', label: 'RMSE param.', badge: String(variograms.length) },
    { id: 'couverture', label: 'Couverture', badge: String(coverage.length) },
    { id: 'runs', label: 'Runs', badge: String(runs.length) },
    { id: 'matrice', label: 'Matrice', badge: String(matrixParams.length) },
  ]

  return (
    <SectionLayout nav={<SectionNav items={navItems} active={section} onChange={setSection} />}>

      <ScientificAlertBanner alerts={sciAlerts} />

      {section === 'loo' && (
        <SectionCard icon={CheckSquare} title="LOO-RMSE par paramètre et horizon" action={<ExportBtn rows={filtered} filename="loo_rmse.csv" />}>
          <div className="flex items-center gap-2 mb-2">
            <span style={{ fontSize: '11px', color: DT.headerColor }}>Famille :</span>
            <select value={familleFilter} onChange={e => setFamilleFilter(e.target.value)} style={{ fontSize: '12px', border: '1px solid #E2E8F0', borderRadius: '4px', padding: '2px 6px', color: DT.cellColor }}>
              <option value="">Toutes les familles</option>
              <option value="avg">Kriging global (avg)</option>
              <option value="ked">KED par horizon</option>
              <option value="derived">IP dérivé</option>
            </select>
            <span style={{ fontSize: '11px', color: DT.headerColor, marginLeft: 'auto' }}>{filtered.length} entrées</span>
          </div>
          <DataTable
            columns={[
              { key: 'parameter_id', label: 'Paramètre' },
              { key: 'horizon_display', label: 'Horizon', render: (_v, r) => extractHorizon(String(r.parameter_id)) },
              { key: 'model_type', label: 'Modèle' },
              { key: 'nugget', label: 'Nugget', align: 'right', render: (v) => fmtDash(v) },
              { key: 'sill', label: 'Sill', align: 'right', render: (v) => fmtDash(v) },
              { key: 'range_m', label: 'Portée (km)', align: 'right', render: (v) => v != null ? (Number(v) / 1000).toFixed(1) : <span style={{ color: DT.mutedDash }}>—</span> },
              { key: 'loo_rmse', label: 'LOO-CV', align: 'right', render: (v) => {
                if (v === null || v === undefined) return <span style={{ color: DT.mutedDash }}>—</span>
                const n = Number(v)
                if (!Number.isFinite(n) || n === 0) return <span style={{ color: DT.mutedDash }}>—</span>
                return <span style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}><span style={{ fontFamily: 'monospace', fontSize: 11, color: '#3B82F6', minWidth: 36, textAlign: 'right' }}>{n.toFixed(2)}</span><Databar value={n} maxVal={maxRmse} /></span>
              }},
              { key: 'block_cv_rmse', label: 'Bloc-Spatial', align: 'right', render: (v) => {
                if (v === null || v === undefined) return <span style={{ color: DT.mutedDash }}>—</span>
                const n = Number(v)
                if (!Number.isFinite(n) || n === 0) return <span style={{ color: DT.mutedDash }}>—</span>
                return <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#7C3AED' }}>{n.toFixed(2)}</span>
              }},
              { key: 'loo_rmse_qual', label: 'Qualité', render: (_v, r) => <QualityPill value={r.loo_rmse as number | null} sill={r.sill as number | null} /> },
            ]}
            rows={filtered}
            maxRows={50}
          />
          <p style={{ fontSize: '10px', color: DT.headerColor, marginTop: 8 }}>
            LOO-CV = Leave-One-Out (optimiste). Bloc-Spatial = erreur réelle sur blocs 100 km (Roberts et al. 2017). L'écart quantifie le biais d'autocorrélation spatiale (+10 à +38 %).
          </p>
        </SectionCard>
      )}

      {section === 'bloc' && (
        <SectionCard icon={Activity} title="LOO-CV vs Bloc-Spatial — Biais d'autocorrélation spatiale" action={<ExportBtn rows={blocRows} filename="biais_spatial.csv" />}>
          {blocRows.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: DT.headerColor, fontSize: 13 }}>
              <AlertCircle size={24} style={{ margin: '0 auto 8px', opacity: 0.25 }} />
              <div style={{ fontWeight: 600, color: '#1E293B', marginBottom: 4 }}>Aucune donnée Bloc-Spatial</div>
              <div style={{ fontSize: 12 }}>Renseigner <code style={{ background: '#F1F5F9', padding: '1px 5px', borderRadius: 3 }}>block_cv_rmse</code> dans <code style={{ background: '#F1F5F9', padding: '1px 5px', borderRadius: 3 }}>ai_variograms</code> pour activer cette vue</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                {(() => {
                  const avgBias = blocRows.reduce((s, r) => {
                    const loo = Number(r.loo_rmse); const bloc = Number(r.block_cv_rmse)
                    return s + ((loo - bloc) / bloc) * 100
                  }, 0) / blocRows.length
                  const maxBias = Math.max(...blocRows.map(r => ((Number(r.loo_rmse) - Number(r.block_cv_rmse)) / Number(r.block_cv_rmse)) * 100))
                  const pctOptimiste = blocRows.filter(r => Number(r.loo_rmse) < Number(r.block_cv_rmse)).length
                  return [
                    { label: 'Biais moyen', value: `+${avgBias.toFixed(1)}%`, sub: 'LOO-CV vs Bloc', color: avgBias > 20 ? '#DC2626' : '#F59E0B' },
                    { label: 'Biais max', value: `+${maxBias.toFixed(1)}%`, sub: 'cas le plus optimiste', color: '#EF4444' },
                    { label: 'Cas sous-estimés', value: `${blocRows.length - pctOptimiste}/${blocRows.length}`, sub: 'LOO-CV < Bloc-Spatial', color: '#7C3AED' },
                  ].map(({ label, value, sub, color }) => (
                    <div key={label} style={{ background: DT.headerBg, border: DT.cardBorder, borderRadius: 6, padding: '12px 16px' }}>
                      <div style={{ fontSize: 11, color: DT.headerColor, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
                      <div style={{ fontSize: 10, color: DT.headerColor, marginTop: 2 }}>{sub}</div>
                    </div>
                  ))
                })()}
              </div>
              <DataTable
                columns={[
                  { key: 'parameter_id', label: 'Paramètre' },
                  { key: 'horizon_display', label: 'Horizon', render: (_v, r) => extractHorizon(String(r.parameter_id)) },
                  { key: 'model_type', label: 'Modèle' },
                  { key: 'loo_rmse', label: 'LOO-CV', align: 'right', render: (v) => <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#3B82F6' }}>{Number(v).toFixed(3)}</span> },
                  { key: 'block_cv_rmse', label: 'Bloc-Spatial', align: 'right', render: (v) => <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#7C3AED' }}>{Number(v).toFixed(3)}</span> },
                  { key: 'biais_pct', label: 'Biais %', align: 'right', render: (_v, r) => {
                    const loo = Number(r.loo_rmse); const bloc = Number(r.block_cv_rmse)
                    const bias = ((loo - bloc) / bloc) * 100
                    const color = bias > 30 ? '#DC2626' : bias > 10 ? '#D97706' : '#16A34A'
                    const bg = bias > 30 ? '#FEE2E2' : bias > 10 ? '#FEF3C7' : '#DCFCE7'
                    return <span style={{ background: bg, color, padding: '2px 7px', borderRadius: 4, fontSize: 11, fontFamily: 'monospace', fontWeight: 600 }}>{bias > 0 ? '+' : ''}{bias.toFixed(1)}%</span>
                  }},
                  { key: 'interpretation', label: 'Interprétation', render: (_v, r) => {
                    const bias = ((Number(r.loo_rmse) - Number(r.block_cv_rmse)) / Number(r.block_cv_rmse)) * 100
                    if (bias > 30) return <span style={{ fontSize: 11, color: '#DC2626' }}>Forte sous-estimation LOO</span>
                    if (bias > 10) return <span style={{ fontSize: 11, color: '#D97706' }}>Biais modéré</span>
                    return <span style={{ fontSize: 11, color: '#16A34A' }}>Acceptable</span>
                  }},
                ]}
                rows={blocRows}
                maxRows={50}
              />
              <p style={{ fontSize: '10px', color: DT.headerColor, marginTop: 8 }}>
                Référence : Roberts et al. (2017) — LOO-CV sous-estime l'erreur de +10 à +38% en présence d'autocorrélation spatiale.
                La validation Bloc-Spatial est l'estimateur non-biaisé de l'erreur de généralisation géographique.
              </p>
            </>
          )}
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
              { key: 'loo_rmse', label: 'LOO-CV', align: 'right', render: (v) => {
                if (v === null || v === undefined) return <span style={{ color: DT.mutedDash }}>—</span>
                const n = Number(v)
                if (!Number.isFinite(n) || n === 0) return <span style={{ color: DT.mutedDash }}>—</span>
                return <Databar value={n} maxVal={maxRmse} />
              }},
              { key: 'block_cv_rmse', label: 'Bloc-Spatial', align: 'right', render: (v) => {
                if (v === null || v === undefined) return <span style={{ color: DT.mutedDash }}>—</span>
                const n = Number(v)
                if (!Number.isFinite(n) || n === 0) return <span style={{ color: DT.mutedDash }}>—</span>
                return <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#7C3AED' }}>{n.toFixed(2)}</span>
              }},
              { key: 'loo_rmse_qual', label: 'Qualité', render: (_v, r) => <QualityPill value={r.loo_rmse as number | null} sill={r.sill as number | null} /> },
            ]}
            rows={variograms}
            maxRows={30}
          />
        </SectionCard>
      )}

      {section === 'couverture' && (
        <SectionCard icon={Layers} title="Couverture d'interpolation" action={<ExportBtn rows={coverage} filename="coverage.csv" />}>
          <DataTable
            columns={[
              { key: 'parameter_id', label: 'Paramètre' },
              { key: 'method', label: 'Méthode' },
              { key: 'n_mailles', label: 'Mailles', align: 'right', render: (v) => fmtDash(v) },
              { key: 'coverage_pct', label: 'Couverture %', align: 'right', render: (v) => v != null ? <span style={{ color: Number(v) >= 90 ? '#22C55E' : Number(v) >= 50 ? '#EAB308' : '#EF4444' }}>{Number(v).toFixed(1)}%</span> : <span style={{ color: DT.mutedDash }}>—</span> },
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
                <select value={mapParam} onChange={e => setMapParam(e.target.value)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: '1px solid #E2E8F0', background: DT.headerBg, color: DT.cellColor }}>
                  {coverage.map((c: any) => (<option key={String(c.parameter_id)} value={String(c.parameter_id)}>{String(c.parameter_id)} ({Number(c.coverage_pct ?? 0).toFixed(0)}%)</option>))}
                </select>
                <button
                  onClick={() => { const next = !showCoverageMap; setShowCoverageMap(next); if (next) setTimeout(() => loadCoverageMap(mapParam), 100) }}
                  style={{ padding: '4px 12px', borderRadius: 4, fontSize: 11, border: '1px solid #E2E8F0', background: showCoverageMap ? DT.activeBlue : 'transparent', color: showCoverageMap ? '#fff' : DT.headerColor, cursor: 'pointer' }}
                >
                  {showCoverageMap ? 'Masquer carte' : 'Voir carte'}
                </button>
              </div>
            </div>
            {showCoverageMap && (
              <div style={{ position: 'relative' }}>
                <div ref={mapRef} style={{ height: 350, borderRadius: 8, border: '1px solid #E2E8F0', overflow: 'hidden' }} />
                <div style={{ position: 'absolute', bottom: 8, right: 8, zIndex: 1000, background: 'rgba(15,23,42,0.85)', padding: '6px 10px', borderRadius: 4, fontSize: 11, color: '#F8FAFC' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 2, background: '#22C55E', display: 'block' }} />Interpolé</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}><span style={{ width: 12, height: 12, borderRadius: 2, background: '#EF4444', display: 'block' }} />Manquant</div>
                </div>
              </div>
            )}
            {showCoverageMap && <p style={{ fontSize: 10, color: DT.headerColor, marginTop: 4 }}>Vert = mailles interpolées • Rouge = mailles sans données • Cliquer une maille pour les détails</p>}
          </div>
        </SectionCard>
      )}

      {section === 'runs' && (
        <SectionCard icon={Layers} title="Runs d'interpolation" action={<ExportBtn rows={runs} filename="runs.csv" />}>
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

      {section === 'matrice' && (
        <SectionCard icon={Grid3x3} title="Matrice statuts — Paramètre × Méthode" action={<ExportBtn rows={runs} filename="statuts_matrice.csv" />}>
          <div style={{ marginBottom: 8, fontSize: 11, color: DT.headerColor }}>
            Légende :&nbsp;
            <span style={{ background: '#DCFCE7', color: '#166534', padding: '1px 6px', borderRadius: 3, marginRight: 4 }}>✓ calculé</span>
            <span style={{ background: '#DBEAFE', color: '#1D4ED8', padding: '1px 6px', borderRadius: 3, marginRight: 4 }}>⏳ en queue</span>
            <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '1px 6px', borderRadius: 3, marginRight: 4 }}>✗ échec</span>
            <span style={{ background: '#F1F5F9', color: '#94A3B8', padding: '1px 6px', borderRadius: 3 }}>— absent</span>
          </div>
          {matrixParams.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: DT.headerColor, fontSize: 13 }}>
              <AlertCircle size={20} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              <div>Aucun run trouvé — lancez un calcul depuis l'onglet Registre ML</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table style={{ width: '100%', fontSize: DT.cellFontSize, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #CBD5E1' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: DT.headerFontSize, textTransform: 'uppercase', letterSpacing: '0.05em', color: DT.headerColor, background: DT.headerBg, whiteSpace: 'nowrap' }}>Paramètre</th>
                    {METHODS.map(m => (
                      <th key={m.key} style={{ padding: '10px 8px', textAlign: 'center', fontSize: DT.headerFontSize, textTransform: 'uppercase', letterSpacing: '0.05em', color: DT.headerColor, background: DT.headerBg, whiteSpace: 'nowrap' }}>{m.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixParams.map(pid => (
                    <tr key={pid} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '8px 16px' }}>
                        <code style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>{pid}</code>
                      </td>
                      {METHODS.map(m => {
                        const status = matrixByParam[pid]?.[m.key]
                        if (!status) return <td key={m.key} style={{ padding: '8px', textAlign: 'center' }}><span style={{ color: '#CBD5E1', fontSize: 11 }}>—</span></td>
                        if (status === 'finished') return <td key={m.key} style={{ padding: '8px', textAlign: 'center' }}><span style={{ background: '#DCFCE7', color: '#166534', padding: '2px 6px', borderRadius: 3, fontSize: 10 }}>✓</span></td>
                        if (status === 'queued' || status === 'running') return <td key={m.key} style={{ padding: '8px', textAlign: 'center' }}><span style={{ background: '#DBEAFE', color: '#1D4ED8', padding: '2px 6px', borderRadius: 3, fontSize: 10 }}>⏳</span></td>
                        if (status === 'failed') return <td key={m.key} style={{ padding: '8px', textAlign: 'center' }}><span style={{ background: '#FEE2E2', color: '#991B1B', padding: '2px 6px', borderRadius: 3, fontSize: 10 }}>✗</span></td>
                        return <td key={m.key} style={{ padding: '8px', textAlign: 'center' }}><span style={{ color: DT.mutedDash, fontSize: 11 }}>{status}</span></td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

interface LaunchForm { method: string; parameter_id: string; horizon: string; force_recompute: boolean; debug_mode: boolean }

function MLTab() {
  const [pipelineModels, setPipelineModels] = useState<PipelineModel[]>([])
  const [supervisedModels, setSupervisedModels] = useState<Row[]>([])
  const [loadingPipeline, setLoadingPipeline] = useState(true)
  const [jobStates, setJobStates] = useState<Record<string, JobState>>({})
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [section, setSection] = useSectionState('ml', 'pipeline')
  const [jobQueue, setJobQueue] = useState<Row[]>([])
  const [paramCatalog, setParamCatalog] = useState<Row[]>([])
  const [isLaunching, setIsLaunching] = useState(false)
  const [launchMsg, setLaunchMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [launchParam, setLaunchParam] = useState('vbs')
  const [launchHorizon, setLaunchHorizon] = useState('H1')
  const [launchForm, setLaunchForm] = useState<LaunchForm>({
    method: 'ked_hierarchical_5levels',
    parameter_id: 'vbs_h1',
    horizon: 'H1',
    force_recompute: false,
    debug_mode: false,
  })
  // Synchronise parameter_id quand param ou horizon change
  useEffect(() => {
    const pid = launchHorizon === 'all' ? `${launchParam}_avg` : `${launchParam}_${launchHorizon.toLowerCase()}`
    setLaunchForm(f => ({ ...f, parameter_id: pid, horizon: launchHorizon === 'all' ? 'Tous' : launchHorizon }))
  }, [launchParam, launchHorizon])

  /* getHeaders remplacé par getAuthHeaders() module-level */

  const refreshPipeline = useCallback(async () => {
    try {
      const resp = await fetch('/api/ai/models/status', { headers: getAuthHeaders() })
      if (resp.ok) {
        const data = await resp.json()
        setPipelineModels(data.models ?? [])
      }
    } catch { /* ok */ }
  }, [])

  const pollJob = useCallback((modelId: string, jobId: string) => {
    const check = async () => {
      try {
        const resp = await fetch(`/api/ai/jobs/${jobId}`, { headers: getAuthHeaders() })
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
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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

  const refreshQueue = useCallback(async () => {
    try {
      const data = await tablesApi.getData('atlas', 'ai_job_queue', 50, 0)
      setJobQueue(data as Row[])
    } catch { /* ok */ }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingPipeline(true)
      try {
        const [pRes, mlRes, catRes] = await Promise.allSettled([
          fetch('/api/ai/models/status', { headers: getAuthHeaders() }).then(r => r.json()),
          api.get<any>('/api/stats/ml-registry'),
          tablesApi.getData('atlas', 'ai_parameter_catalog', 200, 0),
        ])
        if (!cancelled) {
          if (pRes.status === 'fulfilled') setPipelineModels(pRes.value.models ?? [])
          if (mlRes.status === 'fulfilled') setSupervisedModels((mlRes.value?.items ?? []) as Row[])
          if (catRes.status === 'fulfilled') setParamCatalog(catRes.value as Row[])
        }
      } catch { /* ok */ }
      finally { if (!cancelled) setLoadingPipeline(false) }
    })()
    refreshQueue()
    return () => { cancelled = true }
  }, [refreshQueue])

  useEffect(() => {
    const id = window.setInterval(() => {
      setJobQueue(prev => {
        const hasActive = prev.some(j => ['queued', 'running'].includes(String(j.status ?? '')))
        if (hasActive) refreshQueue()
        return prev
      })
    }, 5000)
    return () => window.clearInterval(id)
  }, [refreshQueue])

  const handleLaunch = useCallback(async () => {
    setIsLaunching(true)
    setLaunchMsg(null)
    try {
      const resp = await fetch('/api/ai/jobs/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          job_type: launchForm.method,
          parameter_id: launchForm.parameter_id,
          horizon: launchForm.horizon === 'Tous' ? null : launchForm.horizon,
          force_recompute: launchForm.force_recompute,
          debug_mode: launchForm.debug_mode,
          requested_by: 'expert-panel',
        }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }))
        throw new Error(err.error ?? `HTTP ${resp.status}`)
      }
      const data = await resp.json()
      setLaunchMsg({ type: 'ok', text: `Job enqueued — ID: ${data.job_id ?? '?'}` })
      setTimeout(() => refreshQueue(), 1000)
    } catch (e) {
      setLaunchMsg({ type: 'err', text: String(e) })
    } finally {
      setIsLaunching(false)
    }
  }, [launchForm, refreshQueue])

  const statusBadgeNode = (status: string) => {
    if (status === 'ready') return <Badge style={{ background: '#DCFCE7', color: '#166534', border: 'none', fontSize: '11px' }}><span style={{ color: '#22C55E', marginRight: 4 }}>●</span>Prêt</Badge>
    if (status === 'partial') return <Badge style={{ background: '#FEF9C3', color: '#854D0E', border: 'none', fontSize: '11px' }}><span style={{ color: '#EAB308', marginRight: 4 }}>●</span>Partiel</Badge>
    if (status === 'running') return <Badge style={{ background: '#DBEAFE', color: '#1E40AF', border: 'none', fontSize: '11px' }}><span style={{ color: '#3B82F6', marginRight: 4 }}>●</span>En cours</Badge>
    return <Badge style={{ background: '#F1F5F9', color: '#475569', border: 'none', fontSize: '11px' }}><span style={{ color: '#94A3B8', marginRight: 4 }}>●</span>Non calculé</Badge>
  }

  const queueRunning = jobQueue.filter(j => ['queued', 'running'].includes(String(j.status ?? ''))).length

  const navItems: NavItem[] = [
    { id: 'pipeline', label: 'Pipeline L1-L5', badge: String(pipelineModels.length) },
    { id: 'lancer', label: 'Lancer un calcul' },
    { id: 'queue', label: 'Queue IA', badge: queueRunning > 0 ? `${queueRunning} actif` : String(jobQueue.length) },
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

      {section === 'lancer' && (
        <SectionCard icon={Play} title="Lancer un calcul ML paramétré">
          <div style={{ maxWidth: 520 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: DT.headerColor, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Méthode</label>
                <select
                  value={launchForm.method}
                  onChange={e => setLaunchForm(p => ({ ...p, method: e.target.value }))}
                  style={{ width: '100%', fontSize: 12, padding: '6px 10px', borderRadius: 4, border: '1px solid #E2E8F0', background: DT.cardBg, color: DT.cellColor }}
                >
                  <option value="ked_hierarchical_5levels">L1 — KED Hiérarchique (KED-H)</option>
                  <option value="regression_kriging_scorpan">L2a — RK SCORPAN</option>
                  <option value="ked_rk_fusion_bayesian">L2b — Fusion BLUP</option>
                  <option value="mtgp_icm_gpflow">L4 — MTGP ICM</option>
                  <option value="sgs_gstools">L5 — SGS gstools</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: DT.headerColor, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>
                  Paramètre géotechnique
                </label>
                <select
                  value={launchParam}
                  onChange={e => setLaunchParam(e.target.value)}
                  style={{ width: '100%', fontSize: 12, padding: '6px 10px', borderRadius: 4, border: '1px solid #E2E8F0', background: DT.cardBg, color: DT.cellColor }}
                >
                  {BASE_PARAMS.map(p => (
                    <option key={p.id} value={p.id}>{p.label} ({p.unit})</option>
                  ))}
                </select>
                <div style={{ fontSize: 10, color: DT.headerColor, marginTop: 3 }}>
                  ID généré : <code style={{ background: '#F1F5F9', padding: '1px 4px', borderRadius: 3 }}>{launchForm.parameter_id}</code>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: DT.headerColor, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>
                  Horizon de profondeur
                </label>
                <select
                  value={launchHorizon}
                  onChange={e => setLaunchHorizon(e.target.value)}
                  style={{ width: '100%', fontSize: 12, padding: '6px 10px', borderRadius: 4, border: '1px solid #E2E8F0', background: DT.cardBg, color: DT.cellColor }}
                >
                  {HORIZONS.map(h => (
                    <option key={h.id} value={h.id}>{h.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'flex-end', paddingBottom: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: DT.cellColor }}>
                  <input type="checkbox" checked={launchForm.force_recompute} onChange={e => setLaunchForm(p => ({ ...p, force_recompute: e.target.checked }))} />
                  Force recalcul (ignorer cache)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: DT.cellColor }}>
                  <input type="checkbox" checked={launchForm.debug_mode} onChange={e => setLaunchForm(p => ({ ...p, debug_mode: e.target.checked }))} />
                  Mode debug (logs détaillés)
                </label>
              </div>
            </div>
            <div style={{ background: DT.headerBg, border: DT.cardBorder, borderRadius: 6, padding: '10px 14px', marginBottom: 12, fontSize: 11, color: DT.headerColor }}>
              <strong style={{ color: DT.cellColor }}>Récapitulatif :</strong>{' '}
              <code style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '1px 5px', borderRadius: 3 }}>{launchForm.method}</code>{' '}
              sur <code style={{ background: '#F3E8FF', color: '#7C3AED', padding: '1px 5px', borderRadius: 3 }}>{launchForm.parameter_id}</code>{' '}
              horizon <strong>{launchForm.horizon}</strong>
              {launchForm.force_recompute && <span style={{ color: '#D97706', marginLeft: 6 }}>• Force recalcul</span>}
              {launchForm.debug_mode && <span style={{ color: '#7C3AED', marginLeft: 6 }}>• Debug</span>}
            </div>
            <button
              disabled={isLaunching}
              onClick={handleLaunch}
              className="flex items-center gap-2 text-white rounded font-medium text-sm px-4 py-2 disabled:opacity-50"
              style={{ background: isLaunching ? '#94A3B8' : '#1E293B', border: 'none', cursor: isLaunching ? 'not-allowed' : 'pointer' }}
            >
              {isLaunching ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {isLaunching ? 'Envoi en queue…' : 'Envoyer en queue'}
            </button>
            {launchMsg && (
              <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 4, fontSize: 12, background: launchMsg.type === 'ok' ? '#DCFCE7' : '#FEE2E2', color: launchMsg.type === 'ok' ? '#166534' : '#991B1B', border: `1px solid ${launchMsg.type === 'ok' ? '#86EFAC' : '#FCA5A5'}` }}>
                {launchMsg.type === 'ok' ? '✓ ' : '✗ '}{launchMsg.text}
              </div>
            )}
            <p style={{ marginTop: 10, fontSize: 10, color: DT.headerColor }}>
              KED ~5 min • RK ~5 min • BLUP ~1 min • MTGP ~60 min • SGS ~30 min — suivre dans l'onglet Queue IA
            </p>
          </div>
        </SectionCard>
      )}

      {section === 'queue' && (
        <SectionCard icon={Clock} title="Queue IA — ai_job_queue en temps réel"
          action={
            <button onClick={refreshQueue} className="flex items-center gap-1 text-xs" style={{ color: DT.headerColor, background: 'none', border: 'none', cursor: 'pointer' }}>
              <RefreshCw size={12} strokeWidth={1.5} /> Rafraîchir
            </button>
          }
        >
          {queueRunning > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '6px 10px', borderRadius: 4, background: '#DBEAFE', border: '1px solid #93C5FD', fontSize: 12, color: '#1D4ED8' }}>
              <Loader2 size={12} className="animate-spin" />
              {queueRunning} job{queueRunning > 1 ? 's' : ''} en cours — rafraîchissement auto toutes les 5 s
            </div>
          )}
          <DataTable
            columns={[
              { key: 'id', label: 'ID', render: (v) => <code style={{ fontSize: 10, background: '#F1F5F9', padding: '1px 5px', borderRadius: 3 }}>{String(v ?? '').slice(0, 8)}</code> },
              { key: 'job_type', label: 'Type', render: (v) => <code style={{ fontSize: 11, background: '#EFF6FF', color: '#1D4ED8', padding: '1px 5px', borderRadius: 3 }}>{String(v ?? '')}</code> },
              { key: 'parameter_id', label: 'Paramètre' },
              { key: 'status', label: 'Statut', render: (v) => <StatusPill status={String(v ?? '')} /> },
              { key: 'requested_at', label: 'Demandé', render: (v) => v ? <span style={{ fontSize: 11 }}>{new Date(String(v)).toLocaleString('fr-FR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span> : <span style={{ color: DT.mutedDash }}>—</span> },
              { key: 'finished_at', label: 'Terminé', render: (v) => v ? <span style={{ fontSize: 11 }}>{new Date(String(v)).toLocaleString('fr-FR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span> : <span style={{ color: DT.mutedDash }}>—</span> },
              { key: 'error_message', label: 'Erreur', render: (v) => v ? <span style={{ color: '#DC2626', fontSize: 10 }} title={String(v)}>{String(v).slice(0, 40)}{String(v).length > 40 ? '…' : ''}</span> : <span style={{ color: DT.mutedDash }}>—</span> },
            ]}
            rows={jobQueue}
            maxRows={50}
          />
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
  const [correlations, setCorrelations] = useState<{ params: string[]; matrix: number[][] } | null>(null)
  const [section, setSection] = useSectionState('comparaison', 'methodes')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [vData, rData, corData] = await Promise.allSettled([
          tablesApi.getData('atlas', 'ai_variograms', 100, 0),
          tablesApi.getData('atlas', 'ai_interpolation_runs', 100, 0),
          api.get<any>('/api/stats/parameter-correlations'),
        ])
        if (!cancelled) {
          if (vData.status === 'fulfilled') setVariograms(vData.value as Row[])
          if (rData.status === 'fulfilled') setRuns(rData.value as Row[])
          if (corData.status === 'fulfilled' && corData.value?.params) setCorrelations(corData.value as { params: string[]; matrix: number[][] })
        }
      } catch { /* ok */ }
    })()
    return () => { cancelled = true }
  }, [])

  const maxRmse = Math.max(...variograms.map(v => Number(v.loo_rmse ?? 0)), 0.01)

  const navItems: NavItem[] = [
    { id: 'methodes', label: 'Méthodes', badge: String(variograms.length) },
    { id: 'comparaison', label: 'Comparatif', badge: String(runs.length) },
    { id: 'correlations', label: 'Corrélations' },
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
      {section === 'correlations' && (
        <SectionCard icon={GitCompare} title="Heatmap de corrélations inter-paramètres géotechniques">
          {!correlations ? (
            <div style={{ padding: '32px', textAlign: 'center', color: DT.headerColor, fontSize: 13 }}>
              <BarChart2 size={28} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
              <div style={{ fontWeight: 600, color: '#1E293B', marginBottom: 6 }}>Endpoint non disponible</div>
              <div style={{ fontSize: 12, maxWidth: 360, margin: '0 auto', lineHeight: 1.6 }}>
                L'endpoint <code style={{ background: '#F1F5F9', padding: '1px 5px', borderRadius: 3 }}>/api/stats/parameter-correlations</code> doit retourner
                un objet <code style={{ background: '#F1F5F9', padding: '1px 5px', borderRadius: 3 }}>{'{ params: string[], matrix: number[][] }'}</code> calculé
                à partir des mesures terrain de <code style={{ background: '#F1F5F9', padding: '1px 5px', borderRadius: 3 }}>atlas.tests_geotechniques</code>.
              </div>
              <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 6, background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: 11, color: DT.headerColor, textAlign: 'left', display: 'inline-block' }}>
                Corrélations attendues (littérature) :<br />
                IP ↔ VBS : r ≈ 0.82 (activité argileuse)<br />
                VBS ↔ CBR : r ≈ -0.71 (résistance inverse à plasticité)<br />
                WL ↔ IP : r ≈ 0.91 (lien Atterberg)<br />
                CG ↔ IP : r ≈ 0.68 (teneur argile)
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 10, display: 'flex', gap: 12, fontSize: 11, color: DT.headerColor, flexWrap: 'wrap' }}>
                {[
                  { label: 'Forte +', bg: '#15803D', color: '#fff', range: 'r > 0.7' },
                  { label: 'Modérée +', bg: '#86EFAC', color: '#166534', range: '0.3–0.7' },
                  { label: 'Faible', bg: '#F1F5F9', color: '#64748B', range: '-0.3–0.3' },
                  { label: 'Modérée −', bg: '#FCA5A5', color: '#991B1B', range: '-0.7–-0.3' },
                  { label: 'Forte −', bg: '#DC2626', color: '#fff', range: 'r < -0.7' },
                ].map(({ label, bg, color, range }) => (
                  <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 14, height: 14, borderRadius: 3, background: bg, display: 'inline-block' }} />
                    <span style={{ color }}>{label}</span>
                    <span style={{ color: DT.mutedDash }}>({range})</span>
                  </span>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 80, padding: '6px 8px', background: DT.headerBg, color: DT.headerColor, fontSize: 10, textTransform: 'uppercase' }} />
                      {correlations.params.map(p => (
                        <th key={p} style={{ padding: '6px 8px', background: DT.headerBg, color: DT.headerColor, fontSize: 10, textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'nowrap' }}>{p}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {correlations.params.map((rowParam, i) => (
                      <tr key={rowParam}>
                        <td style={{ padding: '6px 8px', fontWeight: 600, color: DT.cellColor, fontSize: 11, whiteSpace: 'nowrap', background: DT.headerBg }}>{rowParam}</td>
                        {correlations.matrix[i].map((r, j) => {
                          const isdiag = i === j
                          const bg = isdiag ? '#1D4ED8' : r > 0.7 ? '#15803D' : r > 0.3 ? '#86EFAC' : r > -0.3 ? '#F1F5F9' : r > -0.7 ? '#FCA5A5' : '#DC2626'
                          const textColor = isdiag || r > 0.7 || r < -0.7 ? '#fff' : r > 0.3 ? '#166534' : r < -0.3 ? '#991B1B' : '#475569'
                          return (
                            <td key={j} title={`${rowParam} ↔ ${correlations.params[j]} : r = ${r.toFixed(3)}`}
                              style={{ padding: '6px 10px', textAlign: 'center', background: bg, color: textColor, fontFamily: 'monospace', cursor: 'default', borderRadius: 2 }}>
                              {isdiag ? '1.00' : r.toFixed(2)}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 10, color: DT.headerColor, marginTop: 8 }}>
                Coefficients de Pearson calculés sur l'ensemble des sondages AMESSEFE. Survol d'une cellule = valeur exacte.
              </p>
            </>
          )}
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
          <TabsTrigger value="donnees" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-3 py-2 text-sm" style={{ color: DT.headerColor }}><Table2 size={16} strokeWidth={1.5} className="mr-1.5 inline" /> Données</TabsTrigger>
          <TabsTrigger value="eda" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-3 py-2 text-sm" style={{ color: DT.headerColor }}><BarChart2 size={16} strokeWidth={1.5} className="mr-1.5 inline" /> EDA</TabsTrigger>
          <TabsTrigger value="variogrammes" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-3 py-2 text-sm" style={{ color: DT.headerColor }}><Activity size={16} strokeWidth={1.5} className="mr-1.5 inline" /> Variogrammes</TabsTrigger>
          <TabsTrigger value="performances" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-3 py-2 text-sm" style={{ color: DT.headerColor }}><CheckSquare size={16} strokeWidth={1.5} className="mr-1.5 inline" /> Performances</TabsTrigger>
          <TabsTrigger value="ml" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-3 py-2 text-sm" style={{ color: DT.headerColor }}><Brain size={16} strokeWidth={1.5} className="mr-1.5 inline" /> Registre ML</TabsTrigger>
          <TabsTrigger value="comparaison" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-3 py-2 text-sm" style={{ color: DT.headerColor }}><GitCompare size={16} strokeWidth={1.5} className="mr-1.5 inline" /> Comparaison</TabsTrigger>
          <TabsTrigger value="systeme" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-3 py-2 text-sm" style={{ color: DT.headerColor }}><Server size={16} strokeWidth={1.5} className="mr-1.5 inline" /> Système</TabsTrigger>
        </TabsList>
        <TabsContent value="donnees"><DonneesBrutesTab catalog={catalog} jobs={jobs} plotCache={plotCache} /></TabsContent>
        <TabsContent value="eda"><EdaTab /></TabsContent>
        <TabsContent value="variogrammes"><VariogrammesTab /></TabsContent>
        <TabsContent value="performances"><PerformancesTab /></TabsContent>
        <TabsContent value="ml"><MLTab /></TabsContent>
        <TabsContent value="comparaison"><ComparaisonTab /></TabsContent>
        <TabsContent value="systeme"><SystemeTab catalog={catalog} jobs={jobs} plotCache={plotCache} plotCacheCount={plotCacheCount} onRefresh={loadData} /></TabsContent>
      </Tabs>
    </div>
  )
}
