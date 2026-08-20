import Constants from 'expo-constants';

// Jamais d'URL en dur : lu depuis app.json > extra, avec repli dev raisonnable.
// Un superviseur qui déploie sur un autre backend change juste cette valeur au build.
const extra = (Constants.expoConfig?.extra ?? {}) as { apiBaseUrl?: string };

export const API_BASE_URL = extra.apiBaseUrl || 'http://localhost:8000/api';
