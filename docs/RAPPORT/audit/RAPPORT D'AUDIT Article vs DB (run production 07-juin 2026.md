## RAPPORT D'AUDIT : Article vs DB (run production 07-juin 2026)

---

### SECTION 1 — TABLE 4 `tab:loo_rmse` (H1 argilosité)

|Param|Col|Article actuel|DB 07-juin|Δ|Action|
|---|---|---|---|---|---|
|VBS|KED-H LOO|3,147|**2,933**|−6,8%|❌ corriger|
|VBS|Bloc optim.|+29,2%|**+38,7%**||❌ corriger|
|VBS|Bloc LOO|4,067|4,067|0%|✓|
|VBS|RK LOO|**2,378**|2,378|0%|✓|
|IP|KED-H LOO|**10,481**|**10,129**|−3,4%|❌ corriger|
|IP|Bloc optim.|+2,8%|**+6,4%**||❌ corriger|
|IP|Bloc LOO|10,776|10,776|0%|✓|
|IP|RK LOO|10,798|10,798|0%|✓|
|WL|KED-H LOO|**12,384**|**12,314**|−0,6%|❌ corriger|
|WL|Bloc optim.|+12,5%|**+13,1%**||❌ corriger|
|WL|Bloc LOO|13,929|13,929|0%|✓|
|WL|RK LOO|16,068|16,068|0%|✓|
|WP|KED-H LOO|**7,789**|**7,771**|−0,2%|❌ corriger|
|WP|Bloc optim.|+9,3%|**+9,5%**||❌ corriger|
|WP|Bloc LOO|8,510|8,510|0%|✓|
|WP|RK LOO|8,081|8,081|0%|✓|
|EG|KED-H LOO|1,692|**1,712**|+1,2%|❌ corriger|
|EG|Bloc optim.|+4,5%|**+3,3%**||❌ corriger|
|EG|Bloc LOO|1,768|1,768|0%|✓|
|EG|RK LOO|**1,179**|1,179|0%|✓|
|Score KED/RK||3/5 / 2/5|**3/5 / 2/5**||✓ inchangé|

---

### SECTION 2 — TABLE 5 `tab:best_model`

|Param|LOO article|LOO DB|Action|
|---|---|---|---|
|VBS|2,378 (RK)|2,378|✓|
|IP|**10,481** (KED)|**10,129**|❌ corriger|
|WL|**12,384** (KED)|**12,314**|❌ corriger|
|WP|**7,789** (KED)|**7,771**|❌ corriger|
|EG|**1,179** (RK)|1,179|✓|
|CBR|13,27|13,27|✓|
|Rd|3,45|3,449 ≈ 3,45|✓|
|γd|1,41|1,407 ≈ 1,41|✓|
|wopt|1,81|1,811 ≈ 1,81|✓|

---

### SECTION 3 — TABLE `tab:loo_v11` (portance/in-situ)

|Param|Article|DB|Action|
|---|---|---|---|
|CBR n=280* LOO=13,27||13,266 (05-juin)|✓|
|γd n=349, LOO=1,41||1,407|✓|
|wopt n=349, LOO=1,81||1,811|✓|
|Rd H1=3,45, H2=7,01, H3=14,16||3,449 / 7,013 / 14,164|✓|
|**Em H3 = 13,31**||**10,760** (05-juin)|❌ FAUX|
|**Pl H3 = 0,988**||**0,585** (05-juin)|❌ FAUX|

---

### SECTION 4 — ANNEXE `tab:loo_complet` (H1/H2/H3 × 5 params × 2 modèles)

