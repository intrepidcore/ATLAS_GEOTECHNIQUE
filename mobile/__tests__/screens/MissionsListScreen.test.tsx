import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

const mockGetMissions = jest.fn();
const mockSaveMissions = jest.fn();
const mockGetMyMissions = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('@/db/repository', () => ({
  repository: {
    getMissions: () => mockGetMissions(),
    saveMissions: (missions: unknown[]) => mockSaveMissions(missions),
  },
}));

jest.mock('@/api/mobile', () => ({
  mobileApi: {
    getMyMissions: () => mockGetMyMissions(),
  },
}));

import { MissionsListScreen } from '@/screens/MissionsListScreen';

describe('MissionsListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMissions.mockResolvedValue([]);
  });

  it('affiche les missions renvoyées par le serveur', async () => {
    mockGetMyMissions.mockResolvedValue({
      count: 1,
      missions: [{
        id: 'mission-1',
        code: 'MOB-TEST-A',
        title: 'Mission Test A',
        theme: 'Reconnaissance',
        status: 'planned',
        start_date: null,
        end_date: null,
        maille_id: null,
        maille_label: null,
        commune: null,
        region: null,
        expected_sondages: 2,
        completed_sondages: 0,
        percent_done: 0,
      }],
    });

    const screen = render(<MissionsListScreen />);

    await waitFor(() => expect(screen.getByText('Mission Test A')).toBeTruthy());
    expect(mockSaveMissions).toHaveBeenCalledTimes(1);
  });

  it('distingue une panne réseau d’une liste réellement vide', async () => {
    mockGetMyMissions.mockRejectedValue(new Error('Network request failed'));

    const screen = render(<MissionsListScreen />);

    await waitFor(() => expect(screen.getByText('Impossible de charger les missions')).toBeTruthy());
    expect(screen.getByText('Network request failed')).toBeTruthy();
    expect(screen.queryByText('Aucune mission assignée pour le moment')).toBeNull();
  });
});
