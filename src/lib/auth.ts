import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DB_PATH, getDb } from "./db";
import type { SessionUser } from "./types";

export const COOKIE_NAME = "ff_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

// Temporariamente, a aplicação pode ser aberta sem login. Desative com
// PUBLIC_ACCESS=false antes de disponibilizar dados para outras pessoas.
export const PUBLIC_ACCESS = process.env.PUBLIC_ACCESS !== "false";

let cachedSecret: Uint8Array | null = null;

function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const fromEnv = process.env.AUTH_SECRET;
  if (fromEnv && fromEnv.length >= 16) {
    cachedSecret = new TextEncoder().encode(fromEnv);
    return cachedSecret;
  }
  // Sem AUTH_SECRET: gera um segredo aleatório e mantém em disco (ao lado do banco).
  const file = path.join(path.dirname(DB_PATH), ".auth-secret");
  let secret: string;
  try {
    secret = fs.readFileSync(file, "utf8").trim();
  } catch {
    secret = crypto.randomBytes(48).toString("base64");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, secret, { mode: 0o600 });
  }
  cachedSecret = new TextEncoder().encode(secret);
  return cachedSecret;
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

function getPublicAccessUser(): SessionUser | null {
  if (!PUBLIC_ACCESS) return null;
  const user = getDb()
    .prepare("SELECT id, name, email FROM users ORDER BY created_at LIMIT 1")
    .get() as SessionUser | undefined;
  return user ?? null;
}

export async function createSession(userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getSecret());
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return getPublicAccessUser();
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub) return null;
    const user = getDb()
      .prepare("SELECT id, name, email FROM users WHERE id = ?")
      .get(payload.sub) as SessionUser | undefined;
    return user ?? getPublicAccessUser();
  } catch {
    return getPublicAccessUser();
  }
}

/* ---------- limitador simples de tentativas de login (em memória) ---------- */
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function loginRateLimited(key: string): boolean {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.resetAt < now) return false;
  return a.count >= MAX_ATTEMPTS;
}
export function registerLoginFailure(key: string) {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.resetAt < now) attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else a.count++;
}
export function clearLoginFailures(key: string) {
  attempts.delete(key);
}
