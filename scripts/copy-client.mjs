import { cp, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Moves the built frontend to where the backend serves it from.
 *
 * Keeping the two builds separate but co-locating the output means one process
 * serves the API and the SPA — the browser is always same-origin, so there is
 * no CORS configuration and no second deployment to keep in step.
 */
const root = path.resolve(import.meta.dirname, '..');
const from = path.join(root, 'frontend', 'dist');
const to = path.join(root, 'backend', 'public', 'client');

if (!existsSync(from)) {
  console.error(`No frontend build at ${from} — run the frontend build first.`);
  process.exit(1);
}

await rm(to, { recursive: true, force: true });
await mkdir(path.dirname(to), { recursive: true });
await cp(from, to, { recursive: true });

console.log(`Client copied → ${path.relative(root, to)}`);