|Param|Hz|Modèle|Article|DB (plus récent)|Date DB|Action|
|---|---|---|---|---|---|---|
|VBS|H1|KED|3,147|**2,933**|07-juin|❌|
|VBS|H1|RK|**2,378**|2,378|05-juin|✓|
|VBS|H2|KED|**3,204**|3,090|07-juin|❌|
|VBS|H2|RK|4,805|4,276|05-juin|❌|
|VBS|H3|KED|3,050|3,251|07-juin|❌|
|VBS|H3|RK|**2,875**|2,797|05-juin|❌|
|IP|H1|KED|**10,481**|10,129|07-juin|❌|
|IP|H1|RK|10,798|10,798|05-juin|✓|
|IP|H2|KED|9,702|9,991|07-juin|❌|
|IP|H2|RK|**9,351**|9,301|05-juin|❌|
|IP|H3|KED|9,483|9,774|07-juin|❌|
|IP|H3|RK|**7,050**|7,814|05-juin|❌|
|WL|H1|KED|**12,384**|12,314|07-juin|❌|
|WL|H1|RK|16,068|16,068|05-juin|✓|
|WL|H2|KED|11,302|11,300|07-juin|~✓ (−0,02%)|
|WL|H2|RK|25,352|24,969|05-juin|❌|
|WL|H3|KED|10,594|10,635|07-juin|❌|
|WL|H3|RK|**6,980**|7,121|05-juin|❌|
|WP|H1|KED|**7,789**|7,771|07-juin|❌|
|WP|H1|RK|8,081|8,081|05-juin|✓|
|WP|H2|KED|7,752|7,904|07-juin|❌|
|WP|H2|RK|13,535|13,317|05-juin|❌|
|WP|H3|KED|7,544|7,912|07-juin|❌|
|WP|H3|RK|**7,292**|7,237|05-juin|❌|
|EG|H1|KED|1,692|1,712|07-juin|❌|
|EG|H1|RK|**1,179**|1,179|05-juin|✓|
|EG|H2|KED|1,754|1,787|07-juin|❌|
|EG|H2|RK|1,975|1,964|05-juin|❌|
|EG|H3|KED|1,719|1,757|07-juin|❌|
|EG|H3|RK|**1,275**|1,267|05-juin|❌|

**Score global annexe — CHANGE :**

- Article : KED 8/15, RK 7/15
    
- DB prod : **KED 7/15, RK 8/15**
    
- Changement : IP/H2 passe de RK→RK (inchangé), mais avec les nouvelles valeurs :
    
    - VBS/H3 : KED=3,251 vs RK=2,797 → **RK gagne** (inchangé)
    - IP/H2 : KED=9,991 vs RK=9,301 → **RK gagne** (inchangé)
    - IP/H3 : KED=9,774 vs RK=7,814 → **RK gagne** (inchangé)
    
    Recalcul complet :
    

|#|Case|Article|DB|Vainqueur change ?|
|---|---|---|---|---|
|1|VBS/H1|RK 2,378|RK 2,378<KED 2,933|non|
|2|VBS/H2|KED 3,204|KED 3,090<RK 4,276|non|
|3|VBS/H3|RK 2,875|RK 2,797<KED 3,251|non|
|4|IP/H1|KED 10,481|KED 10,129<RK 10,798|non|
|5|IP/H2|RK 9,351|RK 9,301<KED 9,991|non|
|6|IP/H3|RK 7,050|RK 7,814<KED 9,774|non|
|7|WL/H1|KED 12,384|KED 12,314<RK 16,068|non|
|8|WL/H2|KED 11,302|KED 11,300<RK 24,969|non|
|9|WL/H3|RK 6,980|RK 7,121<KED 10,635|non|
|10|WP/H1|KED 7,789|KED 7,771<RK 8,081|non|
|11|WP/H2|KED 7,752|KED 7,904<RK 13,317|non|
|12|WP/H3|RK 7,292|RK 7,237<KED 7,912|non|
|13|EG/H1|RK 1,179|RK 1,179<KED 1,712|non|
|14|EG/H2|KED 1,754|KED 1,787<RK 1,964|non|
|15|EG/H3|RK 1,275|RK 1,267<KED 1,757|non|

**Score conservé : KED 8/15, RK 7/15** — vainqueurs identiques, seulement les valeurs changent. ✓ (footnote score à garder)

---

### SECTION 5 — ANNEXE `tab:best_model_ext` (meilleur modèle par param et horizon)

|Param|LOO article|LOO DB (05-juin RK)|Verdict|
|---|---|---|---|
|VBS H1|2,625|**2,378**|❌ FAUX (article = 02-juin)|
|IP H1|10,481|**10,129** (KED 07-juin)|❌|
|WL H1|12,384|**12,314** (KED 07-juin)|❌|
|WP H1|**5,349**|**8,081** (RK 05-juin)|❌ GRAVE (+51%)|
|EG H1|1,149|**1,179** (RK 05-juin)|❌|

