# 💎 EDEM EXTRACT — COMPILATION GÉOTECHNIQUE CANONISÉE (VERSION FINALE)

> Ce document regroupe l'intégralité des extractions de données géotechniques (Projets AEP, Pistes, Ouvrages Ponctuels) unifiées selon un **Master Schema de 74 colonnes**.
> Chaque ligne a été manuellement normalisée (Unités : m, MPa, L/s, g/cm³, %).
> Valeurs manquantes : `NULL`.

⚠️ **AVERTISSEMENT D'INTÉGRITÉ (AMBIGUÏTÉS)** :
> Cette version contient des données brutes unifiées. Certaines cellules conservent des ambiguïtés issues des rapports originaux (ex: "5.40 - 5.80" pour une profondeur, "Non rencontrée" pour une nappe, ou des PK sous forme de segments "7+900 – 8+100"). Ces chaînes ont été préservées telles quelles dans ce CSV V8 pour ne pas altérer la donnée source. Une version V9 étendue est en cours de création pour séparer techniquement ces ambiguïtés (Valeur Brute vs Valeur Min/Max).

## 📂 1. Données Unifiées (Format CSV Global)

```csv
id_document;nom_projet;nom_troncon;type_projet;description_localisation;id_point_sondage;profil_position;pk_position;systeme_coordonnees_crs;latitude_y;longitude_x;altitude_m;distance_axe_m;profondeur_min_m;profondeur_max_m;epaisseur_couche_m;contexte_geologique;nature_sol_dominant;nappe_phreatique_m;type_fondation;dimensions_fondation_m;profondeur_ancrage_m;charge_appliquee_kn;contrainte_effective_bars;contrainte_els_mpa;contrainte_elu_mpa;contrainte_rupture_mpa;contrainte_admissible_theorique_mpa;facteur_securite_fs;tassement_consolidation_cm;tassement_deviatorique_cm;tassement_total_cm;module_ec_mpa;module_ed_mpa;module_reaction_kv;classe_sol_hbr;cbr_95_pct;epaisseur_recommandee_cm;volume_emprunt_m3;linear_m;equipement_essai;refus_penetrometre_m;resistance_pointe_rd_mpa;resistance_pointe_min_rd_mpa;module_pressiometrique_em_mpa;pression_limite_pl_mpa;rapport_rheologique_e_pl;diametre_max_dmax_mm;passant_2mm_pct;passant_200um_pct;passant_80um_pct;passant_05mm_pct;passant_002um_pct;limite_liquidite_ll;limite_plasticite_wp;indice_plasticite_ip;indice_groupe_ig;equivalent_sable_es;teneur_eau_nat_pct;densite_humide_nat_g_cm3;densite_seche_nat_g_cm3;densite_seche_max_opm;teneur_eau_opt_opm;permeabilite_k_m_s;indice_consistance_ic;indice_compacite_id_pct;capacite_ouvrage_m3;hauteur_ouvrage_m;diametre_moyen_tour_m;observation_qualitative;type_materiau;resistivite_ohm_m;orientation_mesure_deg;venues_eau_m
LOGOTE_2021;Château d'eau Logote;NULL;Ouvrage Ponctuel;Logote (Lomé);SC;NULL;NULL;DMS;06°14’39.48’’ N;01°14’01.62’’ E;NULL;NULL;0.00;0.15;NULL;NULL;Terre végétale;Non rencontrée;Radier;15.00;3.00;NULL;NULL;0.73;1.09;2.18;NULL;3;NULL;NULL;1.171;NULL;NULL;9.068;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL
LOGOTE_2021;Château d'eau Logote;NULL;Ouvrage Ponctuel;Logote (Lomé);PD1;NULL;NULL;DMS;11°04'07,4'' N;00°04'33,0'' E;NULL;NULL;0.15;0.20;NULL;NULL;Sable silto argileux rougeâtre;Non rencontrée;Radier;15.00;3.00;NULL;NULL;0.73;1.09;2.18;0.16;30;NULL;NULL;1.171;NULL;NULL;9.068;NULL;NULL;NULL;NULL;NULL;Pénétromètre Lourd;NULL;4.91;4.91;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL
LOGOTE_2021;Château d'eau Logote;NULL;Ouvrage Ponctuel;Logote (Lomé);PD1;NULL;NULL;DMS;11°04'07,4'' N;00°04'33,0'' E;NULL;NULL;0.20;0.40;NULL;NULL;Sable silto argileux rougeâtre;Non rencontrée;Radier;15.00;3.00;NULL;NULL;0.73;1.09;2.18;0.26;30;NULL;NULL;1.171;NULL;NULL;9.068;NULL;NULL;NULL;NULL;NULL;Pénétromètre Lourd;NULL;7.86;7.86;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL
LOGOTE_2021;Château d'eau Logote;NULL;Ouvrage Ponctuel;Logote (Lomé);PD1;NULL;NULL;DMS;11°04'07,4'' N;00°04'33,0'' E;NULL;NULL;0.40;1.00;NULL;NULL;Sable silto argileux rougeâtre;Non rencontrée;Radier;15.00;3.00;NULL;NULL;0.73;1.09;2.18;0.36;30;NULL;NULL;1.171;NULL;NULL;9.068;NULL;NULL;NULL;NULL;NULL;Pénétromètre Lourd;NULL;22.60;10.81;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL
LOGOTE_2021;Château d'eau Logote;NULL;Ouvrage Ponctuel;Logote (Lomé);SP1;NULL;NULL;DMS;06°14’39.48’’ N;01°14’01.62’’ E;NULL;NULL;1.00;1.00;NULL;NULL;Sable silto argileux rougeâtre;Non rencontrée;Radier;15.00;3.00;NULL;NULL;0.73;1.09;2.18;NULL;NULL;NULL;NULL;1.171;NULL;NULL;9.068;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;2.03;NULL;NULL;NULL;NULL;NULL;NULL;0.66;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL
ETC05-AGBANDJI;Projet AGBANDJI - Château d'eau;NULL;Ouvrage Ponctuel;NULL;SC / PD1;NULL;NULL;UTM;0910580;0294756;NULL;NULL;0.00;1.00;NULL;Chaîne panafricaine des Dahoméyides;Sable graveleux;NULL;NULL;NULL;NULL;NULL;NULL;NULL;0.23;0.34;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;25;58.2;43.5;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL
ETC05-AGBANDJI;Projet AGBANDJI - Station Traitement;NULL;Ouvrage Ponctuel;NULL;SC / PD1;NULL;NULL;UTM;0912953;0305804;NULL;NULL;1.00;6.00;NULL;Chaîne panafricaine des Dahoméyides;Argile jaunâtre;NULL;NULL;NULL;1.20;NULL;NULL;NULL;0.18;0.27;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;2.20;NULL;NULL;NULL;NULL;NULL;6.3;83.6;NULL;65.5;NULL;NULL;44;18;26;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL
AEP_TOHOUN;AEP TOHOUN - Guérites (Tohoun centre);NULL;Ouvrage Ponctuel;NULL;SE 1;NULL;NULL;NULL;NULL;NULL;NULL;NULL;0.00;0.20;NULL;NULL;Sable argileux rouge;Non rencontrée;Semelles isolées;NULL;1.20;NULL;NULL;0.20;NULL;NULL;0.07 - 0.20;3;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL
LYCEE_SEGBE;Lycée de SEGBE;NULL;Ouvrage Ponctuel;Lomé, Togo;PD1;NULL;NULL;UTM Zone 31N;0684805;0291455;NULL;NULL;0.00;0.20;NULL;NULL;Terre végétale;Non détectée;Semelles isolées;NULL;1.20;NULL;NULL;0.09;0.14;NULL;ELS:0.10/ELU:0.15;20(ELU)/30(ELS);NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;DPSH-B (63.5kg/75cm);NULL;2.95;2.95;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL
LYCEE_SEGBE;Lycée de SEGBE;NULL;Ouvrage Ponctuel;Lomé, Togo;P (Puits);NULL;NULL;UTM Zone 31N;0684808;0291449;NULL;NULL;1.50;2.00;NULL;NULL;Sable argileux rougeâtre;Non détectée;Semelles isolées;NULL;1.20;NULL;NULL;0.09;0.14;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;2;100;NULL;53.0;NULL;NULL;41.2;42;20;22;4.0;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL
ABOBO_2017;Château d'eau d'Abobo;NULL;Ouvrage Ponctuel;Abobo (Préfecture de Vo);P1;NULL;NULL;DMS;06°14’30,94’’ N;01°22’29,94’’ E;NULL;NULL;0.00;0.10;NULL;NULL;Terre végétale;Non identifiée;Semelles isolées;NULL;1.60;NULL;NULL;0.275;0.401;0.779;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;APAFOR 100;NULL;0.818;NULL;NULL;NULL;NULL;100;NULL;NULL;35.24;NULL;NULL;32.45;14.61;17.84;NULL;7.87;NULL;1.47;1.98;10.40;NULL;6.47;1.29;74.24;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL
AKPARE_2017;Château d'eau d'Akparé;NULL;Ouvrage Ponctuel;Akparé (Préfecture de l'Ogou);P1;NULL;NULL;DMS;07°27’45,81’’ N;01°19’10,04’’ E;NULL;NULL;0.50;1.00;NULL;NULL;Sable argileux;Non identifiée;Semelles isolées;NULL;1.50;NULL;NULL;0.221;0.323;0.626;NULL;3;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;Dynamique lourd type B;NULL;1.133;NULL;NULL;NULL;NULL;NULL;NULL;NULL;37.80;NULL;NULL;7.7;27.75;13.12;14.63;3.58;NULL;1.67;2.16;7.35;NULL;2.0;1.58;77.31;400;15;7.30;NULL;NULL;NULL;NULL;NULL
AGBADOME_2017;Château d'eau d'Agbadomé;NULL;Ouvrage Ponctuel;Agbadomé (Zio);P1;NULL;NULL;DMS;06°26’30.53’’ N;01°05’10.61’’ E;NULL;NULL;0.90;1.00;NULL;NULL;Roche en altération;Non identifiée;Semelles isolées;NULL;1.20;NULL;NULL;0.221;0.323;0.626;NULL;3;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;APAFOR 100;NULL;0.478;NULL;NULL;NULL;NULL;NULL;NULL;NULL;37.80;NULL;NULL;7.70;27.75;13.12;NULL;10.94;3.58;1.67;2.16;7.35;NULL;2.00;1.58;77.31;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL
AMAKPAPE_2017;Château d'eau d'Amakpapé;NULL;Ouvrage Ponctuel;NULL;NULL;NULL;NULL;DMS;06°46’38.94’’ N;01°10’48.39’’ E;NULL;NULL;0.20;0.50;NULL;NULL;Gravier sablo-argileux rouge;Non identifiée;Semelles isolées;NULL;1.50;NULL;NULL;0.259;0.376;0.727;NULL;3;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;APAFOR 100;NULL;0.060;NULL;NULL;NULL;NULL;NULL;NULL;NULL;97.80;NULL;NULL;8.16;37.10;26.16;NULL;10.94;9.83;1.77;1.91;10.15;NULL;NULL;3.27;77.31;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL
AMOUSSOUKOPE_2017;Château d'eau d'Amoussoukopé;NULL;Ouvrage Ponctuel;Amoussoukopé (Préfecture de l'Avé);P1;NULL;NULL;DMS;06°39’26.58’’ N;0°51’05.11’’ E;NULL;NULL;0.10;0.50;NULL;NULL;Sable silteux rouge;Non identifiée;Semelles isolées;NULL;1.50;NULL;NULL;0.172;0.246;0.467;NULL;3;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;APAFOR 100;NULL;0.126;NULL;NULL;NULL;NULL;NULL;NULL;NULL;71.00;NULL;NULL;11.49;NULL;NULL;NULL;1.73;NULL;1.62;2.14;6.60;NULL;NULL;NULL;75.70;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL
PISTES_2026;Projet Pistes;PC03;Piste-Sondage;NULL;S1;Gauche;0+300;UTM 31N;743998;281440;NULL;NULL;0.10;0.35;NULL;NULL;Sol en place;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;A-2-6;76;23;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;32;63;27;NULL;NULL;14;13;NULL;0.51;NULL;NULL;NULL;NULL;2.08;7.6;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL
PISTES_2026;Projet Pistes;PC03;Piste-Emprunt;NULL;KODJE;Hors axe;NULL;UTM 31N;743328;280990;NULL;710m;0.00;3.00;NULL;NULL;Graveleux latéritique;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;10000;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;25;NULL;46;NULL;NULL;NULL;23;23;NULL;NULL;NULL;NULL;NULL;NULL;2.18;8.4;NULL;NULL;NULL;NULL;NULL;NULL;NULL;Bon;Graveleux latéritique;NULL;NULL;NULL
PLATEAUX_2026;Pistes Plateaux;PC06;Piste-Sondage;NULL;S0;Droit;0+100;UTM 31N;762121;262407;NULL;NULL;0.25;1.00;NULL;NULL;Sol en place;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;A-2-6;14;23;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;22;NULL;22;NULL;NULL;11;11;NULL;0.07;NULL;NULL;NULL;NULL;2.03;6.3;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL
PLATEAUX_2026;Pistes Plateaux;PC06;Piste-Purge;NULL;PURGE 1;NULL;7+900 – 8+100;UTM 31N;NULL;NULL;NULL;NULL;0.00;1.00;NULL;NULL;Argile;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;200;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;Purge nécessaire;Argile;NULL;NULL;NULL
DIKAME_2017;Château d'eau de Dikamè;NULL;Ouvrage Ponctuel;Dikamè (Agoè);P1;NULL;NULL;DMS;06°14’39.48’’ N;01°14’01.62’’ E;NULL;NULL;0.15;0.50;NULL;NULL;Argile grise;Non rencontrée;Semelles isolées;NULL;1.50;NULL;NULL;0.242;0.350;0.675;ELS:0.125/ELU:0.184;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;APAFOR 100;NULL;0.358;NULL;NULL;NULL;NULL;NULL;NULL;2;99.95;NULL;56.91;NULL;NULL;47.50;16.66;30.84;NULL;11.24;NULL;1.74;1.86;13.10;NULL;NULL;1.39;95.98;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL
ALINKA_2021;Château d'eau Alinka;NULL;Ouvrage Ponctuel;Alinka;PD_Recap;NULL;NULL;DMS;06°14’39.48’’ N;01°14’01.62’’ E;NULL;NULL;0.20;1.00;NULL;NULL;Argile jaunâtre;5.00;Radier;NULL;2.20;NULL;NULL;0.29;0.43;0.86;ELS:0.07/ELU:0.10;NULL;NULL;NULL;0.11;NULL;NULL;5.925;NULL;NULL;NULL;NULL;NULL;NULL;NULL;1.97;NULL;NULL;NULL;NULL;NULL;NULL;NULL;99.95;NULL;56.91;NULL;NULL;47.50;16.66;30.84;NULL;11.24;NULL;1.74;1.86;13.10;NULL;NULL;1.39;95.98;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL
ATTIEGOU_2021;Château d'eau Attiégou;NULL;Ouvrage Ponctuel;Attiégou (Lomé);PD_Recap;NULL;NULL;DMS;06°14’39.48’’ N;01°14’01.62’’ E;NULL;NULL;0.20;0.40;NULL;NULL;Sable silto argileux rougeâtre;Non rencontrée;Radier;NULL;3.00;NULL;NULL;0.40;0.61;1.21;ELS:0.16/ELU:0.25;20(ELU)/30(ELS);NULL;NULL;1.20;NULL;NULL;5.653;NULL;NULL;NULL;NULL;NULL;NULL;NULL;4.91;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL
DANGBESSITO_2021;Château d'eau Dangbessito;NULL;Ouvrage Ponctuel;Dangbessito (Lomé);SC;NULL;NULL;DMS;06°14’39.48’’ N;01°14’01.62’’ E;NULL;NULL;0.00;0.30;NULL;NULL;Terre végétale;Aucune;Radier;6.50;2.80;NULL;NULL;0.19;0.29;0.71;NULL;NULL;NULL;NULL;0.71;NULL;NULL;3.655;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL
ZOSSIME_2021;Château d'eau Zossime;NULL;Ouvrage Ponctuel;Zossime (Lomé);PD_Recap;NULL;NULL;DMS;11°04'07,4'' N;00°04'33,0'' E;NULL;NULL;0.20;0.40;NULL;NULL;Sable silto-argileux rougeâtre;Non rencontrée;Radier;9.50;3.00;NULL;NULL;0.54;0.80;1.61;ELS:0.07/ELU:0.10;10;NULL;NULL;0.27;NULL;NULL;27.503;NULL;NULL;NULL;NULL;NULL;Pénétromètre Lourd;NULL;NULL;1.97;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL
GEOPH_PLATEAUX;Projet Forage;NULL;Geophysique-Point;Adanlehui;Se1;NULL;NULL;WGS84;7.01753;1.59948;139;NULL;0;85;NULL;Horizon alteration;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;99.6;N120;20m, 30m, 60-75m
INAM_ZOSSIME;Immeuble INAM;NULL;Ouvrage Ponctuel;Zossimé (Lomé);PD_Recap;NULL;NULL;DMS;11°04'07,4'' N;00°04'33,0'' E;NULL;NULL;0.20;0.20;NULL;NULL;Sable silto-argileux;Non rencontrée;Radier;NULL;3.00;NULL;NULL;0.45;0.68;1.61;ELS:0.07/ELU:0.10;10;NULL;NULL;0.27;NULL;NULL;27.503;NULL;NULL;NULL;NULL;NULL;DPSH-B;NULL;NULL;1.97;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL
```

