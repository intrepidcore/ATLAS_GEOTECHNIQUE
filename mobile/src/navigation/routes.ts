// Déclaration centrale des écrans + permission requise. La navigation se
// compose dynamiquement à partir de cette liste (ADR-MOBILE-005) — jamais
// deux arborescences dupliquées par rôle.

export type RootStackParamList = {
  Tabs: undefined;
  MissionDetail: { missionId: string };
  MissionMap: { missionId: string };
  SondageForm: { missionId: string; plannedPointId?: string; lat?: number; lon?: number };
};

export type TabParamList = {
  Missions: undefined;
  Activity: undefined;
  Profile: undefined;
};

export interface TabRouteDef {
  name: keyof TabParamList;
  label: string;
  permission?: string; // absent = toujours visible
}

export const TAB_ROUTES: TabRouteDef[] = [
  { name: 'Missions', label: 'Missions' },
  { name: 'Activity', label: 'Journal' },
  { name: 'Profile', label: 'Profil' },
];
