import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ROLES } from '../constants';
import RefreshToken from '../models/refreshToken.model';
import User from '../models/user.model';
import authService from '../services/auth.service';
import { asTenant, clearTestDb, startTestDb, stopTestDb } from './setup';
beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

const makeUser = async () => {
  return User.create({
    name: 'Admin',
    email: 'admin@test.local',
    password: 'Password123',
    role: ROLES.ADMIN,
  });
};

describe('refresh token rotation', () => {
  it('issues a new refresh token and retires the old one', asTenant(async () => {
    await makeUser();

    const first = await authService.login('admin@test.local', 'Password123');
    const second = await authService.refresh(first.refreshToken);

    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(second.accessToken).toBeTruthy();
  }));

  it('treats replay of a rotated token as theft and kills every session', asTenant(async () => {
    await makeUser();

    const first = await authService.login('admin@test.local', 'Password123');
    const second = await authService.refresh(first.refreshToken);

    // Age the retired token past the concurrent-tab grace window.
    await RefreshToken.updateMany(
      { revokedReason: 'ROTATED' },
      { $set: { revokedAt: new Date(Date.now() - 120_000) } },
    );

    await expect(authService.refresh(first.refreshToken)).rejects.toThrow(/revoked/i);
    // Its successor dies with it.
    await expect(authService.refresh(second.refreshToken)).rejects.toThrow(/revoked/i);
  }));

  it('signing out one device leaves the others working', asTenant(async () => {
    await makeUser();

    const deviceA = await authService.login('admin@test.local', 'Password123');
    const deviceB = await authService.login('admin@test.local', 'Password123');

    await authService.revokeOne(deviceA.refreshToken);

    await expect(authService.refresh(deviceA.refreshToken)).rejects.toThrow(/ended/i);
    await expect(authService.refresh(deviceB.refreshToken)).resolves.toBeTruthy();
  }));

  it('rejects an access token presented as a refresh token', asTenant(async () => {
    await makeUser();

    const session = await authService.login('admin@test.local', 'Password123');
    await expect(authService.refresh(session.accessToken)).rejects.toThrow(/Invalid or expired/);
  }));
});