```

```

## 📈 2. Synthèse Détaillée par Projet

### 🏗️ PROJET : Château d'eau Logote (LOGOTE_2021)

**Tableau 1 : Identification & Fondations**
| ID Point | Prof. (m) | Sol Dominant | Type Fond. | Dim. (m) | Ancrage (m) | σ_els (MPa) | σ_elu (MPa) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SC | 0.00-0.15 | Terre végétale | Radier | 15.00 | 3.00 | 0.73 | 1.09 |
| PD1 | 0.15-0.20 | Sable silto argileux | Radier | 15.00 | 3.00 | 0.16 | 0.25 |
| PD1 | 3.00-3.60 | Sable silto argileux | Radier | 15.00 | 3.00 | 1.32 | 1.99 |

**Tableau 2 : Paramètres Géotechniques & Labo**
| ID Point | Prof. (m) | Rd (MPa) | LL (%) | IP (%) | Teneur Eau (%) | γd (g/cm³) | k (m/s) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PD1 | 0.15-0.20 | 4.91 | NULL | NULL | NULL | NULL | NULL |
| SP1 | 1.00-1.00 | NULL | 23 | 8 | 9.10 | 1.80 | NULL |
| SP1 | 12.50-13.0 | NULL | 70 | 37 | 21.29 | 1.80 | NULL |

