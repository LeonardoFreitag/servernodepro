import fs from 'fs';
import path from 'path';

/**
 * Log em arquivo dos pagamentos de maquineta (JSON por linha), no padrão de
 * `restauranteEventos.ts`. Serve para auditar o que a API recebeu quando o
 * caixa diz que "o pagamento não apareceu". Nunca lança.
 */
export type PagamentoLogEvento =
  | 'ok'            // gravado
  | 'duplicado'     // já existia (idempotência)
  | 'rejeitado'     // 4xx de validação
  | 'erro'          // 5xx (Firebird etc.)
  | 'estorno_manual'
  | 'desfecho_ok'   // PATCH /cobrancas/:id
  | 'desfecho_erro';

// Fora de src/dist para sobreviver a rebuilds (pasta /logs está no .gitignore).
const LOG_FILE = path.join(process.cwd(), 'logs', 'pagamentos.jsonl');

export function logPagamento(evento: PagamentoLogEvento, dados: Record<string, unknown> = {}): void {
  try {
    const linha = { timestamp: new Date().toISOString(), evento, ...dados };
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, JSON.stringify(linha) + '\n');
  } catch {
    /* log nunca derruba a requisição */
  }
}

/** Resumo do erro para o log (mensagem + gdscode do Firebird, se houver). */
export function resumoErro(err: unknown): { mensagem: string; gdscode?: number } {
  const mensagem = (err as Error)?.message ?? String(err);
  const code = (err as any)?.gdscode;
  return typeof code === 'number' ? { mensagem, gdscode: code } : { mensagem };
}
