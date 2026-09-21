import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowLeft, Beaker, CheckCircle2, ChevronDown, ChevronUp,
  FlaskConical, Gauge, Layers3, Plus, Ruler, Save, TestTube2, Trash2, Waves,
} from 'lucide-react';
import {
  labResultsApi, LabResultInput, LabResultRecord, LinkedSondage,
} from '../../services/colab-api';
import { qualityWarnings } from './lab-quality';

type JsonMap = Record<string, any>;
type FormState = LabResultInput & { id?: string };

const inputClass = 'block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

const TESTS = [
  { id: 'atterberg', label: 'Atterberg', icon: Ruler },
  { id: 'vbs', label: 'VBS', icon: TestTube2 },
  { id: 'gonflement', label: 'Gonflement EG', icon: Waves },
  { id: 'proctor', label: 'Proctor', icon: Gauge },
  { id: 'cbr', label: 'CBR', icon: Gauge },
  { id: 'penetrometre', label: 'Pénétromètre', icon: Ruler },
  { id: 'pressiometre', label: 'Pressiomètre', icon: Gauge },
  { id: 'granulometrie', label: 'Granulométrie', icon: Layers3 },
  { id: 'classification', label: 'Classification', icon: Beaker },
] as const;

function asNumber(value: string): number | undefined {
  return value === '' ? undefined : Number(value);
}

function newForm(sondages: LinkedSondage[]): FormState {
  const first = sondages[0];
  return {
    sondage_id: first?.sondage_id ?? '', sample_code: first?.sondage_code ? `${first.sondage_code}-ECH-01` : '',
    depth_top_m: 0, depth_bottom_m: 1, sample: { remanie: 'non' }, tests: {}, status: 'draft',
  };
}

const Field: React.FC<{ label: string; unit?: string; children: React.ReactNode }> = ({ label, unit, children }) => (
  <label className="block">
    <span className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600">{label}{unit && <span className="font-normal text-slate-400">({unit})</span>}</span>
    {children}
  </label>
);

