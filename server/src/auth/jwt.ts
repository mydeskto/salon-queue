import jwt from 'jsonwebtoken';
import type { UserRole } from '../../shared/src';
import { env } from '../env';

export interface JwtPayload {
  sub: string;
  role: UserRole;
  salonId: string | null;
}

export function signToken(payload: JwtPayload, expiresIn: string = env.jwtExpiresIn): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}
