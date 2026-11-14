import { Request } from 'express';

/** Shape of the user the auth middleware attaches to the request. */
export interface AuthenticatedUser {
  id: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
