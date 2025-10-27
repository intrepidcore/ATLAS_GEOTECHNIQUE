/* Wizard Import Bulk – v3
 * - ExcelJS parsing robuste
 * - Mapping fiable avec auto-guess + listes déroulantes alimentées
 * - Aperçu multi-feuilles
 * - Envoi multipart avec négociation de schéma (6 variantes)
 * - Badge "V3" dans l'en-tête (preuve de vie)
 */

import * as ExcelJS from "exceljs";

/* =========================
   ###### Types ######
   ========================= */

type SheetRole =
  | "sondages"
  | "echantillons"
  | "atterberg"
  | "vbs"
  | "proctor"
  | "granulo_tamisage_large"
  | "granulo_sedimento_large"
  // 🆕 Nouveaux essais
  | "densite"
  | "teneur_eau"
  | "classification";

type SheetMapping = Record<string, string | null>;
type XlsxMapping = Partial<Record<SheetRole, SheetMapping>>;

type XlsxSheets = Partial<Record<SheetRole, string>>;

type WizardStep = 1 | 2 | 3 | 4 | 5;

type SchemaVariant =
  | "A_config_rootMapping"           // {format, structure:{sheets}, mapping, options}
  | "B_config_structureHasMapping"   // {format, structure:{sheets, mapping}, options}
  | "C_payload_rootMapping"          // {payload:{format, structure, mapping, options}}
  | "D_payload_structureHasMapping"  // {payload:{format, structure:{sheets, mapping}, options}}
  | "E_config_modeXlsx"              // {mode:'xlsx', structure, mapping, options}
  | "F_config_modeXlsxGeotech"       // {mode:'xlsx_geotech', structure, mapping, options}
  | "G_geotechnical_simple";         // Endpoint /surveys/bulk-import/geotechnical (file + geolocation_mode)

/* =========================
   ###### Utilitaires ######
   ========================= */

const DEBUG = true;

function log(...args: any[]) {
  if (DEBUG) console.log("[WZ3]", ...args);
}

function el<T extends HTMLElement>(q: string, root: ParentNode = document): T {
  const n = root.querySelector(q);
  if (!n) throw new Error(`Element not found: ${q}`);
  return n as T;
}

function nice(s: string | null | undefined) {
  return (s ?? "").toString().trim();
}

/** Normalisation douce des en-têtes (retire accents/espaces) */
function normHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, "_")
    .replace(/[^\w@.]+/g, "")
    .toLowerCase();
}

/* =========================
   ###### Wizard V3 ######
   ========================= */

export class ImportBulkWizardV3 {
  private api = "/api";
  private step: WizardStep = 1;

  private file: File | null = null;
  private workbook: ExcelJS.Workbook | null = null;

  private detectedSheets: string[] = [];
  private sheetsByRole: XlsxSheets = {};

  /** colonnes détectées par feuille (clé = nom de feuille) */
  private columnsBySheet = new Map<string, string[]>(); // valeurs = en-têtes normalisées

  /** mapping structuré par rôle -> {champ_domaine: "nom_colonne" | null} */
  private xlsxMapping: XlsxMapping = {};

  /** petits caches d'aperçu */
  private parsedPreview: Partial<Record<SheetRole, any[]>> = {};

  constructor(private root: HTMLElement, apiBase?: string) {
    if (apiBase) this.api = apiBase;
    this.mount();
  }

  /* ------------ API Publique ------------ */

  public open() {
    this.root.style.display = "block";
    this.goto(1);
    log("Wizard ouvert");
  }

  public close() {
    this.root.style.display = "none";
    log("Wizard fermé");
  }

  /* ------------ Montage & UI ------------ */

