import { randomInt } from 'node:crypto';

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghjkmnpqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*-_+=';
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;
const PASSWORD_LENGTH = 20;

function pick(charset: string): string {
  return charset[randomInt(charset.length)];
}

function shuffle<T>(items: T[]): T[] {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Cryptographically random password with at least one char from each
 * class (upper/lower/digit/symbol), excluding visually ambiguous
 * characters (0/O, 1/l/I) so a generated password shown once on screen is
 * easy to read and copy correctly.
 */
export function generateStrongPassword(): string {
  const required = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  const rest = Array.from({ length: PASSWORD_LENGTH - required.length }, () => pick(ALL));
  return shuffle([...required, ...rest]).join('');
}