---

### SECTION 6 — TABLE variance `tab:variance`

|Param|KED art.|KED DB|RK art.|RK DB|Fusion art.|Fusion DB|Réd art.|Réd DB|
|---|---|---|---|---|---|---|---|---|
|VBS|12,45|**11,85**|10,60|**10,89**|5,73|**5,68**|45,9%|**47,8%**|
|IP|90,99|**89,39**|79,87|**78,27**|42,33|**41,72**|47,0%|**46,7%**|
|WL|174,15|**151,40**|140,36|**130,60**|77,63|**70,22**|44,7%|**46,2%**|
|WP|54,54|**51,09**|60,37|**58,36**|28,70|**27,22**|47,4%|**46,7%**|
|EG|2,68|**2,82**|2,55|**2,53**|1,30|**1,33**|48,8%|**47,3%**|
|**Moy.**|||||||**47,9%**|**46,9%**|

Toutes valeurs fausses. Moyenne → 46,9% ± 0,6% (art. dit 47,9% ±1,5%).

---

### SECTION 7 — SECTION MTGP (texte corps + abstract)

|Valeur|Article actuel|Recalcul DB 07-juin KED|
|---|---|---|
|IP gain|−15,3% (8,877 vs 10,481)|**−12,4%** (8,877 vs **10,129**)|
|WL gain|−7,8% (11,413 vs 12,384)|**−7,3%** (11,413 vs **12,314**)|
|EG gain|−2,7% (1,647 vs 1,692)|**−3,8%** (1,647 vs **1,712**)|
|WP perte|+14,3% (8,903 vs 7,789)|**+14,6%** (8,903 vs **7,771**)|

Abstract FR ligne 129 : "IP (−15,3%) et WL (−7,8%)" → à corriger.

---

### SECTION 8 — ABSTRACT (FR et EN)

|Valeur|Article actuel|DB prod|Verdict|
|---|---|---|---|
|LOO-RMSE VBS H1 (EN)|3,147 g/100g|**2,933**|❌|
|LOO-RMSE CBR H1 (EN)|**16,14%**|**13,27%**|❌ GRAVE|
|Optimisme LOO VBS FR+EN|+29,2%|**+38,7%**|❌|
|Optimisme Atterberg FR|~+10%|~+10,3% (moy. IP/WL/WP)|~OK|
|BLUP réduction var.|47,9% ±1,5%|**46,9% ±0,6%**|❌|
|MTGP IP gain (FR)|−15,3%|**−12,4%**|❌|
|MTGP WL gain (FR)|−7,8%|**−7,3%**|❌|
|VfS gain vs KED|−11,4% (vs 3,147)|**−4,9%** (vs 2,933)|❌ recalculer|

Note VfS : 2,788 / 2,933 = gain de (2,933−2,788)/2,933 = **4,9%** pas 11,4%. Important.

---

### SECTION 9 — Figure 06 caption (`fig:loo_scatter`)

Ligne 968 : `n=113, RMSE=3,147 (KED), RMSE=2,378 (RK)`

- RMSE KED → **2,933**
- n → **111** (run 07-juin) ou **113** (bloc spatial) — incohérence à résoudre

---

### SECTION 10 — SGS table `tab:sgs`

|Param|P10 art.|P10 DB|P50 art.|P50 DB|P90 art.|P90 DB|Verdict|
|---|---|---|---|---|---|---|---|
|VBS|2,5|**1,54**|4,0|**3,82**|6,8|**8,20**|❌ valeurs différentes|
|IP|14,4|**9,97**|21,7|**20,06**|31,2|**30,07**|❌|
|WL|30,8|**27,0**|39,4|39,6 ✓|49,6|**52,8**|❌ partiel|
|WP|14,0|**12,6**|18,7|**19,6**|24,6|**27,6**|❌|
|EG|3,1|**2,10**|4,2|**3,77**|5,7|**6,34**|❌|
|CBR|10,9|10,94 ✓|26,2|26,19 ✓|62,3|62,32 ✓|**✓**|