  private mount() {
    // Créer la structure HTML du wizard
    this.root.innerHTML = `
      <div class="wizard-v3">
        <div class="wizard-header">
          <h2>Import Bulk - Wizard <span class="badge-v3">V3</span></h2>
        </div>
        
        <div class="wizard-body">
          <!-- Étape 1 : Upload -->
          <section class="step-1">
            <h3>Étape 1 : Sélection du fichier</h3>
            <input id="importFile" type="file" accept=".xlsx,.csv" />
          </section>

          <!-- Étape 2 : Sélection des feuilles -->
          <section class="step-2" style="display:none">
            <h3>Étape 2 : Sélection des feuilles</h3>
            <div class="form-group">
              <label>Format</label>
              <select id="formatSelect"></select>
            </div>
            <div class="form-group">
              <label>Sondages</label>
              <select id="sheet_sondages"></select>
            </div>
            <div class="form-group">
              <label>Échantillons</label>
              <select id="sheet_echantillons"></select>
            </div>
            <div class="form-group">
              <label>Atterberg</label>
              <select id="sheet_atterberg"></select>
            </div>
            <div class="form-group">
              <label>VBS</label>
              <select id="sheet_vbs"></select>
            </div>
            <div class="form-group">
              <label>Proctor</label>
              <select id="sheet_proctor"></select>
            </div>
            <div class="form-group">
              <label>Granulo Tamisage</label>
              <select id="sheet_granulo_tamisage"></select>
            </div>
            <div class="form-group">
              <label>Granulo Sédimento</label>
              <select id="sheet_granulo_sedimento"></select>
            </div>
            <!-- 🆕 Nouveaux essais -->
            <div class="form-group">
              <label>Densité</label>
              <select id="sheet_densite"></select>
            </div>
            <div class="form-group">
              <label>Teneur en Eau</label>
              <select id="sheet_teneur_eau"></select>
            </div>
            <div class="form-group">
              <label>Classification</label>
              <select id="sheet_classification"></select>
            </div>
          </section>

          <!-- Étape 3 : Mapping -->
          <section class="step-3" style="display:none">
            <h3>Étape 3 : Mapping des colonnes</h3>
            <div id="map_sondages"></div>
            <div id="map_echantillons"></div>
            <div id="map_atterberg"></div>
            <div id="map_vbs"></div>
            <div id="map_proctor"></div>
            <div id="map_granulo_tamisage"></div>
            <div id="map_granulo_sedimento"></div>
            <!-- 🆕 Nouveaux essais -->
            <div id="map_densite"></div>
            <div id="map_teneur_eau"></div>
            <div id="map_classification"></div>
          </section>

          <!-- Étape 4 : Aperçu -->
          <section class="step-4" style="display:none">
            <h3>Étape 4 : Aperçu des données</h3>
            <div id="previewRoot"></div>
          </section>

          <!-- Étape 5 : Résultat -->
          <section class="step-5" style="display:none">
            <h3>Import en cours...</h3>
            <div id="importProgressLog"></div>
            <div id="importResult"></div>
          </section>
        </div>

        <div class="wizard-footer">
          <button id="prevBtn" class="btn-secondary">← Précédent</button>
          <button id="nextBtn" class="btn-primary">Suivant →</button>
          <button id="closeBtn" class="btn-secondary">Fermer</button>
        </div>
      </div>
    `;

    // Ajouter les styles inline
    const style = document.createElement("style");
    style.textContent = `
      .wizard-v3 { background: white; padding: 20px; border-radius: 8px; }
      .wizard-header { border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 20px; }
      .wizard-header h2 { margin: 0; display: flex; align-items: center; }
      .badge-v3 { margin-left: 10px; padding: 2px 8px; background: #0ea5e9; color: white; font-size: 0.75rem; border-radius: 4px; }
      .wizard-body { min-height: 300px; }
      .wizard-footer { margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end; border-top: 2px solid #e5e7eb; padding-top: 10px; }
      .form-group { margin-bottom: 15px; }
      .form-group label { display: block; font-weight: 600; margin-bottom: 5px; }
      .form-group select { width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; }
      .btn-primary { padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; }
      .btn-secondary { padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer; }
      .btn-primary:hover { background: #2563eb; }
      .btn-secondary:hover { background: #4b5563; }
      .map-row { display: flex; gap: 10px; margin-bottom: 10px; align-items: center; }
      .map-row label { flex: 0 0 150px; }
      .map-row select { flex: 1; padding: 6px; }
      .preview-block { margin-bottom: 20px; }
      .preview-title { font-weight: 600; margin-bottom: 10px; }
      .preview table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
      .preview th, .preview td { border: 1px solid #d1d5db; padding: 6px; text-align: left; }
      .preview th { background: #f3f4f6; font-weight: 600; }
      .ok { color: #059669; font-weight: 600; }
      .err { color: #dc2626; font-weight: 600; }
    `;
    this.root.appendChild(style);

    // Événements
    el<HTMLInputElement>("#importFile", this.root).addEventListener(
      "change",
      (e) => this.onFileSelected((e.target as HTMLInputElement).files)
    );

    el<HTMLButtonElement>("#nextBtn", this.root).addEventListener("click", () =>
      this.next()
    );
    el<HTMLButtonElement>("#prevBtn", this.root).addEventListener("click", () =>
      this.prev()
    );
    el<HTMLButtonElement>("#closeBtn", this.root).addEventListener("click", () =>
      this.close()
    );

    // Format select
    const formatSel = el<HTMLSelectElement>("#formatSelect", this.root);
    formatSel.innerHTML = `<option value="xlsx" selected>XLSX (multi-feuilles)</option>`;
    
    log("Wizard V3 monté avec HTML complet");
  }

