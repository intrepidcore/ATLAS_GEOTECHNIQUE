const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * fetch avec délai maximal. Sans ce garde-fou, React Native peut attendre
 * plusieurs minutes lorsqu'une IP Tailscale n'est plus joignable.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const callerSignal = options.signal;
  const forwardAbort = () => controller.abort();

  if (callerSignal?.aborted) {
    controller.abort();
  } else {
    callerSignal?.addEventListener('abort', forwardAbort, { once: true });
  }

  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted && !callerSignal?.aborted) {
      throw new Error(
        `Délai réseau dépassé (${Math.round(timeoutMs / 1000)} s). Vérifiez Tailscale et l’API Atlas.`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener('abort', forwardAbort);
  }
}
