import * as providersService from './providers.service';
import {
  CachedProviderStatus,
  getCachedStatus,
  setCachedStatus,
} from './status.cache';
import { normalizeToIso, toIsoOffset } from '../../../shared/utils/datetime';

/**
 * Origem do estado atual. Valor livre — o PDV apenas exibe, não decide nada com base nele.
 * 'manual'    -> PUT /providers
 * 'heartbeat' -> reaberto pelo heartbeat do PDV
 * 'watchdog'  -> fechado por ausência de heartbeat
 * 'panel'     -> painel web
 */
export type ProviderOpenSource = 'manual' | 'heartbeat' | 'watchdog' | 'panel' | (string & {});

export interface ProviderStatusPayload {
  open: boolean;
  source?: ProviderOpenSource;
  since?: string;
  serverTime: string;
}

export type ProviderStatusResult =
  | { status: 'unknown' }
  | { status: 'ok'; data: ProviderStatusPayload };

/** Campo `open` do Firestore: 'S'/'N' hoje, tolerante a boolean caso o painel mude. */
export function isOpenFlag(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim().toUpperCase() === 'S';
  return false;
}

/**
 * Leitura pura do estado persistido do provider. Não abre, não fecha, não registra
 * heartbeat, não toca em lastHeartbeatAt e não interfere no watchdog.
 */
export async function getProviderStatus(id: string, now: number = Date.now()): Promise<ProviderStatusResult> {
  const cached = getCachedStatus(id, now);
  const entry = cached ?? (await readProviderState(id, now));

  if (!entry.found) return { status: 'unknown' };

  return {
    status: 'ok',
    data: {
      open: entry.open,
      ...(entry.source ? { source: entry.source } : {}),
      ...(entry.since ? { since: entry.since } : {}),
      serverTime: toIsoOffset(new Date(now)),
    },
  };
}

async function readProviderState(id: string, now: number): Promise<CachedProviderStatus> {
  const snapshot = await providersService.getProviderSnapshot(id);

  if (!snapshot.exists) {
    const miss: CachedProviderStatus = { found: false, open: false };
    setCachedStatus(id, miss, now);
    return miss;
  }

  const data = snapshot.data() ?? {};
  const source = typeof data.openSource === 'string' && data.openSource.trim() ? data.openSource.trim() : undefined;

  const value: CachedProviderStatus = {
    found: true,
    open: isOpenFlag(data.open),
    source,
    since: normalizeToIso(data.openChangedAt),
  };

  setCachedStatus(id, value, now);
  return value;
}
