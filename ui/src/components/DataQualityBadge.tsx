import React from 'react';

export interface DataQuality {
    score: number;           // 0-100
    available: string[];     // ["vbs", "wl", "wp", "ip"]
    missing: string[];       // ["gamma_d_max", "w_opt", "passant_2mm"]
    critical_missing: boolean; // Manque de données structurantes
}

const ESSAI_LABELS: Record<string, string> = {
    vbs: 'VBS',
    wl: 'WL (Liquidité)',
    wp: 'WP (Plasticité)', 
    ip: 'IP',
    eg: 'Gonflement',
    passant_80um: 'Passant 80µm',
    passant_2mm: 'Passant 2mm',
    gamma_d_max: 'Proctor γd max',
    w_opt: 'Proctor w opt',
};

export function DataQualityBadge({ quality }: { quality: DataQuality }) {
    const color = quality.score >= 70 ? '#22c55e' 
                : quality.score >= 40 ? '#f59e0b' 
                : '#ef4444';
    
    return (
        <div style={{ padding: '8px 12px', borderRadius: 6, 
                      border: `1px solid hsl(var(--border))` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', 
                          alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>
                    Qualité des données
                </span>
                <span style={{ 
                    fontSize: 14, fontWeight: 700, color,
                    background: `${color}20`, padding: '2px 8px', borderRadius: 4
                }}>
                    {quality.score}/100
                </span>
            </div>
            
            {quality.missing.length > 0 && (
                <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                    <div style={{ marginBottom: 2 }}>Manquants :</div>
                    {quality.missing.map(key => (
                        <span key={key} style={{
                            display: 'inline-block',
                            background: '#ef444420',
                            color: '#ef4444',
                            padding: '1px 6px',
                            borderRadius: 3,
                            fontSize: 10,
                            marginRight: 4,
                            marginBottom: 2
                        }}>
                            {ESSAI_LABELS[key] || key}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