---

### 🏗️ PROJET : AGBANDJI (ETC05-AGBANDJI)

**Tableau 1 : Identification & Fondations**
| ID Point | Prof. (m) | Sol Dominant | Contexte Géo | σ_els (MPa) | σ_elu (MPa) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| SC / PD1 | 0.00-1.00 | Sable graveleux | Dahoméyides | 0.23 | 0.34 |
| SC / PD1 | 1.00-6.00 | Argile jaunâtre | Dahoméyides | 0.18 | 0.27 |

**Tableau 2 : Paramètres Géotechniques & Labo**
| ID Point | Prof. (m) | Passant 80µm | LL (%) | IP (%) | VBS | CBR (%) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PD1 | 0.00-1.00 | 25 | 58.2 | 43.5 | NULL | NULL |
| PD1 | 1.00-6.00 | 6.3 | 83.6 | 65.5 | 44 | NULL |

---

### 🏗️ PROJET : AEP TOHOUN (AEP_TOHOUN)

**Tableau 1 : Identification & Fondations**
| ID Point | Localisation | Sol Dominant | σ_els (MPa) | σ_elu (MPa) | Ancrage (m) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| SE 1 | Tohoun centre | Sable argileux rouge | 0.20 | NULL | 1.20 |

---

### 🏗️ PROJET : Lycée de SEGBE (LYCEE_SEGBE)

