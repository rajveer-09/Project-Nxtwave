/*

Author : Rajveer Sharma
Date : 15 Nov 2026
@ Nxtwave

*/

import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";
import bcrypt from "bcryptjs";

/**
 * Password hashing for the unified login.
 *
 * New hashes:  scrypt$N$r$p$<salt b64>$<key b64>   (same layout NxtRank uses)
 * Also verified, so migrated accounts keep working without a reset:
 *   - Interactions app:  scrypt$<salt b64>$<key b64>   (Node defaults N=16384, r=8, p=1)
 *   - Attendance app:    bcrypt  $2a$ / $2b$ / $2y$
 * After a successful login with an older format, callers re-hash (needsRehash).
 *
 * Self-contained on purpose (no relative imports) so scripts can import it directly.
 */

const N = 2 ** 14;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
export const MIN_PASSWORD_LENGTH = 10;

function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, keylen, { ...options, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/**
 * The shared first password: accepted only until someone chooses their own (core.staff.must_set_password,
 * or a student without a password), and the first page after it asks them to choose one.
 */
export const FIRST_PASSWORD = "nxtwave";
export const isFirstPassword = (password: string) => password === FIRST_PASSWORD;

/** Policy for passwords people choose. Not applied when re-hashing an existing password at sign-in. */
export function passwordPolicyError(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.trim().toLowerCase().includes(FIRST_PASSWORD)) return "Choose a password that isn't based on the default one.";
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

function safeEqual(a: Buffer, b: Buffer) {
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  try {
    if (/^\$2[aby]\$/.test(stored)) return await bcrypt.compare(password, stored);
    const parts = stored.split("$");
    if (parts[0] !== "scrypt") return false;
    if (parts.length === 6) {
      const [, n, r, p, saltB64, keyB64] = parts;
      const expected = Buffer.from(keyB64, "base64");
      const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, {
        N: Number(n),
        r: Number(r),
        p: Number(p),
      });
      return safeEqual(actual, expected);
    }
    if (parts.length === 3) {
      const [, saltB64, keyB64] = parts;
      const expected = Buffer.from(keyB64, "base64");
      const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, { N: 16384, r: 8, p: 1 });
      return safeEqual(actual, expected);
    }
    return false;
  } catch {
    return false;
  }
}

/** True for any stored hash that isn't in the current format and parameters. */
export function needsRehash(stored: string): boolean {
  const parts = stored.split("$");
  return !(parts.length === 6 && parts[0] === "scrypt" && Number(parts[1]) === N && Number(parts[2]) === R && Number(parts[3]) === P);
}

/** Verified when the email is unknown, so response time doesn't reveal which emails exist. */
export const DUMMY_HASH = `scrypt$${N}$${R}$${P}$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(KEY_LENGTH).toString("base64")}`;
