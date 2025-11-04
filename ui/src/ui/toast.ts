/**
 * Système de toasts non-bloquants
 * v2.5.0 - Phase UI-01
 */

type ToastType = 'success' | 'error' | 'info';

let container: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  }
  return container;
}

function show(message: string, type: ToastType, duration = 3000) {
  const c = ensureContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  c.appendChild(toast);
  
  // Animate in
  setTimeout(() => toast.classList.add('toast-show'), 10);
  
  // Auto remove
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

export const toast = {
  success: (msg: string, duration?: number) => show(msg, 'success', duration),
  error: (msg: string, duration?: number) => show(msg, 'error', duration),
  info: (msg: string, duration?: number) => show(msg, 'info', duration),
};
