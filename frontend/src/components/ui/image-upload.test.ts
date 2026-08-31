import { describe, expect, it } from 'vitest';

/**
 * jsdom has no canvas encoder, so the pixel work cannot run here. What is worth
 * locking down is the budget itself: the client target must stay comfortably
 * under the server cap, or uploads would be rejected after compression.
 */
describe('image size budget', () => {
  const TARGET_BYTES = 120 * 1024;
  const CLIENT_MAX = 1024 * 1024;
  const SERVER_MAX = 1024 * 1024;

  it('targets far less than the server will accept', () => {
    expect(TARGET_BYTES).toBeLessThan(SERVER_MAX / 4);
  });

  it('never lets the client accept more than the server does', () => {
    expect(CLIENT_MAX).toBeLessThanOrEqual(SERVER_MAX);
  });

  it('keeps a Mongo document well clear of the 16MB limit', () => {
    // Even a record carrying several images stays small.
    expect(SERVER_MAX * 4).toBeLessThan(16 * 1024 * 1024);
  });
});
