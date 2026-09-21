import NetInfo from '@react-native-community/netinfo';
import { repository } from '@/db/repository';
import { mobileApi, type CreateFieldSondageRequest } from '@/api/mobile';
import { atlaspackRepository, newUuid } from '@/services/atlaspack/repository';
import { atlaspackSession } from '@/services/atlaspack/session';

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncStatus {
  state: SyncState;
  pendingCount: number;
  lastError: string | null;
  lastSyncAt: string | null;
}

type Listener = (status: SyncStatus) => void;

// Back-off exponentiel plafonné à 5 min (ADR-MOBILE-002). Pas de tentative
// avant ce délai pour un item qui vient d'échouer.
const MAX_BACKOFF_MS = 5 * 60 * 1000;
function backoffMs(attempts: number): number {
  return Math.min(1000 * 2 ** attempts, MAX_BACKOFF_MS);
}

class SyncServiceImpl {
  private listeners = new Set<Listener>();
  private status: SyncStatus = { state: 'idle', pendingCount: 0, lastError: null, lastSyncAt: null };
  private nextAttemptAt = new Map<string, number>();
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;
    NetInfo.addEventListener((state) => {
      if (state.isConnected) void this.flush();
    });
    void this.refreshPendingCount();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private emit(patch: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...patch };
    this.listeners.forEach((l) => l(this.status));
  }

  async refreshPendingCount(): Promise<void> {
    const n = await repository.getQueueCount();
    this.emit({ pendingCount: n });
  }

  // Sauvegarde locale d'abord, empile ensuite pour sync — jamais d'appel
  // réseau direct depuis un écran (ADR-MOBILE-002).
  async createSondageOffline(
    missionId: string,
    data: CreateFieldSondageRequest,
    plannedPointId: string | null,
    mode: 'confirm' | 'relocate' = 'confirm'
  ): Promise<string> {
    const clientId = newUuid();
    await repository.saveDraft({
      client_id: clientId,
      mission_id: missionId,
      planned_point_id: plannedPointId,
      longitude: data.longitude,
      latitude: data.latitude,
      location_accuracy_m: data.location_accuracy_m ?? null,
      depth_m: data.depth_m ?? null,
      layers_count: null,
      profile_description: data.profile_description ?? null,
      notes: data.notes ?? null,
      point_name: data.point_name ?? null,
      relocation_reason: data.relocation_reason ?? null,
      status: 'queued',
      server_id: null,
      created_at: new Date().toISOString(),
    });
    const actionType = !plannedPointId
      ? 'create_sondage'
      : mode === 'relocate' ? 'relocate_sondage_point' : 'confirm_sondage_point';
    await repository.enqueue(clientId, actionType, {
      mission_id: missionId,
      planned_point_id: plannedPointId,
      ...data,
    });

    const operatorUserId = atlaspackSession.get()?.operatorUserId ?? null;
    await atlaspackRepository.recordAuditEvent({
      eventType: mode === 'relocate' ? 'relocate_point' : 'gps_capture',
      operatorUserId,
      missionId,
      objectType: 'sondage',
      objectId: clientId,
      oldValues: null,
      newValues: {
        longitude: data.longitude,
        latitude: data.latitude,
        location_accuracy_m: data.location_accuracy_m ?? null,
        planned_point_id: plannedPointId,
      },
      metadata: { point_name: data.point_name ?? null, relocation_reason: data.relocation_reason ?? null },
    });

    await this.refreshPendingCount();
    void this.flush();
    return clientId;
  }

  async flush(): Promise<void> {
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      this.emit({ state: 'offline' });
      return;
    }

    const items = await repository.getQueue();
    const now = Date.now();
    const due = items.filter((i) => (this.nextAttemptAt.get(i.client_id) ?? 0) <= now);
    if (due.length === 0) {
      this.emit({ state: 'idle' });
      return;
    }

    this.emit({ state: 'syncing' });

    for (const item of due) {
      try {
        const payload = JSON.parse(item.payload) as CreateFieldSondageRequest & {
          mission_id: string;
          planned_point_id: string | null;
        };
        let serverId: string;
        if (item.action_type === 'relocate_sondage_point' && payload.planned_point_id) {
          const res = await mobileApi.relocateSondagePoint(payload.mission_id, payload.planned_point_id, payload);
          serverId = res.id as string;
        } else if (item.action_type === 'confirm_sondage_point' && payload.planned_point_id) {
          const res = await mobileApi.confirmSondagePoint(payload.mission_id, payload.planned_point_id, payload);
          if (!res.within_tolerance) throw new Error(res.message);
          serverId = res.id as string;
        } else {
          const res = await mobileApi.createFieldSondage(payload.mission_id, payload);
          serverId = res.id;
        }
        await repository.markDraftSynced(item.client_id, serverId);
        await repository.removeFromQueue(item.client_id);
        this.nextAttemptAt.delete(item.client_id);
      } catch (err) {
        const attempts = item.attempts + 1;
        this.nextAttemptAt.set(item.client_id, Date.now() + backoffMs(attempts));
        await repository.markQueueFailure(item.client_id, err instanceof Error ? err.message : String(err));
        this.emit({ lastError: err instanceof Error ? err.message : String(err) });
      }
    }

    await this.refreshPendingCount();
    this.emit({ state: 'idle', lastSyncAt: new Date().toISOString() });
  }
}

export const syncService = new SyncServiceImpl();
