#!/usr/bin/env python3
"""
Regenere fig07 (VBS 4 modeles, 2x2) et fig19 (CBR+Rd, 1x2)
en utilisant les exports 300dpi existants.
Aspect ratio corrige pour affichage 2 colonnes (figure*).
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import numpy as np
from pathlib import Path
from PIL import Image

ART  = Path(__file__).parent
FIG  = ART / "figures"
EXP  = ART.parent.parent.parent / "exports_300dpi"

plt.rcParams.update({
    "font.family": "serif",
    "font.serif":  ["Times New Roman", "DejaVu Serif"],
    "font.size": 9, "axes.titlesize": 9,
    "savefig.dpi": 300, "savefig.bbox": "tight",
    "savefig.pad_inches": 0.05,
})


def load(path):
    if path and path.exists():
        return np.array(Image.open(path).convert("RGB"))
    return None


# ─────────────────────────────────────────────────────────────────────────────
# FIG07 — VBS H1 : 4 modeles en grille 2x2
# ─────────────────────────────────────────────────────────────────────────────
def regen_fig07():
    print("Regenere fig07 (VBS 4 modeles 2x2)...")
    panels = [
        (EXP / "vbs_ked_h1.png",    "L1 — KED-H\nDérive hiérarchique 5 niveaux"),
        (EXP / "vbs_rk_h1.png",     "L2a — RK-SCORPAN\nRégression Ridge + Krigeage"),
        (EXP / "vbs_fusion_h1.png", "L2b — Fusion Bayésienne BLUP\nVariance réduite 47,9 %"),
        (EXP / "vbs_mtgp_h1.png",   "L4 — MTGP/ICM\nCo-krigeage multi-tâches"),
    ]

    # Charge les images
    imgs = [(lbl, load(p)) for p, lbl in panels]
    valid = [(lbl, img) for lbl, img in imgs if img is not None]

    if not valid:
        print("  WARN : aucun export 300dpi VBS trouve — fig07 ignoree")
        return

    n = len(valid)
    ncols = 2
    nrows = (n + 1) // 2

    # figsize calcule pour que chaque carte soit lisible
    # Chaque export 300dpi est A4 paysage (~3508×2480 px a 300dpi)
    # Ratio w:h ~ 1.41 → pour nrows=2, ncols=2 : fig (2×1.41):(2×1) = 2.82:2
    # A pleine largeur article (17cm), hauteur ≈ 17×2/2.82 ≈ 12cm → OK
    fig, axes = plt.subplots(nrows, ncols, figsize=(14, 10))
    axes_flat = axes.flatten() if n > 1 else [axes]

    for i, (ax, (lbl, img)) in enumerate(zip(axes_flat, valid)):
        ax.imshow(img, interpolation="lanczos")
        ax.set_title(lbl, fontsize=8.5, fontweight="bold", pad=4)
        ax.axis("off")

    # Masque les axes vides
    for j in range(len(valid), len(axes_flat)):
        axes_flat[j].set_visible(False)

    fig.suptitle(
        "Cartes de prédiction — Valeur au Bleu de Méthylène VBS (g/100g), Horizon H1\n"
        "Comparaison des quatre modèles L1–L4 sur la grille nationale togolaise (29 407 mailles)",
        fontsize=9.5, fontweight="bold", y=1.01
    )
    plt.tight_layout(h_pad=0.5, w_pad=0.3)
    out = FIG / "fig07_maps_vbs_h1.png"
    fig.savefig(out, dpi=300)
    plt.close(fig)
    print(f"  OK {out.name} ({out.stat().st_size//1024} KB)")


# ─────────────────────────────────────────────────────────────────────────────
# FIG19 — CBR 95% et Rd H1 : cote a cote (1x2)
# ─────────────────────────────────────────────────────────────────────────────
def regen_fig19():
    print("Regenere fig19 (CBR + Rd, 1x2)...")
    panels = [
        (EXP / "cbr_95_ked_h1.png", "CBR 95 % Proctor — KED-H, H1\nn = 117 mesures"),
        (EXP / "rd_mpa_ked_h1.png",  "Rd — Résistance dynamique — KED-H, H1\nn = 89 mesures"),
    ]

    imgs = [(lbl, load(p)) for p, lbl in panels]
    valid = [(lbl, img) for lbl, img in imgs if img is not None]

    if not valid:
        print("  WARN : exports CBR/Rd non trouves — fig19 ignoree")
        return

    # 1 ligne x 2 colonnes
    # A4 paysage 2 fois : figsize(14, 7) → ratio 2:1 → h = 7/14 × 17 ≈ 8.5cm OK
    fig, axes = plt.subplots(1, len(valid), figsize=(14, 7))
    if len(valid) == 1:
        axes = [axes]

    for ax, (lbl, img) in zip(axes, valid):
        ax.imshow(img, interpolation="lanczos")
        ax.set_title(lbl, fontsize=8.5, fontweight="bold", pad=4)
        ax.axis("off")

    fig.suptitle(
        "Cartographie des paramètres de portance — Horizon H1 (0–1 m)\n"
        "Krigeage avec Dérive Externe Hiérarchique — Territoire togolais (29 407 mailles)",
        fontsize=9.5, fontweight="bold", y=1.01
    )
    plt.tight_layout(w_pad=0.3)
    out = FIG / "fig19_maps_portance_cbr_rd.png"
    fig.savefig(out, dpi=300)
    plt.close(fig)
    print(f"  OK {out.name} ({out.stat().st_size//1024} KB)")


if __name__ == "__main__":
    FIG.mkdir(exist_ok=True)
    regen_fig07()
    regen_fig19()
    print("\nDone.")
