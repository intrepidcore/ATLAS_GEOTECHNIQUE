# 💎 TREC EXTRACT — COMPILATION GÉOTECHNIQUE V9 (VERSION FINALE ENRICHIE)

> Ce document constitue la version de référence pour l'ingestion de données dans **Atlas**.
> **Règle d'or V9 :** Séparation technique entre la donnée brute textuelle (`*_brut`) et la donnée numérique extraite (`_min`, `_max`).
> Unités : m, MPa, g/cm³, %. Valeurs manquantes : `NULL`.

## 📂 1. Données V9 Unifiées (Format CSV Global)

```csv
id_document;nom_projet;type_projet;id_point_sondage;pk_brut;pk_debut;pk_fin;coord_brute;lat_y_dec;lon_x_dec;prof_brute_m;prof_min_m;prof_max_m;nature_sol_brute;nappe_remarque;nappe_phreatique_m;rd_brut;rd_mpa_min;rd_mpa_max;contrainte_els_brute;contrainte_els_mpa;cbr_brut;cbr_95_pct_min;cbr_95_pct_max;observation_qualit
BADJA_2024;VOIRIE DE KOVIÉ;Emprunt;Sondage 1;NULL;NULL;NULL;NULL;NULL;NULL;0,25 - 1 m;0.25;1.00;Graveleux latéritique;NULL;NULL;NULL;NULL;NULL;NULL;NULL;53;53.0;53.0;Vérifié Multimodal
BADJA_2024;VOIRIE DE KOVIÉ;Emprunt;Sondage 2;NULL;NULL;NULL;NULL;NULL;NULL;0,25 - 1 m;0.25;1.00;Graveleux latéritique;NULL;NULL;NULL;NULL;NULL;NULL;NULL;51;51.0;51.0;Vérifié Multimodal
BADJA_2024;VOIRIE DE KOVIÉ;Emprunt;Sondage 3;NULL;NULL;NULL;NULL;NULL;NULL;0,30 - 1 m;0.30;1.00;Graveleux latéritique;NULL;NULL;NULL;NULL;NULL;NULL;NULL;55;55.0;55.0;Vérifié Multimodal
BADJA_2024;VOIRIE DE KOVIÉ;Emprunt;Sondage 4;NULL;NULL;NULL;NULL;NULL;NULL;0,30 - 1 m;0.30;1.00;Graveleux latéritique;NULL;NULL;NULL;NULL;NULL;NULL;NULL;53;53.0;53.0;Vérifié Multimodal
BADJA_2024;VOIRIE DE KOVIÉ;Emprunt;Sondage 5;NULL;NULL;NULL;NULL;NULL;NULL;0,25 - 1 m;0.25;1.00;Graveleux latéritique;NULL;NULL;NULL;NULL;NULL;NULL;NULL;48;48.0;48.0;Vérifié Multimodal
BADJA_2024;VOIRIE DE KOVIÉ;Emprunt;Sondage 6;NULL;NULL;NULL;NULL;NULL;NULL;0,25 - 1 m;0.25;1.00;Graveleux latéritique;NULL;NULL;NULL;NULL;NULL;NULL;NULL;48;48.0;48.0;Vérifié Multimodal
BAFILO_2024;AMÉNAGEMENT BAFILO;Piste;Sondage 1;NULL;NULL;NULL;NULL;NULL;NULL;0,50 - 1.50 m;0.50;1.50;Sable argileux jaunâtre;NULL;NULL;NULL;NULL;NULL;NULL;NULL;25;25.0;25.0;Vérifié Multimodal
BAFILO_2024;AMÉNAGEMENT BAFILO;Piste;Sondage 2;NULL;NULL;NULL;NULL;NULL;NULL;0,00 - 0.80 m;0.00;0.80;Terre végétale;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;PURGE NÉCESSAIRE
KANTE_2024;VOIRIE DE KANTÉ;Piste;S1;NULL;NULL;NULL;NULL;NULL;NULL;0,00 - 1,50 m;0.00;1.50;Sable silteux jaune;NULL;NULL;NULL;NULL;NULL;NULL;NULL;10;10.0;10.0;Vérifié Multimodal
KANTE_2024;VOIRIE DE KANTÉ;Piste;S2;NULL;NULL;NULL;NULL;NULL;NULL;0,00 - 1,50 m;0.00;1.50;Sable argileux rouge;NULL;NULL;NULL;NULL;NULL;NULL;NULL;15;15.0;15.0;Vérifié Multimodal
KANTE_2024;VOIRIE DE KANTÉ;Piste;S3;NULL;NULL;NULL;NULL;NULL;NULL;0,50 - 2,00 m;0.50;2.00;Graveleux latéritique;NULL;NULL;NULL;NULL;NULL;NULL;NULL;45;45.0;45.0;Vérifié Multimodal
SOKODE_2024;VOIRIE DE SOKODÉ;Piste;S1;NULL;NULL;NULL;NULL;NULL;NULL;0,00 - 1,20 m;0.00;1.20;Graveleux latéritique rouge;NULL;NULL;NULL;NULL;NULL;NULL;NULL;65;65.0;65.0;Vérifié Multimodal
SOKODE_2024;VOIRIE DE SOKODÉ;Piste;S2;NULL;NULL;NULL;NULL;NULL;NULL;0,00 - 2,50 m;0.00;2.50;Argile sableuse grise;NULL;NULL;NULL;NULL;NULL;NULL;NULL;02;02.0;02.0;ZONE DE PURGE - Vérifié
LOME_ZONE2_2024;VOIRIE DE LOMÉ;Piste;S1;NULL;NULL;NULL;NULL;NULL;NULL;0,00 - 1,00 m;0.00;1.00;Sable silteux fin jaune;NULL;NULL;NULL;NULL;NULL;NULL;NULL;12;12.0;12.0;Vérifié Multimodal
LOME_ZONE2_2024;VOIRIE DE LOMÉ;Piste;S2;NULL;NULL;NULL;NULL;NULL;NULL;0,00 - 1,50 m;0.00;1.50;Sable argileux rouge;NULL;NULL;NULL;NULL;NULL;NULL;NULL;18;18.0;18.0;Vérifié Multimodal
NOTSE_2024;EMPRUNTS DE NOTSE;Emprunt;S8;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;Graveleux latéritique;NULL;NULL;NULL;NULL;NULL;NULL;NULL;58;58.0;58.0;Vérifié Multimodal
NOTSE_2024;EMPRUNTS DE NOTSE;Emprunt;S21;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;Graveleux latéritique;NULL;NULL;NULL;NULL;NULL;NULL;NULL;38;38.0;38.0;Vérifié Multimodal
ETRA_TRONCON2;VOIRIE DIVERSE;Piste;S1;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;Argile compacte (PK 4+000);NULL;NULL;NULL;NULL;NULL;NULL;NULL;06;06.0;06.0;Extraction Automatique
ETRA_TRONCON2;VOIRIE DIVERSE;Piste;S3;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;Argile compacte (PK 5+000);NULL;NULL;NULL;NULL;NULL;NULL;NULL;06;06.0;06.0;Extraction Automatique
DZEMEKEY_2024;EMPRUNT DZEMEKEY;Emprunt;S1;NULL;NULL;NULL;NULL;NULL;NULL;0,15 - 1 m;0.15;1.00;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;50;50.0;50.0;Extraction Automatique
AMOU_OBLO_2024;VOIRIE AMOU OBLO;Piste;S1;NULL;NULL;NULL;NULL;NULL;NULL;0,40 - 1,00 m;0.40;1.00;Sable silteux;NULL;NULL;NULL;NULL;NULL;NULL;NULL;26;26.0;26.0;Extraction Automatique
```

---
**FIN DU DOCUMENT - DONNÉES HAUTE PRÉCISION V9**
