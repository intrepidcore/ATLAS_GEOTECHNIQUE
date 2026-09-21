jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(),
    fetch: jest.fn().mockResolvedValue({ isConnected: true }),
  },
}));

jest.mock('@/db/repository', () => ({
  repository: {
    getQueueCount: jest.fn().mockResolvedValue(0),
    getQueue: jest.fn().mockResolvedValue([]),
    saveDraft: jest.fn().mockResolvedValue(undefined),
    enqueue: jest.fn().mockResolvedValue(undefined),
    markDraftSynced: jest.fn().mockResolvedValue(undefined),
    removeFromQueue: jest.fn().mockResolvedValue(undefined),
    markQueueFailure: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/api/mobile', () => ({
  mobileApi: {
    createFieldSondage: jest.fn(),
    confirmSondagePoint: jest.fn(),
  },
}));

jest.mock('@/services/atlaspack/repository', () => ({
  newUuid: () => '11111111-1111-4111-8111-111111111111',
  atlaspackRepository: {
    recordAuditEvent: jest.fn().mockResolvedValue('audit-id'),
  },
}));

jest.mock('@/services/atlaspack/session', () => ({
  atlaspackSession: {
    get: jest.fn().mockReturnValue(null),
  },
}));

import { repository } from '@/db/repository';
import { mobileApi } from '@/api/mobile';
import { syncService } from '@/services/syncService';
import { atlaspackRepository } from '@/services/atlaspack/repository';

describe('syncService.createSondageOffline', () => {
  beforeEach(() => jest.clearAllMocks());

  it('saves a draft locally and enqueues a create_sondage action when no planned point', async () => {
    await syncService.createSondageOffline('mission-1', { longitude: 1.2, latitude: 6.1 }, null);
    expect(repository.saveDraft).toHaveBeenCalledTimes(1);
    expect(repository.enqueue).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'create_sondage',
      expect.objectContaining({ mission_id: 'mission-1' })
    );
  });

  it('enqueues a confirm_sondage_point action when a planned point is given', async () => {
    await syncService.createSondageOffline('mission-1', { longitude: 1.2, latitude: 6.1 }, 'point-9');
    expect(repository.enqueue).toHaveBeenCalledWith(
      expect.any(String),
      'confirm_sondage_point',
      expect.objectContaining({ planned_point_id: 'point-9' })
    );
  });

  it('records a gps_capture audit event for a normal confirmation', async () => {
    await syncService.createSondageOffline('mission-1', { longitude: 1.2, latitude: 6.1 }, 'point-9', 'confirm');
    expect(atlaspackRepository.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'gps_capture', missionId: 'mission-1', objectType: 'sondage' })
    );
  });

  it('records a relocate_point audit event when relocating', async () => {
    await syncService.createSondageOffline('mission-1', { longitude: 1.2, latitude: 6.1 }, 'point-9', 'relocate');
    expect(atlaspackRepository.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'relocate_point' })
    );
  });
});

describe('syncService.flush', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does nothing when the queue is empty', async () => {
    (repository.getQueue as jest.Mock).mockResolvedValue([]);
    await syncService.flush();
    expect(mobileApi.createFieldSondage).not.toHaveBeenCalled();
  });

  it('removes an item from the queue once synced successfully', async () => {
    (repository.getQueue as jest.Mock).mockResolvedValue([
      {
        client_id: 'sondage-1',
        action_type: 'create_sondage',
        payload: JSON.stringify({ mission_id: 'm1', planned_point_id: null, longitude: 1, latitude: 6 }),
        attempts: 0,
        last_error: null,
        created_at: new Date().toISOString(),
      },
    ]);
    (mobileApi.createFieldSondage as jest.Mock).mockResolvedValue({ id: 'server-1', code_sondage: 'S-1', message: 'ok' });

    await syncService.flush();

    expect(repository.markDraftSynced).toHaveBeenCalledWith('sondage-1', 'server-1');
    expect(repository.removeFromQueue).toHaveBeenCalledWith('sondage-1');
  });

  it('records a failure and keeps the item queued when the server rejects it', async () => {
    (repository.getQueue as jest.Mock).mockResolvedValue([
      {
        client_id: 'sondage-2',
        action_type: 'create_sondage',
        payload: JSON.stringify({ mission_id: 'm1', planned_point_id: null, longitude: 1, latitude: 6 }),
        attempts: 0,
        last_error: null,
        created_at: new Date().toISOString(),
      },
    ]);
    (mobileApi.createFieldSondage as jest.Mock).mockRejectedValue(new Error('offline'));

    await syncService.flush();

    expect(repository.markQueueFailure).toHaveBeenCalledWith('sondage-2', 'offline');
    expect(repository.removeFromQueue).not.toHaveBeenCalled();
  });
});