  /* ------------ Étapes ------------ */

  private async onFileSelected(files: FileList | null) {
    if (!files || !files[0]) return;
    this.file = files[0];
    log("Fichier choisi:", this.file.name, this.file.size, "bytes");

    // Parse via ExcelJS
    await this.readWorkbook();

    // Étape 2 : sélection des feuilles (et initialisation)
    await this.setupFormatStep();

    this.goto(2);
  }

  private async readWorkbook() {
    if (!this.file) return;
    const buf = await this.file.arrayBuffer();
    this.workbook = new ExcelJS.Workbook();
    await this.workbook.xlsx.load(buf);

    this.detectedSheets = this.workbook.worksheets.map((w) => w.name);
    log("Feuilles détectées:", this.detectedSheets);

    // Indexe colonnes par feuille
    this.columnsBySheet.clear();
    for (const ws of this.workbook.worksheets) {
      const headers = this.extractHeaders(ws);
      this.columnsBySheet.set(ws.name, headers);
      log("Cols", ws.name, headers);
    }

    // Heuristique d'affectation par défaut (nom ~ role)
    this.sheetsByRole = this.guessSheetsByRole(this.detectedSheets);
    // initialise mapping
    this.initializeXlsxMapping();
  }

  private extractHeaders(ws: ExcelJS.Worksheet): string[] {
    const first = ws.getRow(1);
    const headers: string[] = [];
    first.eachCell((cell) => {
      const raw =
        (typeof cell.text === "string" ? cell.text : "") ||
        (typeof (cell.value as any) === "string" ? (cell.value as any) : "");
      headers.push(normHeader(raw));
    });
    return headers.filter(Boolean);
  }

  private guessSheetsByRole(all: string[]): XlsxSheets {
    const f = (needle: string) =>
      all.find((n) => normHeader(n).includes(needle)) || null;

    return {
      sondages: f("sondage") || f("site") || f("survey") || undefined,
      echantillons: f("echantillon") || f("sample") || undefined,
      atterberg: f("atterberg") || f("wl") || f("ip") || undefined,
      vbs: f("vbs") || f("bleu") || undefined,
      proctor: f("proctor") || f("proctor_ie") || undefined,
      granulo_tamisage_large:
        f("granulo_tamisage_large") || f("granulo_tamisage") || undefined,
      granulo_sedimento_large:
        f("granulo_sedimento_large") ||
        f("granulo_sedimento") ||
        f("sedimento") ||
        undefined,
      // 🆕 Nouveaux essais
      densite: f("densite") || f("density") || f("rho") || undefined,
      teneur_eau: f("teneur_eau") || f("water_content") || f("w_naturel") || undefined,
      classification: f("classification") || f("classement") || f("hrb") || f("uscs") || undefined,
    };
  }

