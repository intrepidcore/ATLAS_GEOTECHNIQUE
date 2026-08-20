// Mêmes valeurs que le Tailwind par défaut utilisé dans ui/ (pas de palette custom côté web).
export const colors = {
  blue600: '#2563eb',
  blue50: '#eff6ff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray700: '#374151',
  gray900: '#111827',
  green500: '#22c55e',
  green50: '#f0fdf4',
  yellow500: '#eab308',
  yellow100: '#fef9c3',
  red500: '#ef4444',
  red50: '#fef2f2',
  white: '#ffffff',
};

export const radius = {
  lg: 8,
  xl: 12,
  full: 9999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const statusColor: Record<string, string> = {
  validated: colors.green500,
  draft_field: colors.yellow500,
  pending_sync: colors.gray400,
  synced: colors.blue600,
  to_validate_lab: colors.yellow500,
  integrated: colors.green500,
  rejected: colors.red500,
};
