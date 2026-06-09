# Checklist de Confiance Opérationnelle — Atlas Géotechnique Togo v1.0
## Guide d'utilisation pour les praticiens et ingénieurs

**Artefact M8** du plan de révision directeur  
*(POINTS_REVISION_PROCHAINE_ITERATION_V2.md §4.5)*

**Date** : 2026-06-07  
**Destinataire** : Ingénieurs géotechniciens, bureaux d'études, maîtres d'ouvrage

> *"Au lieu de donner une carte et une incertitude, dites : 'Sur les plateaux, fiez-vous à la carte VBS issue de la Fusion BLUP. À Kara, ne prenez aucune décision sans un sondage complémentaire, la marge d'erreur y est trop élevée.'"*
> — Directeur de thèse, Revue 1, 2026

---

## Principe de la Checklist

L'Atlas Géotechnique Togo n'est pas homogène. La qualité des prédictions varie fortement selon :
1. **La région** (Plateaux/Maritime dense vs Kara/Savanes clairsemé)
2. **Le paramètre** (VBS avec BLUP Fusion vs CBR avec KED seul)
3. **La situation géologique** (Vertisols Lama = risque de sous-estimation)

Cette checklist permet à tout utilisateur de déterminer rapidement le niveau de confiance applicable à sa situation et de décider si un sondage complémentaire est nécessaire.

---

## Guide d'utilisation — Version ASCII (pour l'article)

```
╔══════════════════════════════════════════════════════════════════════════╗
║      GUIDE D'UTILISATION — ATLAS GÉOTECHNIQUE TOGO v1.0                 ║
║      Checklist de Confiance Opérationnelle                               ║
╠═══════════════════════╦══════════════╦═════════════════════════════════╣
║ Zone                  ║ Paramètre    ║ Recommandation                  ║
╠═══════════════════════╬══════════════╬═════════════════════════════════╣
║ PLATEAUX + MARITIME   ║ VBS/IP/WL/WP ║ ✅ UTILISER DIRECTEMENT         ║
║ (n > 100)             ║              ║    BLUP Fusion, ±20% max        ║
║                       ║              ║    RMSE VBS ≈ 2.9 g/100g        ║
╠═══════════════════════╬══════════════╬═════════════════════════════════╣
║ PLATEAUX + MARITIME   ║ CBR / γd     ║ ⚠️ UTILISER AVEC PRÉCAUTION     ║
║                       ║              ║    KED seul (sans fusion BLUP)  ║
║                       ║              ║    Confirmer si CBR < 30%       ║
╠═══════════════════════╬══════════════╬═════════════════════════════════╣
║ CENTRALE              ║ VBS/IP/WL/WP ║ ⚠️ UTILISER AVEC PRÉCAUTION     ║
║ (n = 57)              ║              ║    Confirmer si VBS > 3 g/100g  ║
║                       ║              ║    RMSE estimé +30-50% vs Sud   ║
╠═══════════════════════╬══════════════╬═════════════════════════════════╣
║ KARA + SAVANES        ║ TOUS         ║ 🔴 NE PAS DÉCIDER SANS SONDAGE  ║
║ (n = 59, 0 GPS exact) ║              ║    Valeur = prédiction géol.    ║
║                       ║              ║    Incertitude non quantifiable ║
╠═══════════════════════╬══════════════╬═════════════════════════════════╣
║ PARTOUT               ║ Em / Pl      ║ 🔴 ILLUSTRATIF SEULEMENT        ║
║                       ║              ║    n=5 sondages uniques         ║
║                       ║              ║    Ne pas utiliser pour projet  ║
╠═══════════════════════╬══════════════╬═════════════════════════════════╣
║ DÉPRESSION de la LAMA ║ VBS / EG     ║ ⚠️ MAJORER DE +1σ_krigeage      ║
║ (Vertisols)           ║              ║    Lissage krigeage actif       ║
║                       ║              ║    VBS observé jusqu'à 18 g/100g║
║                       ║              ║    Carte peut sous-estimer      ║
╠═══════════════════════╬══════════════╬═════════════════════════════════╣
║ ZONES D'ALLUVIONS     ║ TOUS         ║ ⚠️ PROFIL VERTICAL DISCONTINU   ║
║ (3 267 mailles 11.1%) ║              ║    Signal surface ≠ profondeur  ║
║                       ║              ║    Confirmer par sondage H2/H3  ║
╚═══════════════════════╩══════════════╩═════════════════════════════════╝
```

