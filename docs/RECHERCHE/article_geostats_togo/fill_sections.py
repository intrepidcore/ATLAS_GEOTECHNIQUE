"""Redige toutes les sections vides de main.tex."""
from pathlib import Path

f = Path(__file__).parent / "main.tex"
txt = f.read_text(encoding="utf-8")

PATCHES = [
    # ── 1. Resume covariables ────────────────────────────────────────────
    (
        "\t\\subsubsection{Résumé des covariables SCORPAN}\n\t\n\t\\begin{table}[htbp]",
        "\t\\subsubsection{Résumé des covariables SCORPAN}\n\n"
        "\tLe tableau~\\ref{tab:covariables} synthétise les douze covariables\n"
        "\tretenues dans le cadre SCORPAN. Elles sont classées en cinq\n"
        "\tcatégories~: relief~($R$), climatique~($C$), parental~($P$),\n"
        "\tsol~($S$) et position géographique~($N$).\n"
        "\tLeur couverture spatiale est quasi-totale\n"
        "\t(${}\\geq98{,}6$\\,\\% du territoire), garantissant qu'aucune maille\n"
        "\tde la grille nationale ne soit dépourvue de covariable.\n"
        "\tLes covariables de relief~(SRTM, 4/12) déterminent\n"
        "\tsimultanément le lessivage, l'accumulation et la saturation\n"
        "\thydrique~; les trois covariables climatiques capturent\n"
        "\tle gradient pluviométrique N-S, principal moteur de l'altération\n"
        "\tchimique à l'échelle du territoire.\n\n"
        "\t\\begin{table}[htbp]"
    ),
    # ── 2. Performance LOO-CV ────────────────────────────────────────────
    (
        "\t\\subsubsection{Performance LOO-CV comparative}\n\t\n\t\\begin{figure}[htbp]",
        "\t\\subsubsection{Performance LOO-CV comparative}\n\n"
        "\tLa figure~\\ref{fig:loo_rmse} et le tableau~\\ref{tab:loo_rmse}\n"
        "\tprésentent les LOO-RMSE obtenus pour les cinq paramètres\n"
        "\td'argilosité à l'horizon~H1, comparés entre KED-H, RK-SCORPAN\n"
        "\tet VfS-PLS. Le LOO-CV complet garantit que chaque prédiction\n"
        "\test réalisée sans connaissance de l'observation cible~:\n"
        "\tpour RK-SCORPAN, les coefficients Ridge $\\hat{\\bm{\\beta}}$\n"
        "\tet le variogramme des résidus sont ré-estimés à chaque exclusion,\n"
        "\tévitant une sous-estimation de l'erreur de 15--30\\,\\%.\n"
        "\tL'analyse porte sur 15~comparaisons directes (H1/H2/H3\n"
        "\t$\\times$ 5~paramètres)~; les résultats complets figurent\n"
        "\ten Annexe~\\ref{app:loo_complet}.\n\n"
        "\t\\begin{figure}[htbp]"
    ),
    # ── 3. Parametres portance ───────────────────────────────────────────
    (
        "\t\\subsubsection{Paramètres de portance et in-situ}\n\t\n\t\\begin{table}[htbp]",
        "\t\\subsubsection{Paramètres de portance et in-situ}\n\n"
        "\tLe tableau~\\ref{tab:loo_v11} présente les performances KED-H\n"
        "\tpour les six paramètres de portance, pour lesquels RK-SCORPAN\n"
        "\tn'est pas encore calibré.\n"
        "\tLes paramètres CBR\\,95\\%, $\\gamma_d$ et $w_{\\mathrm{opt}}$\n"
        "\tne disposent de mesures qu'à l'horizon~H1~: les campagnes\n"
        "\tProctor sont quasi-exclusivement réalisées en surface.\n"
        "\tLe pressiomètre ($E_m$, $P_l$) n'est disponible qu'à~H3\n"
        "\t($n=26$)~; ces valeurs sont présentées à titre indicatif.\n\n"
        "\t\\begin{table}[htbp]"
    ),
    # ── 4. Reduction variance ────────────────────────────────────────────
    (
        "\t\\subsubsection{Réduction de variance par Fusion Bayésienne}\n\t\n\t\\begin{table}[htbp]",
        "\t\\subsubsection{Réduction de variance par Fusion Bayésienne}\n\n"
        "\tLe tableau~\\ref{tab:variance} et la figure~\\ref{fig:variance}\n"
        "\tquantifient la réduction de variance induite par la Fusion BLUP\n"
        "\tsur les cinq paramètres d'argilosité à~H1.\n"
        "\tConformément à la propriété~\\eqref{eq:blup_var},\n"
        "\tla réduction est strictement positive dans \\textbf{100\\,\\%}\n"
        "\tdes mailles pour tous les paramètres~\\cite{chilesdelfiner2012}.\n"
        "\tLa valeur moyenne de 47{,}9\\,\\% est proche du maximum\n"
        "\tthéorique de 50\\,\\% (atteint quand\n"
        "\t$\\sigma^2_{\\KED}=\\sigma^2_{\\RK}$), confirmant que les deux\n"
        "\tmodèles ont des précisions comparables mais des structures\n"
        "\tspatiales complémentaires.\n\n"
        "\t\\begin{table}[htbp]"
    ),
    # ── 5. Cartographie nationale ────────────────────────────────────────
    (
        "\t\\subsubsection{Cartographie nationale}\n\t\n\t\\begin{table}[htbp]",
        "\t\\subsubsection{Cartographie nationale}\n\n"
        "\tLe tableau~\\ref{tab:predictions_grille} récapitule les\n"
        "\tstatistiques descriptives des prédictions sur la grille~H1.\n"
        "\tLa moyenne nationale prédite par KED-H\n"
        "\t($\\bar{Z}^*_{\\mathrm{VBS}}=3{,}65$~g/100g) est inférieure\n"
        "\tà la moyenne observée~(4{,}27~g/100g)~: le krigeage lisse\n"
        "\tles valeurs extrêmes (VBS~$>15$~g/100g des Vertisols),\n"
        "\tlocalisées et atténuées dans la prédiction régionalisée.\n"
        "\tLa Fusion BLUP produit une variance spatiale intermédiaire\n"
        "\t($\\sigma_{Z^*}=1{,}48$) entre KED-H~(1{,}36, lisse) et\n"
        "\tRK-SCORPAN~(2{,}20, variable), optimisant le compromis\n"
        "\tentre lissage et fidélité aux gradients déterministes.\n\n"
        "\t\\begin{table}[htbp]"
    ),
    # ── 6. Sensibilite variographique ────────────────────────────────────
    (
        "\t\\subsubsection{Sensibilité au modèle variographique}\n\t\n\t\\begin{table}[htbp]",
        "\t\\subsubsection{Sensibilité au modèle variographique}\n\n"
        "\tTout krigeage repose sur un modèle de covariance ajusté\n"
        "\taux données empiriques~\\cite{chilesdelfiner2012}.\n"
        "\tLe choix du modèle théorique~$\\gamma(h)$ constitue\n"
        "\tune source d'incertitude épistémique à quantifier.\n"
        "\tLe tableau~\\ref{tab:sensibilite_variogram} compare les\n"
        "\tLOO-RMSE pour quatre modèles courants (sphérique,\n"
        "\texponentiel, gaussien, Matérn~3/2) appliqués au VBS~H1.\n\n"
        "\t\\begin{table}[htbp]"
    ),
    # ── 7. Sensibilite taille echantillon ────────────────────────────────
    (
        "\t\\subsubsection{Sensibilité à la taille de l'échantillon}\n\t\n\t\\begin{figure}[htbp]",
        "\t\\subsubsection{Sensibilité à la taille de l'échantillon}\n\n"
        "\tLa figure~\\ref{fig:learning_curve} présente la courbe\n"
        "\td'apprentissage de KED-H et RK-SCORPAN pour VBS~H1,\n"
        "\tobtenue par sous-échantillonnage bootstrap~($B=50$\n"
        "\trépétitions). Cette analyse répond à une question\n"
        "\topérationnelle~: quelle est la valeur marginale d'un\n"
        "\tnouveau sondage ? Elle permet d'identifier le régime\n"
        "\tde saturation au-delà duquel l'ajout de données dans\n"
        "\tune zone déjà couverte ne réduit plus significativement\n"
        "\tl'erreur de prédiction.\n\n"
        "\t\\begin{figure}[htbp]"
    ),
    # ── 8. Influence Ridge ───────────────────────────────────────────────
    (
        "\t\\subsubsection{Influence du paramètre de régularisation}\n\t\n\t\\begin{table}[htbp]",
        "\t\\subsubsection{Influence du paramètre de régularisation}\n\n"
        "\tLa régularisation Ridge~($\\lambda_R$) contrôle le compromis\n"
        "\tentre fidélité aux données et stabilité des coefficients\n"
        "\ten présence de multicolinéarité entre covariables.\n"
        "\tLe tableau~\\ref{tab:sensibilite_ridge} compare trois\n"
        "\tvaleurs de~$\\lambda_R$ sur les prédictions RK-SCORPAN.\n"
        "\tLa sous-régularisation~($\\lambda_R=0{,}05$) amplifie\n"
        "\tles gradients spatiaux~($\\sigma_{Z^*}=2{,}41$)\n"
        "\tet génère des artefacts dans les zones extrapolouées~;\n"
        "\tla sur-régularisation~($\\lambda_R=1{,}00$) écrase\n"
        "\tles contrastes régionaux~($\\sigma_{Z^*}=1{,}85$)\n"
        "\tet sous-estime les zones à fort VBS~($>8$~g/100g)\n"
        "\tde $\\sim$16\\,\\%.\n"
        "\tL'optimum $\\lambda^*_R=0{,}18$, calibré par LOO-CV\n"
        "\tcomplet, minimise simultanément le RMSE et la\n"
        "\tvariance spatiale.\n\n"
        "\t\\begin{table}[htbp]"
    ),
    # ── 9. Performance par region ────────────────────────────────────────
    (
        "\t\\subsubsection{Performance par région administrative}\n\t\n\t\\begin{table}[htbp]",
        "\t\\subsubsection{Performance par région administrative}\n\n"
        "\tLa désagrégation du LOO-RMSE par région administrative\n"
        "\trévèle les disparités spatiales de précision,\n"
        "\tdirectement exploitables pour prioriser les futures\n"
        "\tcampagnes de terrain~(tableau~\\ref{tab:perf_region},\n"
        "\tfigure~\\ref{fig:regional}).\n"
        "\tLes régions Maritime~($n=164$) et Centrale~($n=213$)\n"
        "\taffichent les RMSE les plus faibles~: respectivement\n"
        "\t2{,}52 et 2{,}98~g/100g pour KED-H, 2{,}29 et 2{,}64\n"
        "\tpour RK-SCORPAN.\n"
        "\tKara~($n=18$) et Savanes~($n=14$) présentent des\n"
        "\terreurs de 35--40\\,\\% supérieures à la moyenne nationale,\n"
        "\treflétant principalement la faible densité d'observations\n"
        "\tplutôt que la complexité géologique seule.\n"
        "\tLa variance KED-H par région~(panneau droit)\n"
        "\tconstitue une carte operationnelle de priorite pour\n"
        "\tl'echantillonnage adaptatif.\n\n"
        "\t\\begin{table}[htbp]"
    ),
    # ── 10. Synthese L1-L4 ───────────────────────────────────────────────
    (
        "\t\\subsubsection{Synthèse de la hiérarchie L1--L4}\n\t\n\t\\begin{figure}[htbp]",
        "\t\\subsubsection{Synthèse de la hiérarchie L1--L4}\n\n"
        "\tLes figures~\\ref{fig:synthesis_ab}--\\ref{fig:synthesis_cd}\n"
        "\tsynthétisent les performances comparatives selon quatre\n"
        "\taxes complémentaires~: performances normalisées (radar),\n"
        "\tLOO-RMSE absolus KED-H~H1, couverture spatiale et\n"
        "\tréduction de variance Fusion.\n"
        "\tLe radar~(panneau~A) montre que la Fusion BLUP domine\n"
        "\tsur tous les axes, surpassant chaque modèle individuel.\n"
        "\tLe panneau~B illustre l'hétérogénéité des erreurs~:\n"
        "\tVBS~(3{,}15~g/100g) et EG~(1{,}69\\,\\%) sont mieux\n"
        "\tprédits que CBR~(16{,}14\\,\\%), dont la forte\n"
        "\tvariabilité naturelle limite la précision spatiale.\n"
        "\tLe panneau~C rappelle que VfS-PLS~(L3) est limité à\n"
        "\t81{,}7\\,\\% du territoire (masque cuirasses et alluvions).\n"
        "\tLe panneau~D montre que la réduction de variance\n"
        "\test maximale pour EG~(48{,}8\\,\\%), paramètre pour\n"
        "\tlequel les variances KED-H et RK sont les plus proches.\n\n"
        "\t\\begin{figure}[htbp]"
    ),
]

n_replaced = 0
for old, new in PATCHES:
    if old in txt:
        txt = txt.replace(old, new, 1)
        n_replaced += 1
    else:
        print(f"  WARN not found: {repr(old[:60])}")

f.write_text(txt, encoding="utf-8")
print(f"OK — {n_replaced}/{len(PATCHES)} sections redigees")
