declare module 'sql.js' {
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }

  interface Statement {
    bind(params?: unknown[]): boolean;
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    get(): unknown[];
    run(params?: unknown[]): void;
    free(): boolean;
    reset(): void;
  }

  interface Database {
    exec(sql: string): void;
    prepare(sql: string): Statement;
    run(sql: string, params?: unknown[]): Database;
    export(): Uint8Array;
    close(): void;
    getRowsModified(): number;
  }

  export type { Database, Statement };

  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string;
  }): Promise<SqlJsStatic>;
}
