/**
 * Module WebSocket temps réel pour Atlas
 * Gère la connexion WebSocket et la distribution des événements
 */

type EventHandler = (data: any) => void;

interface WsEvent {
  event: string;
  data: any;
}

class RealtimeClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Map<string, EventHandler[]> = new Map();
  private reconnectTimeout: number | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor(url: string) {
    this.url = url;
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[REALTIME] Already connected');
      return;
    }

    console.log('[REALTIME] Connecting to', this.url);
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('[REALTIME] ✅ WebSocket connected');
      this.reconnectAttempts = 0;
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WsEvent = JSON.parse(event.data);
        console.log('[REALTIME] 📨 Event received:', message.event, message.data);
        this.emit(message.event, message.data);
      } catch (err) {
        console.error('[REALTIME] ❌ Failed to parse message:', err);
      }
    };

    this.ws.onclose = () => {
      console.warn('[REALTIME] ⚠️  Disconnected');
      this.ws = null;

      // Reconnexion automatique avec backoff exponentiel
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;
        console.log(`[REALTIME] 🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.reconnectTimeout = window.setTimeout(() => this.connect(), delay);
      } else {
        console.error('[REALTIME] ❌ Max reconnection attempts reached');
      }
    };

    this.ws.onerror = (err) => {
      console.error('[REALTIME] ❌ WebSocket error:', err);
    };
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.handlers.clear();
    console.log('[REALTIME] Disconnected and cleaned up');
  }

  on(eventName: string, handler: EventHandler) {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    this.handlers.get(eventName)!.push(handler);
    console.log(`[REALTIME] 📝 Registered handler for "${eventName}"`);
  }

  off(eventName: string, handler: EventHandler) {
    const list = this.handlers.get(eventName);
    if (!list) return;
    const idx = list.indexOf(handler);
    if (idx >= 0) {
      list.splice(idx, 1);
      console.log(`[REALTIME] 🗑️  Unregistered handler for "${eventName}"`);
    }
  }

  private emit(eventName: string, data: any) {
    // Appeler les handlers enregistrés
    const list = this.handlers.get(eventName);
    if (list) {
      list.forEach((h) => {
        try {
          h(data);
        } catch (err) {
          console.error(`[REALTIME] Error in handler for "${eventName}":`, err);
        }
      });
    }

    // Émettre aussi un CustomEvent global pour compatibilité
    window.dispatchEvent(
      new CustomEvent(`atlas:ws:${eventName}`, { detail: data })
    );
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Instance singleton
let client: RealtimeClient | null = null;

/**
 * Initialiser la connexion WebSocket
 * @param apiBaseUrl URL de base de l'API (ex: http://localhost:8000)
 */
export function initRealtime(apiBaseUrl: string): RealtimeClient {
  if (!client) {
    const wsUrl = apiBaseUrl
      .replace('http://', 'ws://')
      .replace('https://', 'wss://')
      + '/ws';
    client = new RealtimeClient(wsUrl);
    client.connect();
  }
  return client;
}

/**
 * S'abonner à un événement WebSocket
 * @param eventName Nom de l'événement (ex: "sondage.geocoded")
 * @param handler Fonction appelée quand l'événement est reçu
 */
export function onWsEvent(eventName: string, handler: EventHandler) {
  if (!client) {
    console.warn('[REALTIME] Client not initialized. Call initRealtime() first.');
    return;
  }
  client.on(eventName, handler);
}

/**
 * Se désabonner d'un événement WebSocket
 * @param eventName Nom de l'événement
 * @param handler Fonction à retirer
 */
export function offWsEvent(eventName: string, handler: EventHandler) {
  if (!client) return;
  client.off(eventName, handler);
}

/**
 * Déconnecter le WebSocket
 */
export function disconnectRealtime() {
  if (client) {
    client.disconnect();
    client = null;
  }
}

/**
 * Vérifier si le WebSocket est connecté
 */
export function isRealtimeConnected(): boolean {
  return client ? client.isConnected() : false;
}
