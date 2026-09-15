"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getProviderStatus = getProviderStatus;
exports.isOpenFlag = isOpenFlag;
var providersService = _interopRequireWildcard(require("./providers.service"));
var _status = require("./status.cache");
var _datetime = require("../../../shared/utils/datetime");
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
/**
 * Origem do estado atual. Valor livre — o PDV apenas exibe, não decide nada com base nele.
 * 'manual'    -> PUT /providers
 * 'heartbeat' -> reaberto pelo heartbeat do PDV
 * 'watchdog'  -> fechado por ausência de heartbeat
 * 'panel'     -> painel web
 */

/** Campo `open` do Firestore: 'S'/'N' hoje, tolerante a boolean caso o painel mude. */
function isOpenFlag(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim().toUpperCase() === 'S';
  return false;
}

/**
 * Leitura pura do estado persistido do provider. Não abre, não fecha, não registra
 * heartbeat, não toca em lastHeartbeatAt e não interfere no watchdog.
 */
async function getProviderStatus(id, now = Date.now()) {
  const cached = (0, _status.getCachedStatus)(id, now);
  const entry = cached ?? (await readProviderState(id, now));
  if (!entry.found) return {
    status: 'unknown'
  };
  return {
    status: 'ok',
    data: {
      open: entry.open,
      ...(entry.source ? {
        source: entry.source
      } : {}),
      ...(entry.since ? {
        since: entry.since
      } : {}),
      serverTime: (0, _datetime.toIsoOffset)(new Date(now))
    }
  };
}
async function readProviderState(id, now) {
  const snapshot = await providersService.getProviderSnapshot(id);
  if (!snapshot.exists) {
    const miss = {
      found: false,
      open: false
    };
    (0, _status.setCachedStatus)(id, miss, now);
    return miss;
  }
  const data = snapshot.data() ?? {};
  const source = typeof data.openSource === 'string' && data.openSource.trim() ? data.openSource.trim() : undefined;
  const value = {
    found: true,
    open: isOpenFlag(data.open),
    source,
    since: (0, _datetime.normalizeToIso)(data.openChangedAt)
  };
  (0, _status.setCachedStatus)(id, value, now);
  return value;
}