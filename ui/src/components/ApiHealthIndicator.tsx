import { useState, useEffect } from 'react';
import { API_BASE } from '../api-base';

interface HealthStatus {
    status: 'ok' | 'degraded' | 'error' | 'checking';
    latency_ms?: number;
    api_version?: string;
    db_connected?: boolean;
    error?: string;
    last_ok?: Date;
}

export function ApiHealthIndicator() {
    const [health, setHealth] = useState<HealthStatus>({ status: 'checking' });
    const [showDetails, setShowDetails] = useState(false);
    
    useEffect(() => {
        const check = async () => {
            const start = Date.now();
            try {
                const resp = await fetch(`${API_BASE}/healthz`, {
                    signal: AbortSignal.timeout(3000)
                });
                const latency = Date.now() - start;
                
                if (resp.ok) {
                    const data = await resp.json();
                    setHealth({
                        status: data.db_connected ? 'ok' : 'degraded',
                        latency_ms: latency,
                        api_version: data.version,
                        db_connected: data.db_connected,
                        last_ok: new Date()
                    });
                } else {
                    setHealth({ 
                        status: 'error',
                        error: `HTTP ${resp.status}`,
                        latency_ms: latency
                    });
                }
            } catch (e) {
                setHealth({ 
                    status: 'error',
                    error: e instanceof Error ? e.message : 'Connexion refusée'
                });
            }
        };
        
        check();
        const interval = setInterval(check, 15000);
        return () => clearInterval(interval);
    }, []);
    
    const colors = {
        ok: '#22c55e',
        degraded: '#f59e0b',
        error: '#ef4444',
        checking: '#6b7280'
    };
    
    const labels = {
        ok: `API OK ${health.latency_ms ? `(${health.latency_ms}ms)` : ''}`,
        degraded: 'API dégradée (DB déconnectée)',
        error: `API hors ligne: ${health.error}`,
        checking: 'Vérification...'
    };
    
    return (
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {/* Point de statut avec animation pulse si erreur */}
            <span
                onClick={() => setShowDetails(!showDetails)}
                title={labels[health.status]}
                style={{
                    width: 8, height: 8,
                    borderRadius: '50%',
                    background: colors[health.status],
                    cursor: 'pointer',
                    animation: health.status === 'error' ? 'pulse 1s infinite' : 'none'
                }}
            />
            
            {/* Tooltip détaillé au clic */}
            {showDetails && (
                <div style={{
                    position: 'absolute', top: 16, right: 0,
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 6, padding: '8px 12px',
                    fontSize: 12, whiteSpace: 'nowrap',
                    zIndex: 9999, minWidth: 200
                }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        {labels[health.status]}
                    </div>
                    <div style={{ color: 'hsl(var(--muted-foreground))' }}>
                        {health.api_version && <div>Version: {health.api_version}</div>}
                        {health.db_connected !== undefined && (
                            <div>DB: {health.db_connected ? '✅ connectée' : '❌ déconnectée'}</div>
                        )}
                        <div>API: {API_BASE}</div>
                        {health.last_ok && (
                            <div>Dernier OK: {health.last_ok.toLocaleTimeString()}</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
