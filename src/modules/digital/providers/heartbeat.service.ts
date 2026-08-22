import * as providersService from './providers.service';
import { abrirRestauranteInterno, fecharRestauranteInterno } from '../restaurante/restaurante.controller';
import { registrarEventoRestaurante } from '../../../shared/utils/restauranteEventos';
import * as state from './heartbeat.state';

export const HEARTBEAT_TIMEOUT_MS = 90_000;
export const WATCHDOG_INTERVAL_MS = 30_000;

export type HeartbeatResult =
  | { status: 'unknown' }
  | { status: 'ok'; open: boolean };

export async function handleHeartbeat(id: string): Promise<HeartbeatResult> {
  const snapshot = await providersService.getProviderSnapshot(id);
  if (!snapshot.exists) {
    return { status: 'unknown' };
  }

  const { isFirstSinceBoot } = state.touchHeartbeat(id);
  if (isFirstSinceBoot) {
    console.log(`[heartbeat] primeiro heartbeat pós-boot: ${id}`);
  }

  const currentOpen = snapshot.data()?.open;
  if (currentOpen !== 'S') {
    await openProviderByHeartbeat(id);
  }

  return { status: 'ok', open: true };
}

async function openProviderByHeartbeat(id: string): Promise<void> {
  await providersService.setProviderOpenFlag(id, 'S');

  let link: string | undefined;
  try {
    link = (await providersService.getConfigRow()).webUrlWhats;
  } catch (err) {
    console.error(`[heartbeat] falha ao obter link do Firebird para ${id}`, err);
  }

  await abrirRestauranteInterno(id, link);
  console.log(`[heartbeat] ${new Date().toISOString()} heartbeat-open: ${id}`);
  registrarEventoRestaurante(id, 'abertura', 'heartbeat');
}

async function closeProviderByWatchdog(id: string): Promise<void> {
  await providersService.setProviderOpenFlag(id, 'N');
  await fecharRestauranteInterno(id);
  state.markClosedByWatchdog(id);
  console.log(`[watchdog] ${new Date().toISOString()} watchdog-close: ${id}`);
  registrarEventoRestaurante(id, 'fechamento', 'watchdog');
}

export async function runWatchdogTick(now: number = Date.now()): Promise<void> {
  const trackedOpen = state.getTrackedOpenEntries();

  for (const [id, entry] of trackedOpen) {
    if (now - entry.lastHeartbeatAt > HEARTBEAT_TIMEOUT_MS) {
      try {
        await closeProviderByWatchdog(id);
      } catch (err) {
        console.error(`[watchdog] falha ao fechar provider ${id}`, err);
      }
    }
  }
}

let watchdogTimer: NodeJS.Timeout | undefined;

export function startWatchdog(intervalMs: number = WATCHDOG_INTERVAL_MS): NodeJS.Timeout {
  if (watchdogTimer) return watchdogTimer;

  watchdogTimer = setInterval(() => {
    runWatchdogTick().catch((err) => console.error('[watchdog] erro no ciclo', err));
  }, intervalMs);

  return watchdogTimer;
}

export function stopWatchdog(): void {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = undefined;
  }
}

export function onManualClose(id: string): void {
  state.clearManualClose(id);
}