---

## Tableau détaillé des niveaux de confiance

### Niveau VERT ✅ — Utilisation directe

| Zone | Paramètre | Méthode | RMSE H1 | N points | Raison |
|------|-----------|---------|---------|----------|--------|
| Plateaux | VBS | BLUP Fusion KED+RK | 2.93 | 135 | Données denses + 2 modèles |
| Maritime | IP/WL/WP | BLUP Fusion | 9.79/12.31/7.77 | 100-120 | Idem |
| Plateaux | EG | BLUP Fusion | 1.67 | 90 | Bonne couverture |

**Interprétation** : La fusion bayésienne KED+RK réduit la variance de 47-49% par rapport à KED seul. Dans ces zones avec données denses, l'incertitude est estimée à ±20% autour de la valeur cartographiée (PICP 95% visé).

### Niveau ORANGE ⚠️ — Utiliser avec précaution

| Situation | Paramètre | RMSE estimé | Recommandation |
|-----------|-----------|-------------|----------------|
| Zone Centrale (n=57) | VBS/IP/WL | +30-50% vs Sud | Confirmer valeurs > 3σ national |
| Partout | CBR/γd/w_opt | 13.3/1.4/1.8 (KED seul) | Confirmer CBR < 30% par essai local |
| Dépression Lama | VBS/EG | Lissage actif | Majorer de +1 écart-type krigeage |
| Zones alluviales | Tous | Profil incohérent | Vérifier H2 et H3 sur terrain |

**Action recommandée** : Toujours consulter la carte d'incertitude (variance de krigeage) fournie en couche séparée dans l'Atlas. Si σ_krigeage > 30% de la valeur prédite, effectuer au moins 1 sondage de vérification.

### Niveau ROUGE 🔴 — Ne pas utiliser sans sondage

| Situation | Paramètre | Raison |
|-----------|-----------|--------|
| Kara + Savanes (59 sondages, 0 GPS exact) | Tous | Prédiction entièrement géologique, aucun krigeage spatial réel |
| Em/Pl partout | Pressiomètre | n=5 sondages uniques (26 mesures sur 5 sites) |
| Zones blanches (préfectures < 5 sondages) | Tous | Voir carte de couverture |

---

## Tableau de couverture L1-L5 par paramètre (pour l'article)

### Artefact A6 — Tableau comparatif couverture des modèles

> **Ordre logique** : L1 (KED-H) → L2a (RK) → L2b (BLUP) → L3 (VfS, VBS uniquement) → L4 (MTGP) → L5 (SGS, incertitude)

