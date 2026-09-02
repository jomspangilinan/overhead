// WebMCP registration. The raw document.modelContext.registerTool call below
// is intentionally kept in the literal { name, description, inputSchema, execute }
// shape the challenge brief prints — wrap it elsewhere, don't hide it.

export type ToolContent = { type: "text"; text: string };
export type ToolResult = { content: ToolContent[] };

export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (args: unknown) => Promise<ToolResult> | ToolResult;
}

export interface ModelContext {
  registerTool(
    tool: ToolDescriptor,
    options?: { signal?: AbortSignal },
  ): void | Promise<void>;
  getTools?(): ToolDescriptor[] | Promise<ToolDescriptor[]>;
  addEventListener?(type: "toolchange", listener: () => void): void;
  removeEventListener?(type: "toolchange", listener: () => void): void;
}

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
  interface Navigator {
    modelContext?: ModelContext;
  }
}

export function getModelContext(): ModelContext | undefined {
  // navigator.modelContext is the deprecated location (pre-Chrome 150).
  return document.modelContext ?? navigator.modelContext;
}

export type RegisterOutcome =
  | "registered"
  | "no-model-context"
  | "in-iframe";

/**
 * Phase 0 pipe proof: registers one trivial read-only tool.
 * Must run after hydration, in the top-level document (ChatGPT's browser
 * ignores tools registered from iframes).
 */
export async function registerPipeProof(
  signal?: AbortSignal,
): Promise<RegisterOutcome> {
  if (window.top !== window.self) return "in-iframe";

  const execute = async (): Promise<ToolResult> => ({
    content: [
      {
        type: "text",
        text: JSON.stringify({
          ok: true,
          app: "overhead",
          message: "The WebMCP pipe works. Phase 0 passed.",
          registeredVia: document.modelContext ? "document" : "navigator",
          at: new Date().toISOString(),
        }),
      },
    ],
  });

  const descriptor = {
    name: "overhead_ping",
    description:
      "Health check for Overhead, an AWS architecture canvas. Returns proof that this page's WebMCP tool pipe works end to end.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    execute,
  } satisfies ToolDescriptor;

  if (document.modelContext) {
    await document.modelContext.registerTool(
      {
        name: descriptor.name,
        description: descriptor.description,
        inputSchema: descriptor.inputSchema,
        annotations: descriptor.annotations,
        execute: descriptor.execute,
      },
      signal ? { signal } : undefined,
    );
    return "registered";
  }

  if (navigator.modelContext) {
    await navigator.modelContext.registerTool(
      descriptor,
      signal ? { signal } : undefined,
    );
    return "registered";
  }

  return "no-model-context";
}
