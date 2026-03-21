import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { DataQuality, DataQualityBadge } from './DataQualityBadge';

let _badgeRoot: Root | null = null;

export function mountDataQualityBadge(containerId: string, data: any) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!_badgeRoot) {
        _badgeRoot = createRoot(container);
    }

    // Calcul de la qualité basé sur l'audit
    // On considère que les essais obligatoires pour une bonne maille sont VBS, Atterberg, Proctor
    let score = 0;
    const available = [];
    const missing = [];
    let critical_missing = false;

    // Données venant de data.essaisTypeStats ou data global
    const hasVbs = !!data?.overview?.vbs?.length;
    const hasAtterberg = !!data?.overview?.atterberg?.length;
    // La DB actuelle ne renvoie pas nativement Proctor/Granulo, 
    // l'audit 100% manquant sur Proctor force false pour l'instant
    const hasProctor = false; 

    if (hasVbs) { score += 33; available.push('vbs'); } else { missing.push('vbs'); }
    if (hasAtterberg) { score += 33; available.push('wl', 'wp', 'ip'); } else { missing.push('wl', 'wp', 'ip'); }
    if (hasProctor) { score += 34; available.push('gamma_d_max', 'w_opt'); } else { missing.push('gamma_d_max'); critical_missing = true; }

    // On évite 99 ou 100 s'il manque tout, et on set à 0 s'il n'y a rien
    if (available.length === 0) score = 0;
    
    // S'il n'y a pas de données du tout
    if (!data || data.n_sondages === 0) {
        _badgeRoot.render(null);
        return;
    }

    const quality: DataQuality = {
        score: Math.round(score),
        available,
        missing,
        critical_missing
    };

    _badgeRoot.render(<DataQualityBadge quality={quality} />);
}