| Paramètre | KED-H L1 | RK SCORPAN L2a | BLUP Fusion L2b | VfS L3 | MTGP L4 | SGS L5 | Confiance |
|-----------|---------|---------------|----------------|--------|---------|--------|-----------|
| **VBS** | ✅ H1/H2/H3 | ✅ H1/H2/H3 | ✅ 48% réd.var. | ✅ LOO=2.788 (-8.9% vs KED) | ✅ (RMSE>KED) | ✅ P10/P50/P90 | ⭐⭐⭐⭐⭐ |
| **IP** | ✅ H1/H2/H3 | ✅ H1/H2/H3 | ✅ | — | ✅ | 🟡 à lancer | ⭐⭐⭐⭐ |
| **WL** | ✅ H1/H2/H3 | ✅ H1/H2/H3 | ✅ | — | ✅ | 🟡 | ⭐⭐⭐⭐ |
| **WP** | ✅ H1/H2/H3 | ✅ H1/H2/H3 | ✅ | — | ✅ (marginal) | 🟡 | ⭐⭐⭐⭐ |
| **EG** | ✅ H1/H2/H3 | ✅ H1/H2/H3 | ✅ | — | ✅ | 🟡 | ⭐⭐⭐⭐ |
| **CBR_95** | ✅ H1 seul | ✅ H1 (avg=30.2%) | ✅ H1 (37% réd.var.) | — | ✅ H1 | ✅ P10=15.7% P50=28.5% P90=57.8% | ⭐⭐⭐⭐ |
| **γd_max** | ✅ H1 (g/cm³) | ✅ H1 bug /10 fixé | ✅ H1 (47.8% réd.var.) | — | ✅ (kN/m³) | — | ⭐⭐⭐ |
| **w_opt** | ✅ H1 seul | ✅ H1 (avg=10%) | ✅ H1 (48.1% réd.var.) | — | ✅ | — | ⭐⭐⭐ |
| **Rd_mpa** | ✅ H1/H2/H3 | ❌ n=38 marginal | ❌ | — | ❌ | 🟡 | ⭐⭐ |
| **Em_mpa** | ✅* illustr. | ❌ n=5 | ❌ | — | ❌ | ❌ | ⭐ |
| **Pl_mpa** | ✅* illustr. | ❌ n=5 | ❌ | — | ❌ | ❌ | ⭐ |

> **Mise à jour 2026-06-07** : BLUP portance (cbr_95, gamma_d, w_opt) calculé et validé. SGS cbr_95 calculé (50 réalisations, P10/P50/P90 stockés pour 29 407 mailles). Stationnarité WL/WP/EG confirmée (Moran I non significatif). Hétéroscédasticité N/S détectée pour WL (Levene p=0.039, décision hors roadmap documentée). PICP complet : VBS=1.000, IP=0.884, WL=0.892, WP=0.883, EG=0.951. **VfS L3 terminé** : PLS n=3, LOO-RMSE=2.788 (-8.9% vs KED=3.06), 24 077/29 407 mailles prédites, stockées dans atlas.maille_spectral_vfs. MTGP LOO-RMSE calculé : IP=9.493, WL=14.085, WP=7.697, EG=1.542 (EG seul améliore vs KED). Pipeline L1→L5 complet.

*\* = illustratif uniquement (n=5 sondages uniques)*

---

## Recommandations pour la campagne de sondage prioritaire

Zones à couvrir en priorité pour améliorer la confiance des modèles :

| Priorité | Zone | N sondages actuels | GPS exact | Besoin |
|----------|------|-------------------|-----------|--------|
| 🔴 P0 | Dankpen (Kara) | 0 | 0 | Min. 10 sondages avec GPS |
| 🔴 P0 | Kpendjal (Savanes) | ~2 | 0 | Min. 10 sondages avec GPS |
| 🟡 P1 | Tone (Savanes, Dapaong) | ~5 | 0 | Min. 8 sondages avec GPS |
| 🟡 P1 | Dépression Lama | 15 (estimé) | 3 | 10 sondages pressiomètre pour Em/Pl |
| 🟢 P2 | Plaine de l'Oti | 0 | 0 | Confirmer les zones "Oti/Lions/Mono" |

---

## Note pour l'article

**Section recommandée dans la Conclusion :**

> *"Pour faciliter l'utilisation opérationnelle des résultats, nous proposons une Checklist de Confiance Opérationnelle (Tableau Y) qui stratifie la fiabilité des prédictions selon la zone géographique, le paramètre et la méthode employée. Cette checklist distingue trois niveaux d'utilisation : (1) utilisation directe sans sondage supplémentaire pour les paramètres d'argilosité dans les régions Plateaux et Maritime, (2) utilisation sous réserve de vérification ponctuelle pour les paramètres de portance ou les zones de couverture modérée, et (3) interdiction d'utilisation sans sondage terrain pour les régions nord (Kara, Savanes) où les prédictions reposent exclusivement sur la dérive géologique. Ce guide vise à prévenir tout mauvais usage des cartes géotechniques nationales, en particulier dans les zones à fort enjeu de sécurité."*

---

*Artefact M8 — Créé le 2026-06-07*  
*Réponse à la recommandation §4.5 de la Revue directeur*
