import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { DrizzleDB } from '../../src/database/types/drizzle.type';

/**
 * A recording stand-in for the Drizzle handle, for unit-testing services
 * without Postgres.
 *
 * Every query the service builds — `db.select().from(t).where(...)`,
 * `db.insert(t).values(...).returning()`, `db.update(t).set(...).where(...)`,
 * `db.delete(t).where(...)`, `db.execute(sql)` and `db.transaction(fn)` — is
 * recorded as a [Call] with each chained step and its arguments. Awaiting a
 * chain resolves to whatever was queued for that (kind, table) with
 * `onSelect` / `onInsert` / `onUpdate` / `onExecute`, or to a safe empty value.
 *
 * `transaction(fn)` just runs `fn` against the same fake, so calls made inside
 * it are recorded too (and flagged `inTransaction`), which lets a test assert
 * that balance moves happen inside the transactional block.
 *
 * SQL fragments (a `where` clause, a `set` value like
 * ``sql`${wallets.balanceKhr} + ${delta}` ``) are rendered with Drizzle's own
 * dialect via [render], so assertions run on the real bound parameters.
 */
export type CallKind = 'select' | 'insert' | 'update' | 'delete' | 'execute';

export interface Step {
  name: string;
  args: unknown[];
}

export interface Call {
  kind: CallKind;
  /** The Drizzle table object the call targets (by reference). */
  table?: unknown;
  steps: Step[];
  inTransaction: boolean;
}

const dialect = new PgDialect();

/** Renders a Drizzle SQL fragment to its text + bound params. */
export function render(fragment: SQL | undefined): {
  sql: string;
  params: unknown[];
} {
  if (!fragment) return { sql: '', params: [] };
  const q = dialect.sqlToQuery(fragment);
  return { sql: q.sql, params: q.params };
}

export class FakeDb {
  readonly calls: Call[] = [];
  /** How many `db.transaction(...)` blocks ran. */
  transactions = 0;

  private readonly selectQueue = new Map<unknown, unknown[][]>();
  private readonly insertQueue = new Map<unknown, unknown[][]>();
  private readonly updateQueue = new Map<unknown, unknown[][]>();
  private readonly executeQueue: unknown[] = [];
  private depth = 0;

  /** Queue the rows the next `select ... from(table)` resolves to. */
  onSelect(table: unknown, rows: unknown[]): this {
    push(this.selectQueue, table, rows);
    return this;
  }

  /** Queue the rows the next `insert(table) ... returning()` resolves to. */
  onInsert(table: unknown, rows: unknown[]): this {
    push(this.insertQueue, table, rows);
    return this;
  }

  /** Queue the rows the next `update(table) ... returning()` resolves to. */
  onUpdate(table: unknown, rows: unknown[]): this {
    push(this.updateQueue, table, rows);
    return this;
  }

  /** Queue the result of the next `execute(sql)` (e.g. `{ rows: [...] }`). */
  onExecute(result: unknown): this {
    this.executeQueue.push(result);
    return this;
  }

  /** The handle to inject as `DRIZZLE`. */
  get db(): DrizzleDB {
    return this.root as unknown as DrizzleDB;
  }

  // ---- assertions --------------------------------------------------------

  of(kind: CallKind, table?: unknown): Call[] {
    return this.calls.filter(
      (c) => c.kind === kind && (table === undefined || c.table === table),
    );
  }

  /** `values(...)` payloads of every insert into [table]. */
  inserted(table: unknown): Record<string, unknown>[] {
    return this.of('insert', table).map(
      (c) => step(c, 'values')?.args[0] as Record<string, unknown>,
    );
  }

  /** `set(...)` payload + rendered `where` of every update to [table]. */
  updated(table: unknown): {
    set: Record<string, unknown>;
    where: { sql: string; params: unknown[] };
    inTransaction: boolean;
  }[] {
    return this.of('update', table).map((c) => ({
      set: step(c, 'set')?.args[0] as Record<string, unknown>,
      where: render(step(c, 'where')?.args[0] as SQL | undefined),
      inTransaction: c.inTransaction,
    }));
  }

  /** Rendered `where` of every delete from [table]. */
  deleted(table: unknown): { sql: string; params: unknown[] }[] {
    return this.of('delete', table).map((c) =>
      render(step(c, 'where')?.args[0] as SQL | undefined),
    );
  }

  /** Rendered `where` of every select from [table]. */
  selected(table: unknown): { sql: string; params: unknown[] }[] {
    return this.of('select', table).map((c) =>
      render(step(c, 'where')?.args[0] as SQL | undefined),
    );
  }

  // ---- the fake handle ---------------------------------------------------

  private readonly root = {
    select: (...args: unknown[]) => this.chain('select', undefined, args),
    insert: (table: unknown) => this.chain('insert', table, [table]),
    update: (table: unknown) => this.chain('update', table, [table]),
    delete: (table: unknown) => this.chain('delete', table, [table]),
    execute: (fragment: unknown) =>
      this.chain('execute', undefined, [fragment]),
    transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      this.transactions++;
      this.depth++;
      try {
        return await fn(this.root);
      } finally {
        this.depth--;
      }
    },
  };

  private chain(kind: CallKind, table: unknown, args: unknown[]) {
    const call: Call = {
      kind,
      table,
      steps: [{ name: kind, args }],
      inTransaction: this.depth > 0,
    };
    this.calls.push(call);
    const proxy: unknown = new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (typeof prop === 'symbol') return undefined;
          if (prop === 'then') {
            return (
              resolve: (v: unknown) => unknown,
              reject: (e: unknown) => unknown,
            ) => Promise.resolve(this.resolve(call)).then(resolve, reject);
          }
          if (prop === 'catch' || prop === 'finally') return undefined;
          return (...stepArgs: unknown[]) => {
            call.steps.push({ name: prop, args: stepArgs });
            if (prop === 'from') call.table = stepArgs[0];
            return proxy;
          };
        },
      },
    );
    return proxy;
  }

  private resolve(call: Call): unknown {
    switch (call.kind) {
      case 'select':
        return shift(this.selectQueue, call.table) ?? [];
      case 'insert':
        return shift(this.insertQueue, call.table) ?? [{}];
      case 'update':
        return shift(this.updateQueue, call.table) ?? [{}];
      case 'delete':
        return [];
      case 'execute':
        return this.executeQueue.shift() ?? { rows: [] };
    }
  }
}

function push(map: Map<unknown, unknown[][]>, key: unknown, rows: unknown[]) {
  const list = map.get(key) ?? [];
  list.push(rows);
  map.set(key, list);
}

function shift(map: Map<unknown, unknown[][]>, key: unknown) {
  return map.get(key)?.shift();
}

function step(call: Call, name: string): Step | undefined {
  return call.steps.find((s) => s.name === name);
}

/** A `NotificationsService` double: records `emit` calls, never throws. */
export function fakeNotifications() {
  return { emit: jest.fn().mockResolvedValue(undefined) };
}