**CBR seul correspond** — les autres divergent. Source SGS dans l'article ≠ run 07-juin pour VBS/IP/WL/WP/EG.

---

### SECTION 11 — VfS-PLS section (ligne 1080)

"LOO-RMSE = 2,788 < KED-H (**3,147**)" → KED-H doit être **2,933**

---

## QUESTIONS OUVERTES (décisions utilisateur)

**Q1 — n VBS : 111 ou 113 ?** Run KED 07-juin = n_train=111. Bloc spatial 07-juin = n_total=113. Écart de 2 points. Quelle valeur utiliser dans les captions (fig06, tab:loo_rmse note de bas) ? Cause de l'écart ?

**Q2 — γd RK : bug ou réel ?** Deux runs `gamma_d_rk_h1` du 07-juin : 0,119 et 1,193. Le second semble correct (similaire à KED=1,41). Le premier est clairement aberrant. Aucun impact sur l'article (RK gd non utilisé), mais bug pipeline à corriger.

**Q3 — Source SGS table article** SGS CBR ✓ (correspond DB 07-juin), mais VBS/IP/WL/WP/EG ne correspondent pas. D'où viennent les valeurs actuelles dans l'article (run antérieur ? requête différente ?) → corriger avec les valeurs DB 07-juin ou attendre un nouveau run SGS ?

**Q4 — MTGP : recalculer ou accepter hétérogénéité des n ?** Le MTGP (02-juin, n_IP=175) vs KED (07-juin, n_IP=121). Comparaison n hétérogène = méthodologiquement approximative. Options : (a) conserver comme LOO partiel (explicitement mentionné dans le texte comme "LOO partiel 50 points"), (b) relancer MTGP sur les 121 points du 07-juin.

**Q5 — Variance table `tab:variance` : corriger ou garder ancienne version ?** Les valeurs DB (05-juin fusion) diffèrent de l'article sur toutes les cellules. Aucune valeur ne correspond. La moyenne passe de 47,9% à 46,9%. Accepter la correction complète ?

**Q6 — Abstract EN : CBR LOO = 16,14%** Valeur complètement obsolète (run 01-juin). DB actuel = 13,27%. Corriger en 13,27% ?

**Q7 — VfS gain : 11,4% → 4,9% ?** Avec KED(VBS,H1) = 2,933, le gain VfS passe de 11,4% à 4,9%. Valeur nettement moins impressive. Impact sur le message principal. Confirmer avant correction.

**Q8 — Score global annexe** Vainqueurs identiques (score KED 8/15 conservé) — seulement les valeurs changent. Bonne nouvelle.

**Q9 — Em/Pl H3 : noter n=6 ?** DB: Em=10,760 (05-juin), Pl=0,585 (05-juin). Note actuelle dit n=26 zone Maritime. DB montre n=6 pour ces runs (très faible). Question méthodologique : faut-il garder ces valeurs ou les retirer entièrement de l'article ?

---

## RÉSUMÉ PRIORITÉS

**Blocant (faux dans le corps principal) :**

1. Tab.4 : VBS/IP/WL/WP/EG KED + % optimisme (5 valeurs KED + 5 %)
2. Tab.5 best_model : IP/WL/WP LOO
3. Tab.loo_v11 : Em H3 (13,31→10,76) + Pl H3 (0,988→0,585)
4. Abstract EN : CBR 16,14→13,27 + VBS 3,147→2,933 + optimisme 29,2%→38,7%
5. Abstract FR : optimisme 29,2%→38,7% + BLUP 47,9%→46,9% + MTGP gains
6. MTGP section : tous les % (IP: −15,3%→−12,4%, WL: −7,8%→−7,3%, EG: −2,7%→−3,8%, WP: +14,3%→+14,6%)

**Annexe (moins visible mais faux) :** 7. Tab.loo_complet : 24/30 valeurs à corriger 8. Tab.best_model_ext : VBS/IP/WL/WP/EG LOO H1 (tous faux) 9. Tab.variance : 20 valeurs + moyenne

**À décider avant correction :** 10. SGS table (Q3), VfS gain (Q7), n VBS 111/113 (Q1), Em/Pl retirer ou corriger (Q9)