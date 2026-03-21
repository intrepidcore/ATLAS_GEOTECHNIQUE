import React, { useState, useEffect } from 'react';
import { getApiBase } from '@/api-base';

export function ApiHealthIndicator() {
    const [status, setStatus] = useState<'ok'|'error'|'checking'>('checking');
    const API_BASE = getApiBase();
    
    useEffect(() => {
        const check = async () => {
            try {
                // Ensure the fetch can timeout quickly without hanging
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                
                await fetch(`${API_BASE}/healthz`, { signal: controller.signal });
                clearTimeout(timeoutId);
                setStatus('ok');
            } catch {
                setStatus('error');
            }
        };
        
        check();
        const interval = setInterval(check, 10000);
        return () => clearInterval(interval);
    }, [API_BASE]);
    
    return (
        <span title={`API: ${API_BASE}`} style={{
            width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
            background: status === 'ok' ? '#22c55e' : status === 'error' ? '#ef4444' : '#f59e0b',
            boxShadow: status === 'ok' ? '0 0 5px #22c55e' : status === 'error' ? '0 0 5px #ef4444' : 'none'
        }} />
    );
}
