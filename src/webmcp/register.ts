// WebMCP registration. The raw document.modelContext.registerTool call
// below is intentionally kept in the literal { name, description,
// inputSchema, execute } shape the challenge brief prints · everything
// else goes through the registry wrapper, but this one stays visible.

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

export type RegisterOutcome = "registered" | "no-model-context" | "in-iframe";

/**
 * Registers the whole core tool surface. Must run after hydration, in the
 * top-level document (ChatGPT's browser ignores iframe tools). Imperative
 * API only; dynamic tools are removed by aborting their AbortSignal.
 */
export async function registerAllTools(): Promise<RegisterOutcome> {
  if (window.top !== window.self) return "in-iframe";
  const mc = getModelContext();
  if (!mc) return "no-model-context";

  if (document.modelContext) {
    await document.modelContext.registerTool({
      name: "overhead_ping",
      description:
        "Health check for Overhead, an AWS architecture canvas. Returns proof that this page's WebMCP tool pipe works end to end.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      execute: async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ok: true,
              app: "overhead",
              message: "The WebMCP pipe works. Phase 0 passed.",
              at: new Date().toISOString(),
            }),
          },
        ],
      }),
    });
  } else {
    const { registerSpec } = await import("./toolRegistry");
    await registerSpec(mc, {
      name: "overhead_ping",
      description: "Health check for Overhead. Proves the WebMCP pipe works.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      readOnly: true,
      execute: () => ({
        content: [{ type: "text", text: JSON.stringify({ ok: true, app: "overhead" }) }],
      }),
    });
  }

  const [{ registerSpec }, { coreTools }] = await Promise.all([
    import("./toolRegistry"),
    import("./tools"),
  ]);

  if (document.modelContext) {
    // reflect the raw-registered ping in the local registry for the panel
    const { trackExternal } = await import("./toolRegistry");
    trackExternal("overhead_ping", "Health check · proves the WebMCP pipe works.");
  }

  const specs = coreTools();
  for (const spec of specs) {
    await registerSpec(mc, spec);
  }

  // open_scenario lives here because it needs the context to dynamically
  // register the four scenario tools (removed later by AbortSignal).
  const [{ registerScenarioTools, scenarioOpen }, { errorResult, text }, { useStore }] =
    await Promise.all([
      import("./scenario"),
      import("./toolRegistry"),
      import("@/store/useStore"),
    ]);
  const writeMap = new Map(specs.filter((s) => !s.readOnly).map((s) => [s.name, s]));
  await registerSpec(mc, {
    name: "open_scenario",
    description:
      "Fork the design into a named what-if scenario. Registers scenario_apply, get_delta, commit_scenario and discard_scenario while it is open; writes apply to the fork.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string", description: "Scenario name" } },
      required: ["name"],
      additionalProperties: false,
    },
    execute: async ({ name }) => {
      if (scenarioOpen())
        return errorResult(
          "scenario_already_open",
          `Scenario "${useStore.getState().scenario?.name}" is open · commit or discard it first.`,
        );
      useStore.getState().openScenario(String(name));
      await registerScenarioTools(mc, writeMap);
      return text({
        scenario: String(name),
        toolsAdded: ["scenario_apply", "get_delta", "commit_scenario", "discard_scenario"],
      });
    },
  });

  return "registered";
}
