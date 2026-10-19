/**
 * Helpers promissificados sobre node-firebird.
 *
 * O projeto usa `Firebird.attach` por chamada (sem pool). Estes helpers
 * mantêm esse padrão, mas evitam repetir o boilerplate de callback e
 * permitem executar várias instruções numa única transação (necessário
 * para o desfecho de cobrança: UPDATE + INSERT atômicos).
 */
import Firebird from 'node-firebird';
import firebirdOptions from './firebird';

/** Algo que sabe executar SQL — o Database (auto-commit) ou uma Transaction. */
export interface Executor {
  query(sql: string, params?: any[]): Promise<any>;
}

function promisifyQuery(target: {
  query(sql: string, params: any[], cb: (err: Error | null, result: any) => void): void;
}): Executor {
  return {
    query(sql: string, params: any[] = []) {
      return new Promise((resolve, reject) => {
        target.query(sql, params, (err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
      });
    },
  };
}

function attach(): Promise<Firebird.Database> {
  return new Promise((resolve, reject) => {
    Firebird.attach(firebirdOptions, (err, db) => {
      if (err) return reject(err);
      resolve(db);
    });
  });
}

/** Executa `fn` com uma conexão em auto-commit e fecha a conexão ao final. */
export async function withDb<T>(fn: (db: Executor) => Promise<T>): Promise<T> {
  const db = await attach();
  try {
    return await fn(promisifyQuery(db));
  } finally {
    db.detach();
  }
}

/** Atalho: uma única consulta em auto-commit. */
export function fbQuery(sql: string, params: any[] = []): Promise<any> {
  return withDb((db) => db.query(sql, params));
}

/**
 * Executa `fn` dentro de uma transação READ COMMITTED (WAIT). Commit se `fn`
 * resolver, rollback se rejeitar. A conexão é fechada em ambos os casos.
 */
export async function withTransaction<T>(fn: (tr: Executor) => Promise<T>): Promise<T> {
  const db = await attach();
  try {
    const tr = await new Promise<Firebird.Transaction>((resolve, reject) => {
      db.transaction(Firebird.ISOLATION_READ_COMMITED, (err, transaction) => {
        if (err) return reject(err);
        resolve(transaction);
      });
    });
    try {
      const result = await fn(promisifyQuery(tr));
      await new Promise<void>((resolve, reject) => {
        tr.commit((err) => (err ? reject(err) : resolve()));
      });
      return result;
    } catch (error) {
      try { tr.rollback(); } catch { /* ignora */ }
      throw error;
    }
  } finally {
    db.detach();
  }
}

/** Converte BLOB TEXT (Buffer) ou string em string; null se vazio. */
export function blobToString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  return String(value);
}

/** Date (node-firebird) → ISO 8601; null preservado. */
export function toIso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value as any);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/*
 * BLOBs: o node-firebird 0.9.9 devolve colunas BLOB em `query()` como uma função
 * de leitura preguiçosa que abre transação própria e falha com "invalid BLOB ID"
 * (dentro de uma transação e também depois do auto-commit). Para ler um BLOB
 * TEXT, use `CAST(coluna AS VARCHAR(n))` no SQL e `blobToString` no resultado.
 */

/** gdscode do Firebird num erro do node-firebird (quando presente). */
export function gdscode(err: unknown): number | null {
  const code = (err as any)?.gdscode;
  return typeof code === 'number' ? code : null;
}

/**
 * Violação de unicidade: 335544349 (índice único — `UK_CIELO_PAG_ORDER_EXPR`)
 * ou 335544665 (constraint PRIMARY/UNIQUE KEY).
 */
export function isViolacaoUnica(err: unknown): boolean {
  const code = gdscode(err);
  if (code === 335544349 || code === 335544665) return true;
  const msg = String((err as Error)?.message ?? '');
  return /duplicate value .* unique index|violation of PRIMARY or UNIQUE KEY/i.test(msg);
}

/** "Table unknown" (335544580) — usado para tratar VERSAO_SCRIPTS ausente como script 0. */
export function isTabelaInexistente(err: unknown): boolean {
  if (gdscode(err) === 335544580) return true;
  return /Table unknown/i.test(String((err as Error)?.message ?? ''));
}