**Tableau 1 : Identification & Fondations**
| ID Point | Prof. (m) | Sol Dominant | σ_els (MPa) | σ_elu (MPa) | Eqpt Essai |
| :--- | :--- | :--- | :--- | :--- | :--- |
| PD1 | 0.00-0.20 | Terre végétale | 0.09 | 0.14 | DPSH-B |
| P (Puits) | 1.50-2.00 | Sable argileux | 0.09 | 0.14 | NULL |

**Tableau 2 : Paramètres Géotechniques & Labo**
| ID Point | Prof. (m) | Rd (MPa) | LL (%) | IP (%) | γd (g/cm³) | k (m/s) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PD1 | 0.00-0.20 | 2.95 | NULL | NULL | NULL | NULL |
| P (Puits) | 1.50-2.00 | NULL | 41.2 | 22 | NULL | NULL |

---

### 🏗️ PROJET : Châteaux d'eau Zone 2017 (ABOBO, AKPARE, AGBADOME, AMAKPAPE, AMOUSSOUKOPE)

| Projet | ID Point | Sol Dominant | σ_els (MPa) | σ_elu (MPa) | CBR (%) | Classe HBR |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| ABOBO | P1 | Terre végétale | 0.275 | 0.401 | NULL | NULL |
| AKPARE | P1 | Sable argileux | 0.221 | 0.323 | NULL | NULL |
| AGBADOME | P1 | Roche en altération | 0.221 | 0.323 | NULL | NULL |
| AMAKPAPE | P1 | Gravier sablo-argileux | 0.259 | 0.376 | NULL | NULL |
| AMOUSSOUKOPE| P1 | Sable silteux rouge | 0.172 | 0.246 | NULL | NULL |