  private initializeXlsxMapping() {
    const H = (sheetName?: string) =>
      sheetName ? this.columnsBySheet.get(sheetName) ?? [] : [];

    const pick = (sheet: string | undefined, candidates: string[]) => {
      const cols = H(sheet);
      for (const c of candidates) {
        const i = cols.indexOf(c);
        if (i >= 0) return cols[i];
      }
      return null;
    };

    const sSond = this.sheetsByRole.sondages;
    const sEch = this.sheetsByRole.echantillons;
    const sAtt = this.sheetsByRole.atterberg;
    const sVbs = this.sheetsByRole.vbs;
    const sProc = this.sheetsByRole.proctor;

    this.xlsxMapping = {
      sondages: {
        code: pick(sSond, ["code", "code_site"]),
        localite: pick(sSond, ["localite", "site", "lieu"]),
        date: pick(sSond, ["date", "survey_date"]),
        source: pick(sSond, ["source", "campagne"]),
        lat: pick(sSond, ["lat", "latitude"]),
        lon: pick(sSond, ["lon", "lng", "longitude"]),
        adm1: pick(sSond, ["adm1", "region", "adm1_name"]),
        adm2: pick(sSond, ["adm2", "prefecture", "adm2_name"]),
        adm3: pick(sSond, ["adm3", "commune", "adm3_name"]),
      },
      echantillons: {
        code: pick(sEch, ["code", "code_site"]),
        depth_m: pick(sEch, ["depth_m", "profondeur_m", "z_m"]),
        date: pick(sEch, ["date"]),
        laboratory: pick(sEch, ["laboratory", "labo", "laboratoire"]),
        rho_s_gcm3: pick(sEch, ["rho_s_gcm3", "gs", "rho_s"]),
        water_content_w: pick(sEch, ["water_content_w", "w", "wc"]),
        is_index: pick(sEch, ["is_index"]),
      },
      atterberg: {
        code: pick(sAtt, ["code", "code_site"]),
        depth_m: pick(sAtt, ["depth_m"]),
        wl: pick(sAtt, ["wl", "w_l"]),
        wp: pick(sAtt, ["wp", "w_p"]),
      },
      vbs: {
        code: pick(sVbs, ["code", "code_site"]),
        depth_m: pick(sVbs, ["depth_m"]),
        vbs: pick(sVbs, ["vbs"]),
        commentaire: pick(sVbs, ["commentaire", "comment"]),
      },
      proctor: {
        code: pick(sProc, ["code", "code_site"]),
        depth_m: pick(sProc, ["depth_m"]),
        rho_d_max: pick(sProc, ["rho_d_max", "gamma_d_max", "gamma_d"]),
        w_opt: pick(sProc, ["w_opt", "wopt"]),
        proctor_type: pick(sProc, ["proctor_type", "type"]),
      },
      granulo_tamisage_large: {
        sieve_key: pick(this.sheetsByRole.granulo_tamisage_large, [
          "sieve_mm",
          "tam_mm",
          "sieve",
        ]),
        series_pattern: "@",
        value_semantics: "passant_%",
      },
      granulo_sedimento_large: {
        sieve_key: pick(this.sheetsByRole.granulo_sedimento_large, [
          "sieve_mm",
          "tam_mm",
          "sieve",
        ]),
        series_pattern: "@",
        value_semantics: "passant_%",
      },
      // 🆕 Nouveaux essais
      densite: {
        code: pick(this.sheetsByRole.densite, ["code", "code_site", "localite"]),
        depth_m: pick(this.sheetsByRole.densite, ["depth_m", "profondeur_m", "z_m"]),
        rho_d_app: pick(this.sheetsByRole.densite, ["rho_d_app", "densite_apparente", "gamma_d", "rho_d"]),
        rho_s_abs: pick(this.sheetsByRole.densite, ["rho_s_abs", "densite_absolue", "gamma_s", "rho_s"]),
        note: pick(this.sheetsByRole.densite, ["note", "remarque", "comment"]),
      },
      teneur_eau: {
        code: pick(this.sheetsByRole.teneur_eau, ["code", "code_site", "localite"]),
        depth_m: pick(this.sheetsByRole.teneur_eau, ["depth_m", "profondeur_m", "z_m"]),
        w: pick(this.sheetsByRole.teneur_eau, ["w", "teneur_eau", "water_content", "wc"]),
        wi: pick(this.sheetsByRole.teneur_eau, ["wi", "w_i", "indice_plasticite"]),
        note: pick(this.sheetsByRole.teneur_eau, ["note", "remarque", "comment"]),
      },
      classification: {
        code: pick(this.sheetsByRole.classification, ["code", "code_site", "localite"]),
        depth_m: pick(this.sheetsByRole.classification, ["depth_m", "profondeur_m", "z_m"]),
        hrb: pick(this.sheetsByRole.classification, ["hrb", "classification_hrb", "aashto"]),
        unified: pick(this.sheetsByRole.classification, ["unified", "uscs", "classification_unifiee"]),
        bm: pick(this.sheetsByRole.classification, ["bm", "bleu_methylene", "classification_bm"]),
        note: pick(this.sheetsByRole.classification, ["note", "remarque", "comment"]),
      },
    };
  }

