import { Types } from 'mongoose';
import { UserRole } from '../users/schemas/user.schema';
import {
  buildNotes,
  parseSaltRounds,
  SEED_NOTES_PER_USER,
  SEED_USERS,
} from './seed-data';

describe('seed data', () => {
  describe('SEED_USERS', () => {
    it('defines alice and bob with the requested passwords', () => {
      expect(SEED_USERS.map((u) => [u.name, u.password])).toEqual([
        ['Alice', 'alice123'],
        ['Bob', 'bob123'],
      ]);
    });

    it('uses unique, lowercase emails', () => {
      const emails = SEED_USERS.map((u) => u.email);
      expect(new Set(emails).size).toBe(emails.length);
      for (const email of emails) expect(email).toBe(email.toLowerCase());
    });

    it('gives alice the admin role and bob the user role', () => {
      expect(SEED_USERS.map((u) => u.role)).toEqual([
        UserRole.Admin,
        UserRole.User,
      ]);
    });
  });

  it('seeds 10,000 notes per user', () => {
    expect(SEED_NOTES_PER_USER).toBe(10_000);
  });

  describe('parseSaltRounds', () => {
    it.each([undefined, '', '   '])('defaults to 10 for %p', (raw) => {
      expect(parseSaltRounds(raw)).toBe(10);
    });

    it.each([
      ['4', 4],
      ['12', 12],
      ['31', 31],
    ])('accepts %s', (raw, expected) => {
      expect(parseSaltRounds(raw)).toBe(expected);
    });

    it.each(['3', '32', '10.5', 'abc', '-1'])('rejects %s', (raw) => {
      expect(() => parseSaltRounds(raw)).toThrow(/BCRYPT_SALT_ROUNDS/);
    });
  });

  describe('buildNotes', () => {
    const createdBy = new Types.ObjectId();
    const endTime = new Date('2026-01-01T00:00:00.000Z');
    const build = (count: number) =>
      buildNotes({
        userName: 'Alice',
        createdBy,
        count,
        endTime,
        spanMs: 1000 * 60 * 60,
      });

    it('returns exactly the requested number of notes', () => {
      expect(build(250)).toHaveLength(250);
      expect(build(0)).toHaveLength(0);
    });

    it('assigns every note to the given user', () => {
      expect(build(50).every((n) => n.createdBy === createdBy)).toBe(true);
    });

    it('fills in a non-empty title and content', () => {
      for (const n of build(40)) {
        expect(n.title.length).toBeGreaterThan(0);
        expect(n.content.length).toBeGreaterThan(0);
      }
    });

    it('numbers titles from 1 and keeps them unique', () => {
      const notes = build(100);
      expect(notes[0].title).toMatch(/^Alice's note #1:/);
      expect(new Set(notes.map((n) => n.title)).size).toBe(100);
    });

    it('is deterministic', () => {
      expect(build(30)).toEqual(build(30));
    });

    it('spans the window and ends at endTime, never in the future', () => {
      const notes = build(100);
      expect(notes[99].createdAt).toEqual(endTime);
      expect(notes[0].createdAt.getTime()).toBe(
        endTime.getTime() - 1000 * 60 * 60,
      );
      expect(notes.every((n) => n.createdAt <= endTime)).toBe(true);
    });

    it('has non-decreasing timestamps, matching insertion order', () => {
      const times = build(500).map((n) => n.createdAt.getTime());
      for (let i = 1; i < times.length; i++) {
        expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
      }
    });

    it('sets updatedAt equal to createdAt', () => {
      for (const n of build(20)) expect(n.updatedAt).toEqual(n.createdAt);
    });

    it('handles a single note', () => {
      const [only] = build(1);
      expect(only.createdAt).toEqual(
        new Date(endTime.getTime() - 1000 * 60 * 60),
      );
    });
  });
});
