import { serve } from "@hono/node-server";
import { config } from "./config.js";
import { api } from "./api/routes.js";

serve({
  fetch: api.fetch,
  port: config.port,
}, (info) => {
  console.log(`YouTube Transcript API listening on http://localhost:${info.port}`);
});