  private async setupFormatStep() {
    // Remplit les sélecteurs de noms de feuilles
    const roleToSel: Partial<Record<SheetRole, string>> = {
      sondages: "#sheet_sondages",
      echantillons: "#sheet_echantillons",
      atterberg: "#sheet_atterberg",
      vbs: "#sheet_vbs",
      proctor: "#sheet_proctor",
      granulo_tamisage_large: "#sheet_granulo_tamisage",
      granulo_sedimento_large: "#sheet_granulo_sedimento",
      // 🆕 Nouveaux essais
      densite: "#sheet_densite",
      teneur_eau: "#sheet_teneur_eau",
      classification: "#sheet_classification",
    };

    for (const [role, sel] of Object.entries(roleToSel)) {
      const select = el<HTMLSelectElement>(sel!, this.root);
      select.innerHTML =
        `<option value="">— non défini —</option>` +
        this.detectedSheets
          .map(
            (s) =>
              `<option value="${s}" ${
                this.sheetsByRole[role as SheetRole] === s ? "selected" : ""
              }>${s}</option>`
          )
          .join("");
      select.addEventListener("change", () => {
        this.sheetsByRole[role as SheetRole] = nice(select.value) || undefined;
        // re-init mapping pour ce rôle
        this.initializeXlsxMapping();
        // (étape mapping sera reconstruite au next)
      });
    }
  }

  private async goto(step: WizardStep) {
    this.step = step;
    // masquage/affichage basique
    for (let i = 1 as WizardStep; i <= 5; i = (i + 1) as WizardStep) {
      const sec = el<HTMLElement>(`.step-${i}`, this.root);
      sec.style.display = i === step ? "block" : "none";
    }
  }

  private async next() {
    if (this.step === 2) {
      await this.renderMappingStep();
      await this.goto(3);
      return;
    }
    if (this.step === 3) {
      await this.renderPreviewStep();
      await this.goto(4);
      return;
    }
    if (this.step === 4) {
      await this.startImport();
      return;
    }
  }

  private async prev() {
    if (this.step === 4) return this.goto(3);
    if (this.step === 3) return this.goto(2);
    if (this.step === 2) return this.goto(1);
  }

  /* ------------ Étape 3 : Mapping ------------ */

