/**
 * Formatação ISO-8601 com o offset local do servidor (ex.: 2026-09-12T19:42:31-04:00).
 *
 * O PDV (Delphi) consome esses campos apenas para exibição; manter o offset local
 * evita que o caixa veja horários em UTC.
 */
function pad(value: number, size = 2): string {
  return String(Math.abs(value)).padStart(size, '0');
}

export function toIsoOffset(date: Date = new Date()): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const offset = `${sign}${pad(Math.floor(Math.abs(offsetMinutes) / 60))}:${pad(Math.abs(offsetMinutes) % 60)}`;

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${offset}`
  );
}

/**
 * Normaliza para ISO-8601 valores vindos do Firestore, que podem ser Timestamp,
 * Date, epoch em ms ou string já formatada (painel web / documentos legados).
 */
export function normalizeToIso(value: unknown): string | undefined {
  if (value == null) return undefined;

  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : toIsoOffset(parsed);
  }

  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : toIsoOffset(parsed);
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : toIsoOffset(value);
  }

  const maybeTimestamp = value as { toDate?: () => Date };
  if (typeof maybeTimestamp.toDate === 'function') {
    try {
      return toIsoOffset(maybeTimestamp.toDate());
    } catch {
      return undefined;
    }
  }

  return undefined;
}
