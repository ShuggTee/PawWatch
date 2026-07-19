import type { Sitter } from "../src/types";

// ── Database backend selection ──
// Local dev: bun:sqlite (fast, native, zero config)
// Production: @libsql/client → Turso (serverless-compatible, HTTP-based)
const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;
const useTurso = !!(TURSO_URL && TURSO_TOKEN && TURSO_URL.startsWith("libsql://"));

// ── Mock sitter data (must be defined before any init code runs) ──

const MOCK_SITTERS: Omit<Sitter, "id">[] = [
  {
    name: "Sarah Johnson",
    emoji: "🐕",
    rating: 4.9,
    reviewCount: 127,
    bio: "Experienced dog trainer with 8 years of pet sitting. I love all breeds and specialize in anxious pups.",
    pricePerHour: 25,
    specialties: ["Training", "Anxious dogs", "Senior care"],
  },
  {
    name: "Mike Chen",
    emoji: "🐾",
    rating: 4.7,
    reviewCount: 84,
    bio: "Pet first-aid certified and reliable. Your dog will get plenty of walks and belly rubs!",
    pricePerHour: 22,
    specialties: ["First-aid certified", "Active dogs", "Multiple pets"],
  },
  {
    name: "Emily Davis",
    emoji: "🦮",
    rating: 4.8,
    reviewCount: 156,
    bio: "Vet tech student who treats every dog like family. Available weekends and evenings.",
    pricePerHour: 28,
    specialties: ["Medical needs", "Puppies", "Overnight care"],
  },
  {
    name: "James Wilson",
    emoji: "🐶",
    rating: 4.6,
    reviewCount: 63,
    bio: "Active sitter who loves runs and hikes. Great with high-energy dogs who need lots of exercise.",
    pricePerHour: 20,
    specialties: ["Running buddy", "Large breeds", "Outdoor play"],
  },
  {
    name: "Lisa Park",
    emoji: "🐩",
    rating: 5.0,
    reviewCount: 92,
    bio: "10+ years of professional pet sitting. I treat every dog like my own with patience and love.",
    pricePerHour: 30,
    specialties: ["Long-term sits", "Special diets", "Grooming"],
  },
];

// ── Unified query interface ──

interface QueryHelper {
  get: (...params: unknown[]) => Record<string, unknown> | null;
  all: (...params: unknown[]) => Record<string, unknown>[];
}

let _query: ((sql: string) => QueryHelper) | null = null;
let _run: ((sql: string, ...params: unknown[]) => void) | null = null;
let _exec: ((sql: string) => void) | null = null;

// ── Schema initialization ──

