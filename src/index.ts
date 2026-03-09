import { serve } from "@hono/node-server";
import { config } from "./config.js";
import { api } from "./api/routes.js";
import { startScheduler } from "./scheduler/index.js";
import { initTracing, shutdownTracing } from "./tracing.js";

initTracing();

const server = serve({
  fetch: api.fetch,
  port: config.port,
}, (info) => {
  console.log(`Swarm API listening on http://localhost:${info.port}`);
  startScheduler();
});

process.on("SIGTERM", async () => {
  await shutdownTracing();
  server.close();
});
process.on("SIGINT", async () => {
  await shutdownTracing();
  server.close();
});
