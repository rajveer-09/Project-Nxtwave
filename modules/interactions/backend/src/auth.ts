/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { jwtVerify } from 'jose';
import { getPool } from './db/pool.ts';
import type { Actor } from './types.ts';

/*
 * Requests come only from the web app, which signs a 60-second HS256 identity token per
 * request (platform/web/common/services/identity-token.ts). This service checks it, then maps the
 * signed-in email to its own users table, which says whether the person is an instructor
 * (and which one), senior, or admin, exactly as in the original app.
 */

export const AUDIENCE = 'interactions-api';
const ISSUER = 'student-hub-web';
const WEB_ADMIN_ROLES = new Set(['owner', 'admin']);

let key: Uint8Array | undefined;

/** Fails fast at startup when the shared secret is missing or weak. */
export function loadIdentityKey(): void {
  const secret = process.env.IDENTITY_JWT_SECRET ?? '';
  if (secret.length < 32) throw new Error('IDENTITY_JWT_SECRET must be at least 32 characters (same value as INTERACTIONS_JWT_SECRET in the web app).');
  key = new TextEncoder().encode(secret);
}

export class AuthError extends Error {
  readonly status: 401 | 403;
  constructor(message: string, status: 401 | 403) {
    super(message);
    this.status = status;
  }
}

type Claims = { sub: string; email: string; name: string; role: string };

async function verify(header: string | undefined): Promise<Claims> {
  if (!key) throw new Error('loadIdentityKey() was not called');
  const token = header?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new AuthError('Not signed in.', 401);
  try {
    const { payload } = await jwtVerify(token, key, { issuer: ISSUER, audience: AUDIENCE, algorithms: ['HS256'], clockTolerance: 5 });
    const { sub, email, name, role } = payload as Partial<Claims>;
    if (!sub || typeof email !== 'string' || typeof role !== 'string') throw new Error('missing claims');
    return { sub, email: email.trim().toLowerCase(), name: typeof name === 'string' ? name : email, role };
  } catch {
    throw new AuthError('Not signed in.', 401);
  }
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'instructor';
  instructor_id: string | null;
  is_senior: boolean;
}

/**
 * The request's actor. Instructors who have left (instructors.left_on set) are refused, as in the
 * original sign-in. A web Owner/Admin with no row here gets read-only admin access; anyone else
 * without a row is refused.
 */
export async function actorFrom(authorization: string | undefined): Promise<Actor> {
  const claims = await verify(authorization);
  const { rows } = await getPool().query<UserRow>(
    `SELECT u.id, u.name, u.email, u.role, u.instructor_id, u.is_senior
     FROM users u LEFT JOIN instructors i ON i.id = u.instructor_id
     WHERE lower(u.email) = $1 AND i.left_on IS NULL`,
    [claims.email]
  );
  const row = rows[0];
  if (row) {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      instructorId: row.instructor_id,
      isSenior: row.role === 'instructor' && !!row.is_senior,
    };
  }
  if (WEB_ADMIN_ROLES.has(claims.role)) {
    return { id: `staff:${claims.sub}`, name: claims.name, email: claims.email, role: 'admin', instructorId: null, isSenior: false };
  }
  throw new AuthError(`${claims.email} has no Interactions account. Ask an admin to add you.`, 403);
}