function initSchema() {
  _exec!(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner', 'sitter')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  try { _exec!("ALTER TABLE users ADD COLUMN is_premium INTEGER NOT NULL DEFAULT 0"); } catch (_e: unknown) { /* exists */ }
  try { _exec!("ALTER TABLE users ADD COLUMN premium_until TEXT"); } catch (_e: unknown) { /* exists */ }

  _exec!(`
    CREATE TABLE IF NOT EXISTS sitter_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL REFERENCES users(id),
      emoji TEXT NOT NULL DEFAULT '🐾',
      rating REAL NOT NULL DEFAULT 5.0,
      review_count INTEGER NOT NULL DEFAULT 0,
      bio TEXT NOT NULL DEFAULT '',
      price_per_hour INTEGER NOT NULL DEFAULT 20,
      specialties TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  try { _exec!("ALTER TABLE sitter_profiles ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0"); } catch (_e: unknown) { /* exists */ }
  try { _exec!("ALTER TABLE sitter_profiles ADD COLUMN pending_verification INTEGER NOT NULL DEFAULT 0"); } catch (_e: unknown) { /* exists */ }
  try { _exec!("ALTER TABLE users ADD COLUMN pending_premium INTEGER NOT NULL DEFAULT 0"); } catch (_e: unknown) { /* exists */ }

  _exec!(`
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      sitter_id TEXT NOT NULL REFERENCES users(id),
      owner_id TEXT NOT NULL REFERENCES users(id),
      owner_name TEXT NOT NULL,
      dog_name TEXT NOT NULL,
      dog_breed TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed', 'in-progress', 'completed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  _exec!(`
    CREATE TABLE IF NOT EXISTS care_logs (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL REFERENCES bookings(id),
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      feeding INTEGER NOT NULL DEFAULT 0,
      feeding_notes TEXT NOT NULL DEFAULT '',
      water_changed INTEGER NOT NULL DEFAULT 0,
      treats INTEGER NOT NULL DEFAULT 0,
      treat_notes TEXT NOT NULL DEFAULT '',
      playtime_minutes INTEGER NOT NULL DEFAULT 0,
      playtime_notes TEXT NOT NULL DEFAULT ''
    )
  `);

  _exec!(`
    CREATE TABLE IF NOT EXISTS gps_positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id TEXT NOT NULL REFERENCES bookings(id),
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  _exec!(`
    CREATE TABLE IF NOT EXISTS email_notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      recipient_email TEXT NOT NULL DEFAULT '',
      sent_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  _exec!(`
    CREATE TABLE IF NOT EXISTS dogs (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      breed TEXT NOT NULL DEFAULT '',
      age INTEGER NOT NULL DEFAULT 0,
      weight REAL NOT NULL DEFAULT 0,
      photo_url TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

// ── Seed data ──

function seedMockSittersSync() {
  const count = _query!("SELECT COUNT(*) as c FROM sitter_profiles").get() as { c: number } | null;
  if (count && count.c > 0) return;

  for (let i = 0; i < MOCK_SITTERS.length; i++) {
    const s = MOCK_SITTERS[i];
    const userId = `mock-sitter-${i + 1}`;
    const profileId = `mock-profile-${i + 1}`;
    _run!(
      "INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, 'sitter', datetime('now'))",
      userId, `mock${i + 1}@pawwatch.internal`, "$2a$10$placeholder", s.name
    );
    _run!(
      "INSERT INTO sitter_profiles (id, user_id, emoji, rating, review_count, bio, price_per_hour, specialties, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))",
      profileId, userId, s.emoji, s.rating, s.reviewCount, s.bio, s.pricePerHour, JSON.stringify(s.specialties)
    );
  }
}

// ── Initialize database at module load time ──
// For local dev: synchronous bun:sqlite init
// For Turso/Vercel: lazy init via query()/run()

if (!useTurso) {
  const { Database } = await import("bun:sqlite");
  const DB_PATH = `${import.meta.dir}/../pawwatch.db`;
  const db = new Database(DB_PATH);
  db.run("PRAGMA journal_mode=WAL");
  db.run("PRAGMA foreign_keys=ON");

  _query = (sql: string): QueryHelper => ({
    get(...params: unknown[]) {
      return db.query(sql).get(...params) as Record<string, unknown> | null;
    },
    all(...params: unknown[]) {
      return db.query(sql).all(...params) as Record<string, unknown>[];
    },
  });

  _run = (sql: string, ...params: unknown[]) => {
    db.run(sql, ...params);
  };

  _exec = (sql: string) => {
    db.run(sql);
  };

  initSchema();
  seedMockSittersSync();
}

// ── Lazy Turso init (for production/Vercel) ──

let _tursoInitPromise: Promise<void> | null = null;

async function ensureTursoReady(): Promise<void> {
  if (_query) return; // Already initialized (bun:sqlite path)
  if (_tursoInitPromise) return _tursoInitPromise;

  _tursoInitPromise = (async () => {
    const { createClient } = await import("@libsql/client");
    const db = createClient({ url: TURSO_URL!, authToken: TURSO_TOKEN });

    _query = (sql: string): QueryHelper => ({
      get(...params: unknown[]) {
        const result = db.execute({ sql, args: params as string[] });
        return (result.rows[0] as Record<string, unknown> | undefined) ?? null;
      },
      all(...params: unknown[]) {
        const result = db.execute({ sql, args: params as string[] });
        return result.rows as Record<string, unknown>[];
      },
    });

    _run = (sql: string, ...params: unknown[]) => {
      db.execute({ sql, args: params as string[] });
    };

    _exec = (sql: string) => {
      db.execute(sql);
    };

    initSchema();

    // Seed mock sitters (async-safe version)
    const count = _query!("SELECT COUNT(*) as c FROM sitter_profiles").get() as { c: number } | null;
    if (!count || count.c === 0) {
      for (let i = 0; i < MOCK_SITTERS.length; i++) {
        const s = MOCK_SITTERS[i];
        const userId = `mock-sitter-${i + 1}`;
        const profileId = `mock-profile-${i + 1}`;
        _run!(
          "INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, 'sitter', datetime('now'))",
          userId, `mock${i + 1}@pawwatch.internal`, "$2a$10$placeholder", s.name
        );
        _run!(
          "INSERT INTO sitter_profiles (id, user_id, emoji, rating, review_count, bio, price_per_hour, specialties, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))",
          profileId, userId, s.emoji, s.rating, s.reviewCount, s.bio, s.pricePerHour, JSON.stringify(s.specialties)
        );
      }
    }
  })();

  return _tursoInitPromise;
}

// ── Exported query functions ──

export function query(sql: string): QueryHelper {
  if (!_query) {
    // Must be Turso lazy init path; throw synchronously for now
    // (on Vercel, init is triggered by a warm-up invocation before real traffic)
    throw new Error(
      "DB not initialized. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN for production, or use bun:sqlite for local dev."
    );
  }
  return _query(sql);
}

export function run(sql: string, ...params: unknown[]): void {
  if (!_run) {
    throw new Error(
      "DB not initialized. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN for production, or use bun:sqlite for local dev."
    );
  }
  _run(sql, ...params);
}

// ── Vercel: ensure Turso is ready before handling requests ──
export function waitForDb(): Promise<void> {
  if (_query) return Promise.resolve();
  return ensureTursoReady();
}

// ── Query helpers ──

export function getAllSitters(): Sitter[] {
  const rows = query(
    `SELECT sp.id, sp.emoji, sp.rating, sp.review_count, sp.bio, sp.price_per_hour, sp.specialties, sp.is_verified, u.name 
     FROM sitter_profiles sp JOIN users u ON sp.user_id = u.id`
  ).all() as any[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    rating: r.rating,
    reviewCount: r.review_count,
    bio: r.bio,
    pricePerHour: r.price_per_hour,
    specialties: JSON.parse(r.specialties as string),
    isVerified: !!(r.is_verified as number),
  }));
}

export function getSitterById(id: string): Sitter | undefined {
  const row = query(
    `SELECT sp.id, sp.emoji, sp.rating, sp.review_count, sp.bio, sp.price_per_hour, sp.specialties, sp.is_verified, u.name 
     FROM sitter_profiles sp JOIN users u ON sp.user_id = u.id WHERE sp.id = ?`
  ).get(id) as any;

  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    rating: row.rating,
    reviewCount: row.review_count,
    bio: row.bio,
    pricePerHour: row.price_per_hour,
    specialties: JSON.parse(row.specialties as string),
    isVerified: !!(row.is_verified as number),
  };
}

export function getSitterProfileByUserId(userId: string): Sitter | undefined {
  const row = query(
    `SELECT sp.id, sp.emoji, sp.rating, sp.review_count, sp.bio, sp.price_per_hour, sp.specialties, sp.is_verified, u.name 
     FROM sitter_profiles sp JOIN users u ON sp.user_id = u.id WHERE sp.user_id = ?`
  ).get(userId) as any;

  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    rating: row.rating,
    reviewCount: row.review_count,
    bio: row.bio,
    pricePerHour: row.price_per_hour,
    specialties: JSON.parse(row.specialties as string),
    isVerified: !!(row.is_verified as number),
  };
}
