// scripts/backup-db.ts
// Creates a rolling backup of the SQLite database (7 days max)
// Usage: npx tsx scripts/backup-db.ts

import fs from "fs";
import path from "path";

const DB_PATH = path.resolve(process.env.DATABASE_PATH || ".data/app.db");
const BACKUP_DIR = path.join(process.cwd(), "backups");
const MAX_BACKUPS = 7;

function backup() {
  if (!fs.existsSync(DB_PATH)) {
    console.log("❌ Database not found:", DB_PATH);
    process.exit(1);
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const backupPath = path.join(BACKUP_DIR, `app-${date}.db`);

  fs.copyFileSync(DB_PATH, backupPath);
  console.log(`✅ Backup created: ${backupPath}`);

  // Also backup WAL if it exists
  const walPath = DB_PATH + "-wal";
  if (fs.existsSync(walPath)) {
    fs.copyFileSync(walPath, backupPath + "-wal");
  }

  // Prune old backups (keep MAX_BACKUPS)
  const backups = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("app-") && f.endsWith(".db"))
    .sort()
    .reverse();

  for (const old of backups.slice(MAX_BACKUPS)) {
    const fullPath = path.join(BACKUP_DIR, old);
    fs.unlinkSync(fullPath);
    // Also remove WAL backup if exists
    const walBackup = fullPath + "-wal";
    if (fs.existsSync(walBackup)) fs.unlinkSync(walBackup);
    console.log(`🗑️  Removed old backup: ${old}`);
  }
}

backup();
