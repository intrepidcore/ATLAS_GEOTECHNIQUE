/**
 * Utilitaires pour gestion des paramètres URL
 * v2.5.0 - Phase UI-01
 */

export function getParam(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key);
}

export function setParam(key: string, value: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set(key, value);
  return url.pathname + url.search;
}

export function deleteParam(key: string): string {
  const url = new URL(window.location.href);
  url.searchParams.delete(key);
  return url.pathname + url.search;
}
