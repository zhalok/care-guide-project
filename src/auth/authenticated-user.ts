import { Request } from 'express';
import { UserRole } from '../users/schemas/user.schema';

/** The user the auth middleware attaches to the request (`req.user`). */
export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

/** Claims stored in the issued JWT. */
export interface JwtPayload {
  /** User id. */
  sub: string;
  email: string;
  /** The user's role when the token was issued. */
  role: UserRole;
}
