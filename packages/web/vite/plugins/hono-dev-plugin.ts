import type { Plugin, ViteDevServer } from "vite";

let tokenRefreshInterval: ReturnType<typeof setInterval> | null = null;

async function startTokenRefreshJob(server: ViteDevServer) {
  const runRefresh = async () => {
    try {
      const mod = await server.ssrLoadModule("/src/api/lib/shopee-auth.ts");
      await mod.refreshAllShopsIfNeeded();
    } catch (err) {
      console.error("[token-refresh-job] Error:", err);
    }
  };

  // Run once at startup
  await runRefresh();

  // Then every 30 minutes
  tokenRefreshInterval = setInterval(runRefresh, 30 * 60 * 1000);
  console.log("[token-refresh-job] Started — running every 30 minutes");
}

export default function honoDevPlugin(): Plugin {
  return {
    name: "hono-dev-server",
    configureServer(server) {
      // Start background token refresh job
      server.httpServer?.once("listening", () => {
        startTokenRefreshJob(server);
      });

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api")) return next();

        try {
          const request = await toWebRequest(req);
          const app = await loadApp(server);
          const response = await app.fetch(request);

          res.statusCode = response.status;
          response.headers.forEach((value: string, key: string) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          server.ssrFixStacktrace(err as Error);
          console.error("[hono-dev]", err);
          res.statusCode = 500;
          res.end("Internal Server Error");
        }
      });
    },
  };
}

async function loadApp(server: ViteDevServer) {
  const mod = await server.ssrLoadModule("/src/api/index.ts");
  return mod.default;
}

function toWebRequest(req: import("http").IncomingMessage): Request {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const headers = new Headers();
  for (const [key, val] of Object.entries(req.headers)) {
    if (val) headers.set(key, Array.isArray(val) ? val.join(", ") : val);
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? (req as unknown as ReadableStream) : undefined,
    // @ts-expect-error duplex needed for streaming request bodies
    duplex: hasBody ? "half" : undefined,
  });
}