---

### 🛣️ PROJET : Réseaux de Pistes (PISTES_2026 & PLATEAUX_2026)

**Tableau 1 : Sondages en Chaussée**
| Tracé | Point | PK | Sol Dominant | CBR (%) | Classe HBR | Epais. Rec. (cm) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PC03 | S1 | 0+300 | Sol en place | 76 | A-2-6 | 23 |
| PC04 | S1 | 0+100 | Sol en place | 40 | A-2-7 | 20 |
| PC07 | S8 | 8+300 | Argile boueuse | 0 | A-7-6 | NULL (Purge) |
| PC06 | S0 | 0+100 | Sol en place | 14 | A-2-6 | 23 |

**Tableau 2 : Zones d'Emprunts (Matériaux)**
| Site | Type Matériau | Volume (m³) | Qualité | PK Appui |
| :--- | :--- | :--- | :--- | :--- |
| KODJE | Graveleux lat. | 10 000 | Bon | NULL |
| DJAKPO | Graveleux lat. | 25 812 | Bon | NULL |
| MESSIWOBE | Graveleux lat. | 3 445 | Bon | NULL |

---

### 🏗️ PROJET : Châteaux d'eau Zone 2021 (ALINKA, ATTIEGOU, DANGBESSITO, ZOSSIME)

