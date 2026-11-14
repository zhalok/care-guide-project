/**
 * Seeds two users (alice, bob) and 10,000 notes for each.
 *
 *   npm run seed                                   (local, reads .env)
 *   docker compose run --rm app node dist/seed/seed.js
 *
 * Safe to re-run: users are upserted by email and each seeded user's notes are
 * replaced, so the result is always exactly SEED_NOTES_PER_USER notes each.
 * The passwords are weak on purpose: never run this against a real database.
 */
import * as bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Note, NoteSchema } from '../notes/schemas/note.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  buildNotes,
  parseSaltRounds,
  SEED_NOTES_PER_USER,
  SEED_USERS,
} from './seed-data';

const BATCH_SIZE = 1000;
const NOTES_SPAN_MS = 90 * 24 * 60 * 60 * 1000;

/** Host and database only; never print credentials. */
function describeTarget(uri: string): string {
  try {
    const url = new URL(uri);
    return `${url.host}${url.pathname}`;
  } catch {
    return '(unparseable MONGODB_URI)';
  }
}

async function main(): Promise<void> {
  const saltRounds = parseSaltRounds(process.env.BCRYPT_SALT_ROUNDS);
  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/care-guide';

  console.log(`Seeding ${describeTarget(uri)} (bcrypt cost ${saltRounds})`);
  await mongoose.connect(uri);

  const UserModel = mongoose.model(User.name, UserSchema);
  const NoteModel = mongoose.model(Note.name, NoteSchema);

  // Make the indexes match the schemas before inserting.
  await UserModel.syncIndexes();
  await NoteModel.syncIndexes();

  const startedAt = Date.now();
  const endTime = new Date();

  for (const seedUser of SEED_USERS) {
    const password = await bcrypt.hash(seedUser.password, saltRounds);
    const user = await UserModel.findOneAndUpdate(
      { email: seedUser.email },
      { name: seedUser.name, role: seedUser.role, password },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );

    const removed = await NoteModel.deleteMany({ createdBy: user._id });
    const notes = buildNotes({
      userName: seedUser.name,
      createdBy: user._id,
      count: SEED_NOTES_PER_USER,
      endTime,
      spanMs: NOTES_SPAN_MS,
    });
    for (let i = 0; i < notes.length; i += BATCH_SIZE) {
      await NoteModel.insertMany(notes.slice(i, i + BATCH_SIZE));
    }

    console.log(
      `  ${seedUser.email} (${seedUser.role}): ${notes.length} notes` +
        (removed.deletedCount ? ` (replaced ${removed.deletedCount})` : ''),
    );
  }

  console.log(`Done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
}

main()
  .catch((error: unknown) => {
    console.error(
      'Seeding failed:',
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
