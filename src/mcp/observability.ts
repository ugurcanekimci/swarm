/**
 * MCP tool-level observability wrapper for Langfuse (OBS-08).
 *
 * Wraps each MCP tool handler with a child span under the active trace.
 * Records: tool name, input schema keys (not values), duration, status.
 * When LANGFUSE_CAPTURE_TOOL_IO=true, also records input/output values.
 */

import type { SdkMcpToolDefinition } from "@anthropic-ai/claude-agent-sdk";
import { getLangfuse } from "../tracing.js";

/** Matches ToolResult from @modelcontextprotocol/sdk without requiring it as a direct dep */
type ToolResult = { content?: Array<{ type: string; text?: string; [k: string]: unknown }>; isError?: boolean; [k: string]: unknown };

const CAPTURE_TOOL_IO = process.env.LANGFUSE_CAPTURE_TOOL_IO === "true";

/**
 * Wrap all tool definitions in an array with Langfuse spans.
 * Returns a new array — does not mutate the originals.
 */
export function instrumentTools(
  tools: SdkMcpToolDefinition<any>[],
): SdkMcpToolDefinition<any>[] {
  return tools.map((t) => wrapTool(t));
}

function wrapTool<T extends SdkMcpToolDefinition<any>>(toolDef: T): T {
  const originalHandler = toolDef.handler;

  const wrappedHandler = async (
    args: Record<string, unknown>,
    extra: unknown,
  ): Promise<ToolResult> => {
    const lf = getLangfuse();
    if (!lf) {
      return originalHandler(args, extra);
    }

    const startTime = Date.now();
    const trace = lf.trace({
      name: `mcp:${toolDef.name}`,
      metadata: { tool: toolDef.name },
      tags: ["swarm-mcp"],
    });

    const span = trace.span({
      name: toolDef.name,
      startTime: new Date(startTime),
      input: CAPTURE_TOOL_IO
        ? args
        : { keys: Object.keys(args) },
    });

    try {
      const result = await originalHandler(args, extra);
      const durationMs = Date.now() - startTime;

      const outputMeta: Record<string, unknown> = {
        status: "ok",
        durationMs,
        isError: !!(result as { isError?: boolean }).isError,
        contentItems: result.content?.length ?? 0,
      };

      if (CAPTURE_TOOL_IO && result.content) {
        outputMeta.content = result.content.map((c: { type: string; text?: string }) => {
          if (c.type === "text" && c.text) {
            return { type: "text", length: c.text.length };
          }
          return { type: c.type };
        });
      }

      span.end({ output: outputMeta });
      trace.update({ output: outputMeta });
      return result;
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);

      span.end({
        output: { status: "error", durationMs, error: errorMsg.slice(0, 500) },
        level: "ERROR" as const,
      });
      trace.update({
        output: { status: "error", error: errorMsg.slice(0, 200) },
      });
      throw err;
    }
  };

  return { ...toolDef, handler: wrappedHandler } as T;
}
