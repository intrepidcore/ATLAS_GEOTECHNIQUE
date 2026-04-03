
| Catégorie                   | Paramètre / Essai                | Profondeur / Niveau | Valeurs extraites                           | Remarques / Références                 |
| :-------------------------- | :------------------------------- | :------------------ | :------------------------------------------ | :------------------------------------- |
| **1. POSITIONNEMENT (SIG)** | **Système de projection**        | -                   | **WGS 1984, UTM Zone 31 N**                 | Données pour projection cartographique |
|                             | **Sondage PD1**                  | -                   | Lat: 0684805 N ; Long: 0291455 E            | Pénétromètre dynamique                 |
|                             | **Sondage PD2**                  | -                   | Lat: 0684805 N ; Long: 0291443 E            | Pénétromètre dynamique                 |
|                             | **Sondage PD3**                  | -                   | Lat: 0684812 N ; Long: 0291434 E            | Pénétromètre dynamique                 |
|                             | **Sondage PD4**                  | -                   | Lat: 0684810 N ; Long: 0291449 E            | Pénétromètre dynamique                 |
|                             | **Puits de reconnaissance (P)**  | -                   | Lat: 0684808 N ; Long: 0291449 E            | Puits manuel                           |
| **2. STRATIGRAPHIE**        | **Coupe lithologique** (Puits P) | 0,00 – 0,45 m       | Terre végétale                              |                                        |
|                             |                                  | 0,45 – 2,00 m       | **Sable argileux rougeâtre**                |                                        |
| **3. HYDROLOGIE**           | **Nappe phréatique**             | Jusqu'à 8,00 m      | **Non détectée**                            | Observée en saison sèche (Déc. 2021)   |
| **4. ESSAIS IN-SITU**       | **Pénétromètre Lourd** (DPSH-B)  | Jusqu'à 8,00 m      | **Aucun refus observé**                     | Enfoncement continu sur 8m             |
|                             |                                  | 0,20 – 1,00 m       | $R_d$ moyen $\approx$ 2,95 MPa              | Résistance faible en surface           |
|                             |                                  | 1,20 – 8,00 m       | $R_d$ Min = **2,73 MPa**                    | Valeur plancher pour les calculs       |
|                             |                                  | 1,20 – 8,00 m       | $R_d$ Max = **10,76 MPa**                   | À 7,80m de profondeur                  |
| **5. LABORATOIRE**          | **Échantillon : Sable argileux** | 1,50 – 2,00 m       | $D_{max} = 2$ mm                            | Granulométrie (Tableau 6)              |
|                             |                                  |                     | Passants < 0,2 mm = 53,0 %                  |                                        |
|                             |                                  |                     | Passants < 80 µm = **41,2 %**               | Sol fin important                      |
|                             |                                  |                     | Teneur en eau (w) = 4,0 %                   |                                        |
|                             |                                  |                     | $w_L$ = 42 % ; $w_P$ = 20 % ; **IP = 22 %** | Limites d'Atterberg (Sol plastique)    |
| **6. CALCULS DE FONDATION** | **Profondeur d'ancrage (D)**     | $\geq$ 1,20 m       | **Ancrage recommandé**                      |                                        |
|                             | **Contrainte Admissible**        | $\geq$ 1,20 m       | **ELU = 0,14 MPa** (1,4 bar)                | Basé sur $R_{d Min}$                   |
|                             |                                  | $\geq$ 1,20 m       | **ELS = 0,09 MPa** (0,9 bar)                | Valeur pour le dimensionnement         |

### Analyse de cohérence pour SIG
Les coordonnées fournies dans le document (UTM 31N) sont cohérentes avec la zone de **Segbé / Lomé**. Si vous projetez ces points, vous constaterez qu'ils forment une emprise rectangulaire (environ 20m x 10m), ce qui correspond classiquement à l'implantation des fondations pour un bâtiment scolaire ou administratif de type immeuble.

**Comparaison avec les autres sites :**
Ce site de Segbé présente la contrainte admissible la plus faible de votre série (0,09 MPa à l'ELS contre 0,73 MPa à Logoté), ce qui s'explique par la nature argileuse du sable et l'absence de refus rocheux à faible profondeur. Il faudra être vigilant sur la qualité du compactage des fonds de fouille.

SOURCE : atlas_reclone/data/extend/EXTEND_1/PENETRO Lourd-Site de SEGBE.pdf