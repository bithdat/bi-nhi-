import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Local dev plugin that mounts Vercel Serverless Functions (/api/*)
 * directly onto Vite's dev server for seamless local testing.
 */
function localApiPlugin() {
  return {
    name: 'local-vercel-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();

        const route = req.url.split('?')[0].replace(/^\/api\//, '');
        const allowed = ['translate-grade', 'grade', 'roleplay'];
        if (!allowed.includes(route)) return next();

        // Parse JSON body
        let rawBody = '';
        await new Promise((resolve) => {
          req.on('data', (chunk) => (rawBody += chunk));
          req.on('end', resolve);
        });
        try {
          req.body = rawBody ? JSON.parse(rawBody) : {};
        } catch {
          req.body = {};
        }

        // Attach Express/Vercel-compatible helpers on res
        res.status = (code) => {
          res.statusCode = code;
          return res;
        };
        res.json = (data) => {
          if (!res.headersSent) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
          }
          res.end(JSON.stringify(data));
          return res;
        };

        try {
          const mod = await server.ssrLoadModule(`/api/${route}.js`);
          await mod.default(req, res);
        } catch (err) {
          console.error('[local-api] Error:', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: err?.message || 'Internal server error' }));
          }
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  }

  return {
    plugins: [react(), tailwindcss(), localApiPlugin()],
    server: {
      port: 5173,
      host: true,
    },
  };
});
