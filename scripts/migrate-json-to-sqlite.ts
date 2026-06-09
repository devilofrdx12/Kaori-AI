// scripts/migrate-json-to-sqlite.ts
// Migrates existing JSON flat-file data to SQLite
// Usage: npx tsx scripts/migrate-json-to-sqlite.ts

import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import crypto from "crypto";

const USERS_JSON = path.join(process.cwd(), ".data/users.json");
const CHATS_JSON = path.join(process.cwd(), ".data/chats.json");
const DB_PATH = path.join(process.cwd(), process.env.DATABASE_PATH || ".data/app.db");
const SCHEMA_PATH = path.join(process.cwd(), "db/schema.sql");

function migrate() {
  console.log("🔄 Starting JSON → SQLite migration...\n");

  // Backup JSON files
  for (const file of [USERS_JSON, CHATS_JSON]) {
    if (fs.existsSync(file)) {
      const backup = file + ".backup";
      fs.copyFileSync(file, backup);
      console.log(`📦 Backed up ${path.basename(file)} → ${path.basename(backup)}`);
    }
  }

  // Ensure DB directory exists
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  // Open DB
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Apply schema
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
  db.exec(schema);
  console.log("✅ Schema applied\n");

  // Read JSON data
  const users = fs.existsSync(USERS_JSON)
    ? JSON.parse(fs.readFileSync(USERS_JSON, "utf-8") || "[]")
    : [];

  const chats = fs.existsSync(CHATS_JSON)
    ? JSON.parse(fs.readFileSync(CHATS_JSON, "utf-8") || "[]")
    : [];

  // Prepare statements
  const insertUser = db.prepare(
    `INSERT OR IGNORE INTO users (id, name, email, password_hash, created_at)
     VALUES (@id, @name, @email, @password_hash, @created_at)`
  );

  const insertConv = db.prepare(
    `INSERT OR IGNORE INTO conversations (id, user_id, title, created_at, updated_at)
     VALUES (@id, @user_id, @title, @created_at, @updated_at)`
  );

  const insertMsg = db.prepare(
    `INSERT OR IGNORE INTO messages (id, conversation_id, role, content, created_at)
     VALUES (@id, @conversation_id, @role, @content, @created_at)`
  );

  // Run in a transaction for speed
  const runAll = db.transaction(() => {
    // Migrate users
    for (const u of users) {
      const createdAt = u.createdAt
        ? Math.floor(new Date(u.createdAt).getTime() / 1000)
        : Math.floor(Date.now() / 1000);

      insertUser.run({
        id: u.id,
        name: u.name,
        email: u.email,
        password_hash: u.passwordHash,
        created_at: createdAt,
      });
    }

    // Migrate chats → conversations + messages
    for (const c of chats) {
      const createdAt = c.createdAt
        ? Math.floor(new Date(c.createdAt).getTime() / 1000)
        : Math.floor(Date.now() / 1000);
      const updatedAt = c.updatedAt
        ? Math.floor(new Date(c.updatedAt).getTime() / 1000)
        : createdAt;

      insertConv.run({
        id: c.id,
        user_id: c.userId,
        title: c.title || "New Chat",
        created_at: createdAt,
        updated_at: updatedAt,
      });

      for (const msg of c.messages || []) {
        const msgCreatedAt = msg.timestamp
          ? Math.floor(new Date(msg.timestamp).getTime() / 1000)
          : Math.floor(Date.now() / 1000);

        insertMsg.run({
          id: msg.id || crypto.randomUUID(),
          conversation_id: c.id,
          role: msg.role,
          content: typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content),
          created_at: msgCreatedAt,
        });
      }
    }
  });

  runAll();

  // Summary
  const userCount = db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number };
  const convCount = db.prepare("SELECT COUNT(*) as c FROM conversations").get() as { c: number };
  const msgCount = db.prepare("SELECT COUNT(*) as c FROM messages").get() as { c: number };

  console.log(`✅ Migrated:`);
  console.log(`   ${userCount.c} users`);
  console.log(`   ${convCount.c} conversations`);
  console.log(`   ${msgCount.c} messages`);
  console.log(`\n📁 Database: ${DB_PATH}`);

  db.close();
}

migrate();
