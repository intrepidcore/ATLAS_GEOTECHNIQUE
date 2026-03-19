export type MailleVisualState = {
  hasActiveMission: boolean;
  missionCount: number;
};

type Listener = (mailleId: string, state: MailleVisualState | undefined) => void;

class MailleStateStore {
  private readonly byMailleId = new Map<string, MailleVisualState>();
  private readonly listeners = new Set<Listener>();

  get(mailleId: string) {
    return this.byMailleId.get(mailleId);
  }

  set(mailleId: string, state: MailleVisualState) {
    this.byMailleId.set(mailleId, state);
    this.listeners.forEach(l => l(mailleId, state));
  }

  clear(mailleId: string) {
    this.byMailleId.delete(mailleId);
    this.listeners.forEach(l => l(mailleId, undefined));
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const mailleStateStore = new MailleStateStore();
