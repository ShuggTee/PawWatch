import { query, run } from "./db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET =
  process.env.JWT_SECRET || "pawwatch-dev-secret-change-in-production";
const TOKEN_EXPIRY = "7d";

export interface UserPayload {
  userId: string;
  email: string;
  name: string;
  role: "owner" | "sitter";
  isPremium: boolean;
  premiumUntil: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "owner" | "sitter";
  isPremium: boolean;
  premiumUntil: string | null;
  isVerified?: boolean;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function createToken(payload: UserPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): UserPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload;
  } catch {
    return null;
  }
}

export function createUser(
  email: string,
  password: string,
  name: string,
  role: "owner" | "sitter",
): { user: AuthUser; token: string } | { error: string } {
  const existing = query("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const id = generateId();
  const passwordHash = hashPassword(password);

  run(
    "INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)",
    id,
    email,
    passwordHash,
    name,
    role,
  );

  // If sitter, create a sitter profile automatically
  if (role === "sitter") {
    const profileId = generateId();
    run(
      "INSERT INTO sitter_profiles (id, user_id, emoji, bio, specialties) VALUES (?, ?, '🐾', 'New PawWatch sitter!', '[]')",
      profileId,
      id,
    );
  }

  const user: AuthUser = {
    id,
    email,
    name,
    role,
    isPremium: false,
    premiumUntil: null,
  };
  const token = createToken({
    userId: id,
    email,
    name,
    role,
    isPremium: false,
    premiumUntil: null,
  });
  return { user, token };
}

export function loginUser(
  email: string,
  password: string,
): { user: AuthUser; token: string } | { error: string } {
  const row = query(
    "SELECT id, email, password_hash, name, role, is_premium, premium_until FROM users WHERE email = ?",
  ).get(email) as any;

  if (!row) {
    return { error: "Invalid email or password." };
  }

  if (!verifyPassword(password, row.password_hash)) {
    return { error: "Invalid email or password." };
  }

  const isPremium = !!row.is_premium;
  const premiumUntil = row.premium_until || null;

  const user: AuthUser = {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as "owner" | "sitter",
    isPremium,
    premiumUntil,
  };
  const token = createToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isPremium,
    premiumUntil,
  });
  return { user, token };
}

export function getUserById(id: string): AuthUser | undefined {
  const row = query(
    `SELECT u.id, u.email, u.name, u.role, u.is_premium, u.premium_until, sp.is_verified 
     FROM users u LEFT JOIN sitter_profiles sp ON sp.user_id = u.id WHERE u.id = ?`,
  ).get(id) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as "owner" | "sitter",
    isPremium: !!row.is_premium,
    premiumUntil: row.premium_until || null,
    isVerified: !!row.is_verified,
  };
}
