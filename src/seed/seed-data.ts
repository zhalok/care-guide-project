import { Types } from 'mongoose';
import { UserRole } from '../users/schemas/user.schema';

export const SEED_NOTES_PER_USER = 10_000;

export interface SeedUser {
  name: string;
  email: string;
  /** Plain text, hashed before it is stored. Development data only. */
  password: string;
  role: UserRole;
}

export const SEED_USERS: readonly SeedUser[] = [
  {
    name: 'Alice',
    email: 'alice@example.com',
    password: 'alice123',
    role: UserRole.Admin,
  },
  {
    name: 'Bob',
    email: 'bob@example.com',
    password: 'bob123',
    role: UserRole.User,
  },
];

const DEFAULT_SALT_ROUNDS = 10;

/**
 * bcrypt cost factor (the "salt rounds"). bcrypt draws a fresh random salt for
 * every hash; this value controls how expensive each hash is. 4-31 are valid.
 */
export function parseSaltRounds(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_SALT_ROUNDS;
  const rounds = Number(raw);
  if (!Number.isInteger(rounds) || rounds < 4 || rounds > 31) {
    throw new Error(
      `BCRYPT_SALT_ROUNDS must be an integer between 4 and 31, got "${raw}"`,
    );
  }
  return rounds;
}

export interface NoteSeed {
  title: string;
  content: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TOPICS = [
  'groceries',
  'meeting recap',
  'travel plans',
  'recipe idea',
  'book notes',
  'workout log',
  'budget',
  'project ideas',
  'reading list',
  'appointment',
];

const SENTENCES = [
  'Remember to follow up before the end of the week.',
  'This needs a second look once the numbers are in.',
  'Keep it short and check it again tomorrow.',
  'Ask for feedback and write down the answers.',
  'Nothing urgent, but worth revisiting soon.',
  'Compare the options and pick the simplest one.',
  'Add this to the shared list so it is not forgotten.',
  'Review the details and update the plan if needed.',
];

/**
 * Builds `count` deterministic notes for one user. Timestamps rise with the
 * index and end at `endTime`, so insertion order, `_id` order and `createdAt`
 * order all agree (which is what newest-first cursor pagination relies on).
 */
export function buildNotes({
  userName,
  createdBy,
  count,
  endTime,
  spanMs,
}: {
  userName: string;
  createdBy: Types.ObjectId;
  count: number;
  endTime: Date;
  spanMs: number;
}): NoteSeed[] {
  const startMs = endTime.getTime() - spanMs;
  const stepMs = count > 1 ? spanMs / (count - 1) : 0;

  return Array.from({ length: count }, (_unused, i) => {
    const topic = TOPICS[i % TOPICS.length];
    const first = SENTENCES[i % SENTENCES.length];
    const second = SENTENCES[(i * 7 + 3) % SENTENCES.length];
    const at = new Date(Math.round(startMs + i * stepMs));
    return {
      title: `${userName}'s note #${i + 1}: ${topic}`,
      content: `${first} ${second}`,
      createdBy,
      createdAt: at,
      updatedAt: at,
    };
  });
}
