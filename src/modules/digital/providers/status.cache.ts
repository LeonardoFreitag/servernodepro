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
export const STATUS_CACHE_TTL_MS = 5_000;

const MAX_ENTRIES = 500;

export interface CachedProviderStatus {
  found: boolean;
  open: boolean;
  source?: string;
  since?: string;
}

interface CacheEntry {
  expiresAt: number;
  value: CachedProviderStatus;
}

const cache = new Map<string, CacheEntry>();

export function getCachedStatus(id: string, now: number = Date.now()): CachedProviderStatus | undefined {
  const entry = cache.get(id);
  if (!entry) return undefined;

  if (entry.expiresAt <= now) {
    cache.delete(id);
    return undefined;
  }

  return entry.value;
}

export function setCachedStatus(id: string, value: CachedProviderStatus, now: number = Date.now()): void {
  if (cache.size >= MAX_ENTRIES) prune(now);
  cache.set(id, { expiresAt: now + STATUS_CACHE_TTL_MS, value });
}

export function invalidateStatusCache(id: string): void {
  cache.delete(id);
}

export function resetStatusCache(): void {
  cache.clear();
}

function prune(now: number): void {
  for (const [id, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(id);
  }

  // Fallback defensivo: se tudo ainda estiver válido, descarta a entrada mais antiga.
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
}
