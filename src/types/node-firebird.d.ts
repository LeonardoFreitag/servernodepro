declare module 'node-firebird' {
  const ISOLATION_READ_COMMITED: number;

  interface Options {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    lowercase_keys: boolean;
    role: string | null;
    pageSize: number;
  }

  interface Transaction {
    query(sql: string, params: any[], callback: (err: Error | null, result: any[]) => void): void;
    commit(callback: (err: Error | null) => void): void;
    rollback(): void;
  }

  interface Database {
    query(sql: string, callback: (err: Error | null, result: any[]) => void): void;
    query(sql: string, params: any[], callback: (err: Error | null, result: any[]) => void): void;
    transaction(isolation: number, callback: (err: Error | null, transaction: Transaction) => void): void;
    detach(): void;
  }

  function attach(options: Options, callback: (err: Error | null, db: Database) => void): void;
}
