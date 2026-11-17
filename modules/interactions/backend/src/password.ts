/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';

// Same format as the original app (scrypt$salt$key, base64), which the web app's sign-in also accepts.
const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}
