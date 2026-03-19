import { maillesApi, missionsApi } from '../services/colab-api';
import { tokenStorage } from '../services/auth-api';

export type MailleState = {
  mailleId: string;
  hasActiveMission: boolean;
  missionCount: number;
};

export class ColabController {
  async resolveMaille(lat: number, lon: number) {
    return maillesApi.resolve({ lat, lon });
  }

  async listActiveMissionsOnMaille(mailleId: string) {
    return missionsApi.listMailleMissions(mailleId);
  }

  async unassignMissionMaille(missionId: string) {
    return missionsApi.unassignMaille(missionId);
  }

  async getMailleState(mailleId: string): Promise<MailleState> {
    const token = tokenStorage.getAccessToken?.();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`/api/colab/mailles/${encodeURIComponent(mailleId)}/state`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(err.error || 'Erreur lors de la récupération de l\'état maille');
    }
    const data = await res.json();
    return {
      mailleId: data.maille_id ?? mailleId,
      hasActiveMission: !!data.has_active_mission,
      missionCount: Number(data.mission_count ?? 0),
    };
  }
}

export const colabController = new ColabController();
