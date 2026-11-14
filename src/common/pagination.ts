import { BadRequestException } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/** Validates raw cursor/limit query values and applies the default limit. */
export function parsePageParams({
  cursor,
  limit: rawLimit,
}: {
  cursor?: string;
  limit?: string;
}): { cursor?: string; limit: number } {
  const limit = rawLimit === undefined ? DEFAULT_LIMIT : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new BadRequestException(
      `limit must be an integer between 1 and ${MAX_LIMIT}`,
    );
  }
  if (cursor !== undefined && !isValidObjectId(cursor)) {
    throw new BadRequestException('Invalid cursor');
  }
  return { limit, cursor };
}
