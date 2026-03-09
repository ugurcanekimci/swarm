import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { instrumentTools } from "./observability.js";
import type { SdkMcpToolDefinition } from "@anthropic-ai/claude-agent-sdk";

// Mock the tracing module
vi.mock("../tracing.js", () => {
  const mockSpan = {
    end: vi.fn(),
    event: vi.fn(),
    span: vi.fn(),
  };
  const mockTrace = {
    span: vi.fn(() => mockSpan),
    update: vi.fn(),
    event: vi.fn(),
  };
  const mockLangfuse = {
    trace: vi.fn(() => mockTrace),
  };
  return {
    getLangfuse: vi.fn(() => mockLangfuse),
    _mockLangfuse: mockLangfuse,
    _mockTrace: mockTrace,
    _mockSpan: mockSpan,
  };
});

function makeTool(
  name: string,
  handler: (args: Record<string, unknown>, extra: unknown) => Promise<any>,
): SdkMcpToolDefinition<any> {
  return {
    name,
    description: `Test tool: ${name}`,
    inputSchema: {},
    handler,
  } as unknown as SdkMcpToolDefinition<any>;
}

describe("instrumentTools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an array of the same length", () => {
    const tools = [
      makeTool("a", async () => ({ content: [] })),
      makeTool("b", async () => ({ content: [] })),
    ];
    const wrapped = instrumentTools(tools);
    expect(wrapped).toHaveLength(2);
  });

  it("preserves tool name and description", () => {
    const tool = makeTool("my_tool", async () => ({ content: [] }));
    const [wrapped] = instrumentTools([tool]);
    expect(wrapped!.name).toBe("my_tool");
    expect(wrapped!.description).toBe("Test tool: my_tool");
  });

  it("calls the original handler and returns its result", async () => {
    const result = { content: [{ type: "text" as const, text: "hello" }] };
    const handler = vi.fn(async () => result);
    const tool = makeTool("test", handler);
    const [wrapped] = instrumentTools([tool]);

    const output = await wrapped!.handler({ key: "val" }, null);
    expect(handler).toHaveBeenCalledWith({ key: "val" }, null);
    expect(output).toBe(result);
  });

  it("creates a Langfuse trace and span on success", async () => {
    const { _mockLangfuse, _mockTrace, _mockSpan } = await import(
      "../tracing.js"
    );
    const lf = _mockLangfuse as any;
    const trace = _mockTrace as any;
    const span = _mockSpan as any;

    const tool = makeTool(
      "kb_search",
      async () => ({ content: [{ type: "text", text: "found" }] }),
    );
    const [wrapped] = instrumentTools([tool]);
    await wrapped!.handler({ query: "test" }, null);

    expect(lf.trace).toHaveBeenCalledWith(
      expect.objectContaining({ name: "mcp:kb_search" }),
    );
    expect(trace.span).toHaveBeenCalledWith(
      expect.objectContaining({ name: "kb_search" }),
    );
    expect(span.end).toHaveBeenCalledWith(
      expect.objectContaining({
        output: expect.objectContaining({ status: "ok" }),
      }),
    );
  });

  it("records error span when handler throws", async () => {
    const { _mockSpan, _mockTrace } = await import("../tracing.js");
    const span = _mockSpan as any;
    const trace = _mockTrace as any;

    const tool = makeTool("failing", async () => {
      throw new Error("boom");
    });
    const [wrapped] = instrumentTools([tool]);

    await expect(wrapped!.handler({}, null)).rejects.toThrow("boom");

    expect(span.end).toHaveBeenCalledWith(
      expect.objectContaining({
        output: expect.objectContaining({ status: "error" }),
        level: "ERROR",
      }),
    );
    expect(trace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        output: expect.objectContaining({ status: "error" }),
      }),
    );
  });

  it("records input keys (not values) by default", async () => {
    const { _mockTrace } = await import("../tracing.js");
    const trace = _mockTrace as any;

    const tool = makeTool(
      "t",
      async () => ({ content: [{ type: "text", text: "ok" }] }),
    );
    const [wrapped] = instrumentTools([tool]);
    await wrapped!.handler({ url: "https://example.com", limit: 5 }, null);

    const spanCall = trace.span.mock.calls[0]![0];
    expect(spanCall.input).toEqual({ keys: ["url", "limit"] });
  });

  it("does not mutate original tools array", () => {
    const original = makeTool("orig", async () => ({ content: [] }));
    const origHandler = original.handler;
    instrumentTools([original]);
    expect(original.handler).toBe(origHandler);
  });
});
