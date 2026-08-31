import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import Icons from 'unplugin-icons/vite';

/**
 * Same-origin dev proxy for the turns backend.
 *
 * The turns API only returns CORS headers for allowlisted origins, and
 * localhost is not one of them. The app rewrites its calls to
 * `/__turns_api/<host>/<path>`; this middleware forwards them server-side,
 * where no CORS check applies. The target host travels in the path because it
 * varies per tenant ({BUSINESS_ID}) and per build.
 *
 * Keep the prefix in sync with src/api/turnsConfig.ts.
 */
const TURNS_DEV_PROXY_PREFIX = '/__turns_api';
const ALLOWED_HOST_SUFFIXES = ['turnsapp.com', 'sifabso.com'];

const turnsDevProxy = (): Plugin => ({
  name: 'turns-dev-proxy',
  configureServer(server) {
    server.middlewares.use(TURNS_DEV_PROXY_PREFIX, (req, res) => {
      void (async () => {
        const [, host, ...rest] = (req.url ?? '').split('/');

        // Without this the dev server would be an open proxy to any named host.
        const allowed =
          host &&
          ALLOWED_HOST_SUFFIXES.some(
            (suffix) => host === suffix || host.endsWith(`.${suffix}`),
          );

        if (!allowed) {
          res.statusCode = 403;
          res.end(`Refusing to proxy to disallowed host: ${host ?? '(none)'}`);
          return;
        }

        const target = `https://${host}/${rest.join('/')}`;

        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const body = chunks.length ? Buffer.concat(chunks) : undefined;

        // Hop-by-hop and origin headers must not be forwarded verbatim.
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
          if (['host', 'connection', 'origin', 'referer', 'content-length'].includes(key)) continue;
          if (typeof value === 'string') headers.set(key, value);
        }

        try {
          const upstream = await fetch(target, {
            method: req.method,
            headers,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
          });

          res.statusCode = upstream.status;
          upstream.headers.forEach((value, key) => {
            if (['content-encoding', 'content-length', 'transfer-encoding'].includes(key)) return;
            res.setHeader(key, value);
          });
          res.end(Buffer.from(await upstream.arrayBuffer()));
        } catch (error) {
          res.statusCode = 502;
          res.end(`Turns proxy failed: ${(error as Error).message}`);
        }
      })();
    });
  },
});

export default defineConfig({
  plugins: [
    react(),
    // Solar icons are compiled to inline SVG components at build time: no
    // runtime fetch, and only the icons actually imported end up in the bundle.
    Icons({ compiler: 'jsx', jsx: 'react', autoInstall: false }),
    turnsDevProxy(),
  ],
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
  server: {
    port: 3000,
    // Fail loudly instead of drifting to the next free port — a silent port
    // change leaves the browser and the API proxy pointing at nothing.
    strictPort: true,
    proxy: {
      // Dev-only: keeps the browser same-origin so there's no CORS dance.
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
});