  private async renderMappingStep() {
    // Remplit les listes déroulantes de champs à partir des colonnes de la feuille choisie
    const mountRole = (role: SheetRole, containerSel: string, fields: string[]) => {
      const container = el<HTMLDivElement>(containerSel, this.root);
      const sheetName = this.sheetsByRole[role];
      const options = (sheetName ? this.columnsBySheet.get(sheetName) : []) ?? [];

      const current = (this.xlsxMapping[role] ?? {}) as SheetMapping;

      container.innerHTML = fields
        .map((fname) => {
          const selected = current?.[fname] ?? "";
          const opts =
            `<option value="">— Non mappé —</option>` +
            options
              .map(
                (col) =>
                  `<option value="${col}" ${
                    selected === col ? "selected" : ""
                  }>${col}</option>`
              )
              .join("");
          return `
            <div class="map-row">
              <label>${fname}</label>
              <select data-role="${role}" data-field="${fname}">
                ${opts}
              </select>
            </div>`;
        })
        .join("");

      container.querySelectorAll("select").forEach((sel) => {
        sel.addEventListener("change", (e) => {
          const s = e.target as HTMLSelectElement;
          const r = s.getAttribute("data-role") as SheetRole;
          const f = s.getAttribute("data-field")!;
          this.xlsxMapping[r] = this.xlsxMapping[r] || {};
          this.xlsxMapping[r]![f] = s.value || null;
        });
      });
    };

    mountRole("sondages", "#map_sondages", [
      "code",
      "localite",
      "date",
      "source",
      "lat",
      "lon",
      "adm1",
      "adm2",
      "adm3",
    ]);

    mountRole("echantillons", "#map_echantillons", [
      "code",
      "depth_m",
      "date",
      "laboratory",
      "rho_s_gcm3",
      "water_content_w",
      "is_index",
    ]);

    mountRole("atterberg", "#map_atterberg", ["code", "depth_m", "wl", "wp"]);
    mountRole("vbs", "#map_vbs", ["code", "depth_m", "vbs", "commentaire"]);
    mountRole("proctor", "#map_proctor", [
      "code",
      "depth_m",
      "rho_d_max",
      "w_opt",
      "proctor_type",
    ]);

    mountRole("granulo_tamisage_large", "#map_granulo_tamisage", [
      "sieve_key",
      "series_pattern",
      "value_semantics",
    ]);
    mountRole("granulo_sedimento_large", "#map_granulo_sedimento", [
      "sieve_key",
      "series_pattern",
      "value_semantics",
    ]);

    // 🆕 Nouveaux essais
    mountRole("densite", "#map_densite", [
      "code",
      "depth_m",
      "rho_d_app",
      "rho_s_abs",
      "note",
    ]);
    mountRole("teneur_eau", "#map_teneur_eau", [
      "code",
      "depth_m",
      "w",
      "wi",
      "note",
    ]);
    mountRole("classification", "#map_classification", [
      "code",
      "depth_m",
      "hrb",
      "unified",
      "bm",
      "note",
    ]);
  }

  /* ------------ Étape 4 : Aperçu ------------ */

  private async renderPreviewStep() {
    const table = (rows: any[], keys: string[], max = 5) => {
      const head = `<tr>${keys.map((k) => `<th>${k}</th>`).join("")}</tr>`;
      const body = rows
        .slice(0, max)
        .map(
          (r) =>
            `<tr>${keys.map((k) => `<td>${nice(r[k])}</td>`).join("")}</tr>` 
        )
        .join("");
      return `<table class="preview"><thead>${head}</thead><tbody>${body}</tbody></table>`;
    };

    const out = el<HTMLDivElement>("#previewRoot", this.root);
    out.innerHTML = "";

    const pushBlock = (title: string, role: SheetRole, requiredKeys: string[]) => {
      const rows = this.extractRowsForPreview(role);
      const html = `
        <div class="preview-block">
          <div class="preview-title">${title} <small>(${rows.length} lignes)</small></div>
          ${rows.length ? table(rows, requiredKeys) : `<em>Aucune donnée</em>`}
        </div>`;
      out.insertAdjacentHTML("beforeend", html);
    };

    pushBlock("Sondages", "sondages", [
      "code",
      "localite",
      "date",
      "source",
      "lat",
      "lon",
    ]);
    pushBlock("Échantillons", "echantillons", [
      "code",
      "depth_m",
      "date",
      "laboratory",
      "rho_s_gcm3",
      "water_content_w",
    ]);
    pushBlock("Atterberg", "atterberg", ["code", "depth_m", "wl", "wp"]);
    pushBlock("VBS", "vbs", ["code", "depth_m", "vbs"]);
    pushBlock("Proctor", "proctor", ["code", "depth_m", "rho_d_max", "w_opt"]);
    pushBlock("Granulo tamisage (large)", "granulo_tamisage_large", [
      "sieve_key",
    ]);
    pushBlock("Granulo sédimento (large)", "granulo_sedimento_large", [
      "sieve_key",
    ]);
    
    // 🆕 Nouveaux essais
    pushBlock("Densité", "densite", [
      "code",
      "depth_m",
      "rho_d_app",
      "rho_s_abs",
    ]);
    pushBlock("Teneur en Eau", "teneur_eau", [
      "code",
      "depth_m",
      "w",
      "wi",
    ]);
    pushBlock("Classification", "classification", [
      "code",
      "depth_m",
      "hrb",
      "unified",
      "bm",
    ]);
  }