export const LabResultsPanel: React.FC<{ missionId: string; sondages: LinkedSondage[] }> = ({ missionId, sondages }) => {
  const [items, setItems] = useState<LabResultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try { setItems((await labResultsApi.list(missionId)).items); }
    catch (e) { setError(e instanceof Error ? e.message : 'Chargement impossible'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [missionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const warnings = useMemo(() => form ? qualityWarnings(form) : [], [form]);
  const midpoint = form ? Math.round(((form.depth_top_m + form.depth_bottom_m) / 2) * 100) / 100 : 0;
  const horizon = midpoint < 1 ? 'H1 (0-1 m)' : midpoint < 1.5 ? 'H2 (1-1,5 m)' : 'H3 (>1,5 m)';

  const setSample = (key: string, value: unknown) => setForm(prev => prev ? ({ ...prev, sample: { ...prev.sample, [key]: value } }) : prev);
  const setTest = (section: string, key: string, value: unknown) => setForm(prev => prev ? ({ ...prev, tests: { ...prev.tests, [section]: { ...(prev.tests[section] as JsonMap ?? {}), [key]: value } } }) : prev);
  const toggleTest = (id: string) => setForm(prev => {
    if (!prev) return prev;
    const tests = { ...prev.tests };
    if (id in tests) { delete tests[id]; if (expanded === id) setExpanded(null); }
    else { tests[id] = id === 'granulometrie' ? { points: [{ sieve_mm: 0.08, passant_pct: undefined }] } : {}; setExpanded(id); }
    return { ...prev, tests };
  });

  const save = async (status: 'draft' | 'complete') => {
    if (!form) return;
    const blocking = qualityWarnings(form);
    if (status === 'complete' && blocking.length) { setError('Corrigez les contrôles signalés avant de marquer la fiche comme terminée.'); return; }
    if (!form.sondage_id || !form.sample_code.trim() || form.depth_bottom_m <= form.depth_top_m) { setError('Complétez le sondage, le code échantillon et les profondeurs.'); return; }
    setSaving(true); setError(null);
    try {
      const payload = { ...form, status };
      if (form.id) await labResultsApi.update(missionId, form.id, payload);
      else await labResultsApi.create(missionId, payload);
      setForm(null); setExpanded(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Enregistrement impossible'); }
    finally { setSaving(false); }
  };

  if (form) {
    const t = form.tests as JsonMap;
    const numberInput = (section: string, key: string, value: unknown, min?: number, max?: number, step = '0.1') => (
      <input className={inputClass} type="number" value={value as number ?? ''} min={min} max={max} step={step} onChange={e => setTest(section, key, asNumber(e.target.value))} />
    );
    return <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => { setForm(null); setExpanded(null); }} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"><ArrowLeft className="h-4 w-4" />Retour aux fiches</button>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">Profondeur médiane {midpoint} m · {horizon}</span>
      </div>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex items-center gap-2"><FlaskConical className="h-4 w-4 text-blue-600" /><h3 className="font-medium text-slate-900">Échantillon</h3></div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Sondage lié"><select className={inputClass} value={form.sondage_id} onChange={e => setForm({ ...form, sondage_id: e.target.value })}><option value="">Sélectionner</option>{sondages.map(s => <option key={s.sondage_id} value={s.sondage_id}>{s.sondage_code || s.sondage_id}</option>)}</select></Field>
          <Field label="Code échantillon"><input className={inputClass} value={form.sample_code} onChange={e => setForm({ ...form, sample_code: e.target.value })} /></Field>
          <Field label="Date de prélèvement"><input className={inputClass} type="date" value={String(form.sample.date_prelevement ?? '')} onChange={e => setSample('date_prelevement', e.target.value)} /></Field>
          <Field label="Profondeur haute" unit="m"><input className={inputClass} type="number" min={0} step="0.01" value={form.depth_top_m} onChange={e => setForm({ ...form, depth_top_m: Number(e.target.value) })} /></Field>
          <Field label="Profondeur basse" unit="m"><input className={inputClass} type="number" min={0} step="0.01" value={form.depth_bottom_m} onChange={e => setForm({ ...form, depth_bottom_m: Number(e.target.value) })} /></Field>
          <Field label="Laboratoire"><input className={inputClass} value={String(form.sample.laboratoire_essai ?? '')} onChange={e => setSample('laboratoire_essai', e.target.value)} /></Field>
          <Field label="Nature du sol"><input className={inputClass} value={String(form.sample.nature_sol ?? '')} onChange={e => setSample('nature_sol', e.target.value)} /></Field>
          <Field label="Échantillon remanié"><select className={inputClass} value={String(form.sample.remanie ?? 'non')} onChange={e => setSample('remanie', e.target.value)}><option value="non">Non</option><option value="oui">Oui</option></select></Field>
          <Field label="Commentaire"><input className={inputClass} value={String(form.sample.commentaire ?? '')} onChange={e => setSample('commentaire', e.target.value)} /></Field>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 p-4">
        <div className="mb-3"><h3 className="font-medium text-slate-900">Essais réalisés</h3><p className="text-xs text-slate-500">Activez uniquement les essais présents sur la fiche du laboratoire.</p></div>
        <div className="flex flex-wrap gap-2">{TESTS.map(def => { const active = def.id in form.tests; const Icon = def.icon; return <button key={def.id} type="button" onClick={() => toggleTest(def.id)} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}><Icon className="h-4 w-4" />{def.label}{active && <CheckCircle2 className="h-3.5 w-3.5" />}</button>; })}</div>
      </section>

      <div className="space-y-2">{TESTS.filter(def => def.id in form.tests).map(def => { const open = expanded === def.id; const Icon = def.icon; return <section key={def.id} className="overflow-hidden rounded-xl border border-slate-200">
        <button type="button" onClick={() => setExpanded(open ? null : def.id)} className="flex w-full items-center gap-2 bg-white px-4 py-3 text-left"><Icon className="h-4 w-4 text-blue-600" /><span className="flex-1 text-sm font-medium text-slate-900">{def.label}</span>{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
        {open && <div className="grid grid-cols-1 gap-3 border-t border-slate-100 bg-slate-50 p-4 md:grid-cols-3">
          {def.id === 'atterberg' && <><Field label="WL" unit="%">{numberInput('atterberg','wl_pct',t.atterberg?.wl_pct,20,120)}</Field><Field label="WP" unit="%">{numberInput('atterberg','wp_pct',t.atterberg?.wp_pct,10,60)}</Field><Field label="IP calculé" unit="%"><div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{typeof t.atterberg?.wl_pct === 'number' && typeof t.atterberg?.wp_pct === 'number' ? Math.round((t.atterberg.wl_pct-t.atterberg.wp_pct)*10)/10 : 'Automatique'}</div></Field><Field label="IP du rapport" unit="%">{numberInput('atterberg','ip_rapport',t.atterberg?.ip_rapport,0,80)}</Field><Field label="Norme"><input className={inputClass} value={t.atterberg?.norme ?? 'NF P 94-051'} onChange={e=>setTest('atterberg','norme',e.target.value)} /></Field></>}
          {def.id === 'vbs' && <><Field label="VBS" unit="g/100g">{numberInput('vbs','vbs_g100g',t.vbs?.vbs_g100g,0,30, '0.01')}</Field><Field label="Méthode / fraction"><select className={inputClass} value={t.vbs?.methode ?? ''} onChange={e=>setTest('vbs','methode',e.target.value)}><option value="">Sélectionner</option><option>NF P 94-068 (fraction 0/50)</option><option>NF EN 933-9 (fraction 0/2)</option><option>Autre / non précisé</option></select></Field></>}
          {def.id === 'gonflement' && <><Field label="EG" unit="%">{numberInput('gonflement','eg_pct',t.gonflement?.eg_pct,0,20)}</Field><Field label="Qualification"><input className={inputClass} value={t.gonflement?.eg_qualitatif ?? ''} onChange={e=>setTest('gonflement','eg_qualitatif',e.target.value)} /></Field><Field label="Méthode"><input className={inputClass} value={t.gonflement?.methode ?? ''} onChange={e=>setTest('gonflement','methode',e.target.value)} /></Field></>}
          {def.id === 'proctor' && <><Field label="Type"><select className={inputClass} value={t.proctor?.proctor_type ?? 'OPM'} onChange={e=>setTest('proctor','proctor_type',e.target.value)}><option>OPM</option><option>OPN</option></select></Field><Field label="Densité sèche maximale" unit="kN/m³">{numberInput('proctor','gamma_d_max_knm3',t.proctor?.gamma_d_max_knm3,10,26)}</Field><Field label="Teneur en eau optimale" unit="%">{numberInput('proctor','w_opt_pct',t.proctor?.w_opt_pct,2,30)}</Field><Field label="Provenance"><select className={inputClass} value={t.proctor?.provenance ?? ''} onChange={e=>setTest('proctor','provenance',e.target.value)}><option value="">Sélectionner</option><option>Sol en place</option><option>Emprunt</option></select></Field></>}
          {def.id === 'cbr' && <><Field label="CBR" unit="%">{numberInput('cbr','cbr_pct',t.cbr?.cbr_pct,0,200)}</Field><Field label="Compactage" unit="%">{numberInput('cbr','compactage_pct',t.cbr?.compactage_pct,0,100)}</Field><Field label="Référence Proctor"><select className={inputClass} value={t.cbr?.proctor_ref ?? 'OPM'} onChange={e=>setTest('cbr','proctor_ref',e.target.value)}><option>OPM</option><option>OPN</option></select></Field><Field label="Immersion" unit="jours">{numberInput('cbr','immersion_j',t.cbr?.immersion_j,0,30,'1')}</Field><Field label="Nombre de coups">{numberInput('cbr','n_coups',t.cbr?.n_coups,0,200,'1')}</Field><Field label="Provenance"><select className={inputClass} value={t.cbr?.provenance ?? ''} onChange={e=>setTest('cbr','provenance',e.target.value)}><option value="">Sélectionner</option><option>Sol en place</option><option>Emprunt</option></select></Field></>}
          {def.id === 'penetrometre' && <><Field label="Rd" unit="MPa">{numberInput('penetrometre','rd_mpa',t.penetrometre?.rd_mpa,0,150)}</Field><Field label="Type d’essai"><select className={inputClass} value={t.penetrometre?.type_essai ?? 'Pénétromètre dynamique'} onChange={e=>setTest('penetrometre','type_essai',e.target.value)}><option>Pénétromètre dynamique</option><option>PDL</option><option>Autre</option></select></Field><Field label="Refus"><select className={inputClass} value={t.penetrometre?.refus ?? 'non'} onChange={e=>setTest('penetrometre','refus',e.target.value)}><option value="non">Non</option><option value="oui">Oui</option></select></Field></>}
          {def.id === 'pressiometre' && <><Field label="Em" unit="MPa">{numberInput('pressiometre','em_mpa',t.pressiometre?.em_mpa,0,100)}</Field><Field label="Pl" unit="MPa">{numberInput('pressiometre','pl_mpa',t.pressiometre?.pl_mpa,0,10,'0.01')}</Field><Field label="Pf" unit="MPa">{numberInput('pressiometre','pf_mpa',t.pressiometre?.pf_mpa,0,10,'0.01')}</Field><Field label="Em / Pl"><div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{typeof t.pressiometre?.em_mpa === 'number' && t.pressiometre?.pl_mpa > 0 ? Math.round((t.pressiometre.em_mpa/t.pressiometre.pl_mpa)*10)/10 : 'Automatique'}</div></Field></>}
          {def.id === 'granulometrie' && <div className="space-y-2 md:col-span-3">{(t.granulometrie?.points ?? []).map((point: JsonMap, index: number) => <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2"><input aria-label="Tamis en millimètres" className={inputClass} type="number" step="0.001" placeholder="Tamis (mm)" value={point.sieve_mm ?? ''} onChange={e=>{const pts=[...(t.granulometrie?.points??[])];pts[index]={...pts[index],sieve_mm:asNumber(e.target.value)};setTest('granulometrie','points',pts)}}/><input aria-label="Pourcentage passant" className={inputClass} type="number" min={0} max={100} step="0.1" placeholder="Passant (%)" value={point.passant_pct ?? ''} onChange={e=>{const pts=[...(t.granulometrie?.points??[])];pts[index]={...pts[index],passant_pct:asNumber(e.target.value)};setTest('granulometrie','points',pts)}}/><button type="button" aria-label="Supprimer ce tamis" onClick={()=>setTest('granulometrie','points',(t.granulometrie?.points??[]).filter((_:unknown,i:number)=>i!==index))} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4"/></button></div>)}<button type="button" onClick={()=>setTest('granulometrie','points',[...(t.granulometrie?.points??[]),{sieve_mm:undefined,passant_pct:undefined}])} className="inline-flex items-center gap-2 text-xs font-medium text-blue-600"><Plus className="h-4 w-4"/>Ajouter un tamis</button></div>}
          {def.id === 'classification' && <><Field label="Classe GTR"><input className={inputClass} value={t.classification?.classe_gtr ?? ''} onChange={e=>setTest('classification','classe_gtr',e.target.value)} /></Field><Field label="Classe HRB"><input className={inputClass} value={t.classification?.classe_hrb ?? ''} onChange={e=>setTest('classification','classe_hrb',e.target.value)} /></Field><Field label="Classe USC"><input className={inputClass} value={t.classification?.classe_usc ?? ''} onChange={e=>setTest('classification','classe_usc',e.target.value)} /></Field><Field label="Teneur en eau naturelle" unit="%">{numberInput('classification','w_nat_pct',t.classification?.w_nat_pct,0,100)}</Field><Field label="Masse volumique des grains" unit="g/cm³">{numberInput('classification','rho_s_gcm3',t.classification?.rho_s_gcm3,0,5,'0.01')}</Field></>}
        </div>}
      </section>; })}</div>

      {warnings.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><div className="mb-1 flex items-center gap-2 text-sm font-medium text-amber-800"><AlertCircle className="h-4 w-4" />Contrôles à vérifier</div><ul className="list-disc space-y-0.5 pl-5 text-xs text-amber-700">{warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></div>}
      {error && <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4" />{error}</div>}
      <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={saving} onClick={() => void save('draft')} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Save className="h-4 w-4" />Enregistrer le brouillon</button><button type="button" disabled={saving || warnings.length > 0} onClick={() => void save('complete')} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />Marquer comme terminé</button></div>
    </div>;
  }

  return <div className="space-y-4">
    <div className="flex items-center justify-between"><div><h3 className="flex items-center gap-2 font-medium text-slate-900"><FlaskConical className="h-5 w-5 text-blue-600" />Résultats de laboratoire</h3><p className="text-xs text-slate-500">Une fiche par échantillon, liée à un sondage terrain.</p></div><button type="button" disabled={sondages.length === 0} onClick={() => { setForm(newForm(sondages)); setExpanded(null); }} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"><Plus className="h-4 w-4" />Nouvelle fiche</button></div>
    {sondages.length === 0 && <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertCircle className="mt-0.5 h-4 w-4" />Aucun sondage terrain n’est encore lié à cette mission. Une fiche laboratoire doit rester rattachée à un sondage confirmé.</div>}
    {error && <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4" />{error}</div>}
    {loading ? <div className="py-8 text-center text-sm text-slate-500">Chargement des fiches laboratoire…</div> : items.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center"><FlaskConical className="mx-auto mb-2 h-7 w-7 text-slate-300" /><p className="text-sm text-slate-500">Aucun résultat saisi pour cette mission.</p></div> : <div className="space-y-2">{items.map(item => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"><div className={`rounded-lg p-2 ${item.status === 'complete' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>{item.status === 'complete' ? <CheckCircle2 className="h-5 w-5" /> : <FlaskConical className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-slate-900">{item.sample_code}</div><div className="text-xs text-slate-500">{item.sondage_code || item.sondage_id} · {item.depth_top_m}–{item.depth_bottom_m} m · {Object.keys(item.tests).length} essai(s)</div></div><button type="button" onClick={() => { setForm({ id:item.id, sondage_id:item.sondage_id, sample_code:item.sample_code, depth_top_m:item.depth_top_m, depth_bottom_m:item.depth_bottom_m, sample:item.sample, tests:item.tests, status:item.status }); setExpanded(Object.keys(item.tests)[0] ?? null); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Ouvrir</button><button type="button" aria-label="Supprimer la fiche" onClick={async()=>{if(!window.confirm(`Supprimer la fiche ${item.sample_code} ?`))return;try{await labResultsApi.delete(missionId,item.id);await load()}catch(e){setError(e instanceof Error?e.message:'Suppression impossible')}}} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4"/></button></div>)}</div>}
  </div>;
};
