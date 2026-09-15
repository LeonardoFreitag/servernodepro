"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WATCHDOG_INTERVAL_MS = exports.HEARTBEAT_TIMEOUT_MS = void 0;
exports.handleHeartbeat = handleHeartbeat;
exports.onManualClose = onManualClose;
exports.runWatchdogTick = runWatchdogTick;
exports.startWatchdog = startWatchdog;
exports.stopWatchdog = stopWatchdog;
var providersService = _interopRequireWildcard(require("./providers.service"));
var _restaurante = require("../restaurante/restaurante.controller");
var _restauranteEventos = require("../../../shared/utils/restauranteEventos");
var state = _interopRequireWildcard(require("./heartbeat.state"));
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
const HEARTBEAT_TIMEOUT_MS = exports.HEARTBEAT_TIMEOUT_MS = 90_000;
const WATCHDOG_INTERVAL_MS = exports.WATCHDOG_INTERVAL_MS = 30_000;
async function handleHeartbeat(id) {
  const snapshot = await providersService.getProviderSnapshot(id);
  if (!snapshot.exists) {
    return {
      status: 'unknown'
    };
  }
  const {
    isFirstSinceBoot
  } = state.touchHeartbeat(id);
  if (isFirstSinceBoot) {
    console.log(`[heartbeat] primeiro heartbeat pós-boot: ${id}`);
  }
  const currentOpen = snapshot.data()?.open;
  if (currentOpen !== 'S') {
    await openProviderByHeartbeat(id);
  }

  // Estado após o processamento do heartbeat: se chegou até aqui a loja está aberta
  // (ou já estava, ou acabou de ser reaberta). O PDV lê este campo como fonte de estado.
  return {
    status: 'ok',
    open: true
  };
}
async function openProviderByHeartbeat(id) {
  await providersService.setProviderOpenFlag(id, 'S', 'heartbeat');
  let link;
  try {
    link = (await providersService.getConfigRow()).webUrlWhats;
  } catch (err) {
    console.error(`[heartbeat] falha ao obter link do Firebird para ${id}`, err);
  }
  await (0, _restaurante.abrirRestauranteInterno)(id, link);
  console.log(`[heartbeat] ${new Date().toISOString()} heartbeat-open: ${id}`);
  (0, _restauranteEventos.registrarEventoRestaurante)(id, 'abertura', 'heartbeat');
}
async function closeProviderByWatchdog(id) {
  await providersService.setProviderOpenFlag(id, 'N', 'watchdog');
  await (0, _restaurante.fecharRestauranteInterno)(id);
  state.markClosedByWatchdog(id);
  console.log(`[watchdog] ${new Date().toISOString()} watchdog-close: ${id}`);
  (0, _restauranteEventos.registrarEventoRestaurante)(id, 'fechamento', 'watchdog');
}
async function runWatchdogTick(now = Date.now()) {
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
let watchdogTimer;
function startWatchdog(intervalMs = WATCHDOG_INTERVAL_MS) {
  if (watchdogTimer) return watchdogTimer;
  watchdogTimer = setInterval(() => {
    runWatchdogTick().catch(err => console.error('[watchdog] erro no ciclo', err));
  }, intervalMs);
  return watchdogTimer;
}
function stopWatchdog() {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = undefined;
  }
}
function onManualClose(id) {
  state.clearManualClose(id);
}