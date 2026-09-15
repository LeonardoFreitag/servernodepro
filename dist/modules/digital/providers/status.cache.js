"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.STATUS_CACHE_TTL_MS = void 0;
exports.getCachedStatus = getCachedStatus;
exports.invalidateStatusCache = invalidateStatusCache;
exports.resetStatusCache = resetStatusCache;
exports.setCachedStatus = setCachedStatus;
/**
 * Cache em memória do estado publicado por GET /providers/status.
 *
 * O PDV consulta a cada 30 s por terminal (~16 req/min em uma loja com 8 caixas);
 * o cache evita uma leitura no Firestore por requisição. TTL curto + invalidação
 * nas escritas feitas por este processo (PUT /providers, heartbeat e watchdog)
 * garantem que uma mudança de estado apareça bem abaixo dos ~10 s exigidos.
 *
 * Módulo sem dependências de propósito: é importado tanto pelo leitor
 * (status.service) quanto pelos escritores, sem criar ciclo de imports.
 */
const STATUS_CACHE_TTL_MS = exports.STATUS_CACHE_TTL_MS = 5_000;
const MAX_ENTRIES = 500;
const cache = new Map();
function getCachedStatus(id, now = Date.now()) {
  const entry = cache.get(id);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    cache.delete(id);
    return undefined;
  }
  return entry.value;
}
function setCachedStatus(id, value, now = Date.now()) {
  if (cache.size >= MAX_ENTRIES) prune(now);
  cache.set(id, {
    expiresAt: now + STATUS_CACHE_TTL_MS,
    value
  });
}
function invalidateStatusCache(id) {
  cache.delete(id);
}
function resetStatusCache() {
  cache.clear();
}
function prune(now) {
  for (const [id, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(id);
  }

  // Fallback defensivo: se tudo ainda estiver válido, descarta a entrada mais antiga.
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
}