  private extractRowsForPreview(role: SheetRole): any[] {
    // simple lecture (les vraies conversions/pivots se feront côté backend)
    const name = this.sheetsByRole[role];
    if (!name || !this.workbook) return [];
    const ws = this.workbook.getWorksheet(name);
    if (!ws) return [];

    const headers = this.columnsBySheet.get(name) ?? [];
    const rows: any[] = [];

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const r: any = {};
      row.eachCell((cell, colNumber) => {
        const key = headers[colNumber - 1];
        if (!key) return;
        let v: any = (cell.text as any) ?? cell.value ?? "";
        if (cell.type === ExcelJS.ValueType.Date && v instanceof Date) {
          v = v.toISOString().split("T")[0];
        }
        r[key] = typeof v === "string" ? v.trim() : v;
      });
      if (Object.keys(r).length) rows.push(r);
    });
    this.parsedPreview[role] = rows;
    return rows;
  }

  /* ------------ Étape 5 : Import ------------ */

  private buildBaseStructure() {
    const structure: { sheets: XlsxSheets } = {
      sheets: { ...this.sheetsByRole },
    };
    return structure;
  }

  private buildMapping() {
    // renvoie un objet "mapping" propre (sans undefined)
    const out: any = {};
    for (const [role, m] of Object.entries(this.xlsxMapping)) {
      out[role] = {};
      for (const [k, v] of Object.entries(m || {})) {
        if (v && typeof v === "string") out[role][k] = v;
      }
      if (!Object.keys(out[role]).length) delete out[role];
    }
    return out;
  }

  /** Essaie jusqu'à 6 variantes de schéma. S'arrête dès que le serveur répond 2xx. */
  private async startImport() {
    if (!this.file) return;

    const variants: SchemaVariant[] = [
      "G_geotechnical_simple",  // 🎯 Essayer d'abord l'endpoint géotechnique
      "A_config_rootMapping",
      "B_config_structureHasMapping",
      "C_payload_rootMapping",
      "D_payload_structureHasMapping",
      "E_config_modeXlsx",
      "F_config_modeXlsxGeotech",
    ];

    const baseStructure = this.buildBaseStructure();
    const mapping = this.buildMapping();

    const tryOne = async (variant: SchemaVariant) => {
      const fd = new FormData();
      fd.append("file", this.file as Blob, this.file!.name);

      const common = {
        options: { refresh_mv: true },
        format: "xlsx",
        structure: { ...baseStructure },
        mapping: { ...mapping },
        mode: "xlsx",
      };

      let payload: any;

      switch (variant) {
        case "A_config_rootMapping":
          payload = {
            format: "xlsx",
            structure: baseStructure, // {sheets}
            mapping,
            options: { refresh_mv: true },
          };
          fd.append(
            "config",
            new Blob([JSON.stringify(payload)], { type: "application/json" })
          );
          break;

        case "B_config_structureHasMapping":
          payload = {
            format: "xlsx",
            structure: { ...baseStructure, mapping },
            options: { refresh_mv: true },
          };
          fd.append(
            "config",
            new Blob([JSON.stringify(payload)], { type: "application/json" })
          );
          break;

        case "C_payload_rootMapping":
          payload = {
            format: "xlsx",
            structure: baseStructure,
            mapping,
            options: { refresh_mv: true },
          };
          fd.append(
            "payload",
            new Blob([JSON.stringify(payload)], { type: "application/json" })
          );
          break;

        case "D_payload_structureHasMapping":
          payload = {
            format: "xlsx",
            structure: { ...baseStructure, mapping },
            options: { refresh_mv: true },
          };
          fd.append(
            "payload",
            new Blob([JSON.stringify(payload)], { type: "application/json" })
          );
          break;

        case "E_config_modeXlsx":
          payload = {
            mode: "xlsx",
            structure: baseStructure,
            mapping,
            options: { refresh_mv: true },
          };
          fd.append(
            "config",
            new Blob([JSON.stringify(payload)], { type: "application/json" })
          );
          break;

        case "F_config_modeXlsxGeotech":
          payload = {
            mode: "xlsx_geotech",
            structure: baseStructure,
            mapping,
            options: { refresh_mv: true },
          };
          fd.append(
            "config",
            new Blob([JSON.stringify(payload)], { type: "application/json" })
          );
          break;

        case "G_geotechnical_simple":
          // Endpoint spécifique géotechnique : juste file + geolocation_mode
          fd.append("geolocation_mode", "centroid");
          payload = { geolocation_mode: "centroid" };
          break;
      }

      log("TRY", variant, "-> split fields", Object.keys(payload || {}));
      
      // Choisir l'endpoint selon la variante
      const endpoint = variant === "G_geotechnical_simple" 
        ? `${this.api}/surveys/bulk-import/geotechnical`
        : `${this.api}/import/bulk`;
      
      const res = await fetch(endpoint, {
        method: "POST",
        body: fd,
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        log("SUCCESS", variant, data);
        this.renderImportResult(true, data);
        return true;
      }

      const errText = await res.text();
      log("RESP 4xx", variant, errText);
      this.renderImportProgressMessage(
        `Variante ${variant} → ${res.status} ${res.statusText}: ${errText}` 
      );
      return false;
    };

    // barre de progression initiale
    this.renderImportProgressMessage("Début import…");

    let success = false;
    for (const v of variants) {
      // affichage live
      this.renderImportProgressMessage(`Essai ${v}…`);
      // eslint-disable-next-line no-await-in-loop
      const ok = await tryOne(v);
      if (ok) {
        success = true;
        break;
      }
    }

    if (!success) {
      this.renderImportResult(
        false,
        "Import échoué après 6 variantes. Vérifie les logs de la console et du serveur."
      );
    }
  }

  private renderImportProgressMessage(msg: string) {
    try {
      el<HTMLDivElement>("#importProgressLog", this.root).textContent = msg;
    } catch {}
  }

  private renderImportResult(ok: boolean, data: any) {
    const box = el<HTMLDivElement>("#importResult", this.root);
    box.innerHTML = ok
      ? `<div class="ok">✅ Import réussi</div><pre>${JSON.stringify(
          data,
          null,
          2
        )}</pre>`
      : `<div class="err">❌ Erreur lors de l'import</div><pre>${String(
          data
        )}</pre>`;
    this.goto(5);
  }
}

/* =========================
   ###### Bootstrapping ######
   ========================= */

export function bootImportWizardV3(apiBase?: string): ImportBulkWizardV3 | null {
  // Cherche d'abord importWizardRoot, puis importBulkWizard (compatibilité)
  let root = document.getElementById("importWizardRoot");
  if (!root) {
    root = document.getElementById("importBulkWizard");
  }
  if (!root) {
    console.error("[WZ3] #importWizardRoot ou #importBulkWizard introuvable");
    return null;
  }
  
  // Garder caché au départ (sera ouvert par open())
  root.style.display = "none";
  
  const wizard = new ImportBulkWizardV3(root, apiBase);
  log("Wizard V3 initialisé");
  return wizard;
}
