import { Database } from 'sql.js';

export interface Migration {
  version: number;
  up(db: Database): void;
  down?(db: Database): void;
}

const migrations: Migration[] = [
  {
    version: 1,
    up(db: Database) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS _migrations (
          version INTEGER PRIMARY KEY,
          applied_at INTEGER NOT NULL
        );
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          color TEXT,
          sort INTEGER DEFAULT 0,
          created_at INTEGER NOT NULL
        );
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT DEFAULT '',
          priority INTEGER DEFAULT 3,
          status TEXT DEFAULT 'todo',
          progress INTEGER DEFAULT 0,
          start_time INTEGER,
          due_time INTEGER,
          reminder_time INTEGER,
          recurrence_type TEXT,
          category_id TEXT,
          parent_id TEXT,
          sort INTEGER DEFAULT 0,
          estimated_pomodoro INTEGER DEFAULT 1,
          ai_meta TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY(parent_id) REFERENCES tasks(id),
          FOREIGN KEY(category_id) REFERENCES categories(id)
        );

        CREATE INDEX IF NOT EXISTS idx_task_parent ON tasks(parent_id);
        CREATE INDEX IF NOT EXISTS idx_task_status ON tasks(status);
        CREATE INDEX IF NOT EXISTS idx_task_priority ON tasks(priority);
        CREATE INDEX IF NOT EXISTS idx_task_due ON tasks(due_time);
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS task_tags (
          task_id TEXT NOT NULL,
          tag_id TEXT NOT NULL,
          PRIMARY KEY(task_id, tag_id)
        );
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          icon TEXT,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS template_steps (
          id TEXT PRIMARY KEY,
          template_id TEXT NOT NULL,
          title TEXT NOT NULL,
          sort INTEGER NOT NULL,
          default_priority INTEGER DEFAULT 3,
          default_pomodoro INTEGER DEFAULT 1
        );
      `);
    },
    down(db: Database) {
      const statements = [
        'DROP TABLE IF EXISTS template_steps',
        'DROP TABLE IF EXISTS templates',
        'DROP TABLE IF EXISTS task_tags',
        'DROP TABLE IF EXISTS tags',
        'DROP TABLE IF EXISTS tasks',
        'DROP TABLE IF EXISTS categories',
      ];
      for (const sql of statements) {
        db.exec(sql);
      }
    },
  },
  {
    version: 2,
    up(db: Database) {
      // Fix category names: English → Chinese
      // Note: applyMigration already wraps this in a transaction, so we don't
      // need our own BEGIN/COMMIT here.
      const categoryMappings: [string, string][] = [
        ['Work', '工作'],
        ['work', '工作'],
        ['Study', '学习'],
        ['study', '学习'],
        ['Life', '生活'],
        ['life', '生活'],
        ['Project', '项目'],
        ['project', '项目'],
      ];
      const updateStmt = db.prepare('UPDATE categories SET name = ? WHERE name = ?');
      for (const [from, to] of categoryMappings) {
        updateStmt.run([to, from]);
      }
      updateStmt.free();
    },
  },
  {
    version: 3,
    up(db: Database) {
      db.exec(`
        ALTER TABLE tasks ADD COLUMN recurrence_days TEXT;
      `);
    },
  },
];

export function getAppliedMigrations(db: Database): number[] {
  try {
    const stmt = db.prepare('SELECT version FROM _migrations ORDER BY version');
    const rows: { version: number }[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as { version: number });
    }
    stmt.free();
    return rows.map((r) => r.version);
  } catch {
    return [];
  }
}

export function applyMigration(
  db: Database,
  migration: Migration
): void {
  db.exec('BEGIN');
  try {
    migration.up(db);
    const upsert = db.prepare(
      'INSERT OR REPLACE INTO _migrations (version, applied_at) VALUES (?, ?)'
    );
    upsert.run([migration.version, Date.now()]);
    upsert.free();
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function runAllMigrations(db: Database): void {
  const applied = getAppliedMigrations(db);

  for (const migration of migrations) {
    if (!applied.includes(migration.version)) {
      console.log(`Applying migration v${migration.version}...`);
      applyMigration(db, migration);
      console.log(`Migration v${migration.version} applied successfully.`);
    }
  }
}

export { migrations };