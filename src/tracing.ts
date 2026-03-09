import { Langfuse } from "langfuse";
import type { LangfuseTraceClient, LangfuseSpanClient } from "langfuse";

let langfuse: Langfuse | null = null;

export function initTracing(): Langfuse | null {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  if (!publicKey || !secretKey) {
    console.log("Langfuse tracing disabled (LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY not set)");
    return null;
  }

  langfuse = new Langfuse({
    publicKey,
    secretKey,
    baseUrl: process.env.LANGFUSE_BASEURL || "http://localhost:3000",
  });

  console.log(`Langfuse tracing enabled → ${langfuse.baseUrl}`);
  return langfuse;
}

export function getLangfuse(): Langfuse | null {
  return langfuse;
}

export async function shutdownTracing(): Promise<void> {
  if (langfuse) {
    await langfuse.shutdownAsync();
    langfuse = null;
  }
}

export type { LangfuseTraceClient, LangfuseSpanClient };