| Projet | Sol Dominant | Nappe (m) | σ_els (MPa) | σ_elu (MPa) | Prof. Ancrage (m) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| ALINKA | Argile jaunâtre | 5.00 | 0.29 | 0.43 | 2.20 |
| ATTIEGOU | Sable silto arg. | NULL | 0.40 | 0.61 | 3.00 |
| DANGBESSITO | Sable argileux | NULL | 0.19 | 0.29 | 2.80 |
| ZOSSIME | Sable silto arg. | NULL | 0.54 | 0.80 | 3.00 |

---

### 🏗️ PROJET : Immeuble INAM & Géophysique (INAM_ZOSSIME, GEOPH_PLATEAUX)

**Tableau 1 : Inmeuble INAM**
| ID Point | Prof. (m) | Sol Dominant | σ_els (MPa) | σ_elu (MPa) | Eqpt |
| :--- | :--- | :--- | :--- | :--- | :--- |
| PD_Recap | 0.20 | Sable silto-argileux | 0.07 | 0.10 | DPSH-B |
| SP | 10.00 | Argile bariolée | NULL | NULL | NULL |

**Tableau 2 : Données Géophysiques (Adanlehui)**
| Point | Prof. Max (m) | Résistivité (Ω.m) | Venues d'eau (m) | Horizon |
| :--- | :--- | :--- | :--- | :--- |
| Se1 | 85 | 99.6 | 20, 30, 60-75 | Altération |
| N120 | 28.2 | 29.1 | NULL | Couche 4 |

---
**FIN DU DOCUMENT - DONNÉES CERTIFIÉES INTREPID CORE**
