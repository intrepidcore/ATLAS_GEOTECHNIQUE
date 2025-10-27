// API Client pour le géocodage
export type Candidate = { 
  code: string; 
  name: string; 
  score: number; 
  method?: string 
};

export type Suggestion = {
  id: number;
  entity: 'sondages';
  entity_id: string;
  localite?: string;
  adm2_code?: string;
  top_code?: string;
  top_score?: number;
  top_method?: string;
  status: 'pending' | 'accepted' | 'rejected';
  candidates: Candidate[];
  created_at: string;
  decided_at?: string;
};

export type GeocodeStats = {
  total: number;
  accepted: number;
  pending: number;
  rejected: number;
  no_suggestion: number;
};

export type ApplyAcceptedResponse = {
  applied_count: number;
  refreshed: boolean;
};

const BASE = 'http://localhost:8000/geocode';

export async function getStats(): Promise<GeocodeStats> {
  const r = await fetch(`${BASE}/stats`);
  if (!r.ok) throw new Error('Failed to fetch stats');
  return r.json();
}

export async function listSuggestions(params?: {
  status?: string;
  adm2?: string;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<Suggestion[]> {
  const q = new URLSearchParams(params as any).toString();
  const r = await fetch(`${BASE}/suggestions${q ? `?${q}` : ''}`);
  if (!r.ok) throw new Error('Failed to list suggestions');
  return r.json();
}

export async function accept(id: number): Promise<Suggestion> {
  const r = await fetch(`${BASE}/suggestions/${id}/accept`, { 
    method: 'POST' 
  });
  if (!r.ok) throw new Error('Failed to accept suggestion');
  return r.json();
}

export async function reject(id: number): Promise<Suggestion> {
  const r = await fetch(`${BASE}/suggestions/${id}/reject`, { 
    method: 'POST' 
  });
  if (!r.ok) throw new Error('Failed to reject suggestion');
  return r.json();
}

export async function updateAdm3(id: number, adm3_code: string): Promise<Suggestion> {
  const r = await fetch(`${BASE}/suggestions/${id}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adm3_code })
  });
  if (!r.ok) throw new Error('Failed to update suggestion');
  return r.json();
}

export async function applyAccepted(): Promise<ApplyAcceptedResponse> {
  const r = await fetch(`${BASE}/apply-accepted`, { 
    method: 'POST' 
  });
  if (!r.ok) throw new Error('Failed to apply accepted suggestions');
  return r.json();
}
