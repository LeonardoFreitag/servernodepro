export interface HeartbeatEntry {
  lastHeartbeatAt: number;
  openedByHeartbeat: boolean;
}

const heartbeats = new Map<string, HeartbeatEntry>();

export function getEntry(id: string): HeartbeatEntry | undefined {
  return heartbeats.get(id);
}

export function touchHeartbeat(id: string, now: number = Date.now()): { isFirstSinceBoot: boolean } {
  const isFirstSinceBoot = !heartbeats.has(id);
  heartbeats.set(id, { lastHeartbeatAt: now, openedByHeartbeat: true });
  return { isFirstSinceBoot };
}

export function clearManualClose(id: string): void {
  heartbeats.delete(id);
}

export function markClosedByWatchdog(id: string): void {
  const entry = heartbeats.get(id);
  if (entry) entry.openedByHeartbeat = false;
}

export function getTrackedOpenEntries(): Array<[string, HeartbeatEntry]> {
  return Array.from(heartbeats.entries()).filter(([, entry]) => entry.openedByHeartbeat);
}

export function resetState(): void {
  heartbeats.clear();
}
