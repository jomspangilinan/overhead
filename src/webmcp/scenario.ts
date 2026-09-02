// Dynamic registration: the four scenario tools exist only while a fork is
// open. open_scenario registers them under one AbortController; commit and
// discard abort it · never unregisterTool. The panel count ticks both ways.

import { useStore, snapshotOf, pricingOf } from "@/store/useStore";
import { computeDelta } from "@/engine/delta";
import type { ModelContext } from "./register";
import { errorResult, registerSpec, text, type ToolSpec } from "./toolRegistry";

let controller: AbortController | null = null;

export function scenarioOpen(): boolean {
  return controller !== null;
}

function deltaPayload() {
  const s = useStore.getState();
  if (!s.scenario) return null;
  const d = computeDelta(s.scenario.base, snapshotOf(s), pricingOf(s));
  return {
    scenario: s.scenario.name,
    baseTotal: d.baseTotal,
    forkTotal: d.forkTotal,
    delta: d.delta,
    changed: d.nodes.slice(0, 8).map((n) => ({
      id: n.id,
      base: n.base,
      fork: n.fork,
      delta: n.delta,
    })),
  };
}

function closeScenario() {
  controller?.abort();
  controller = null;
}

export async function registerScenarioTools(
  mc: ModelContext,
  writeTools: Map<string, ToolSpec>,
): Promise<void> {
  controller = new AbortController();
  const signal = controller.signal;

  const specs: ToolSpec[] = [
    {
      name: "scenario_apply",
      description:
        "Run one write tool against the open fork: pass the tool name (e.g. set_property) and its arguments. Equivalent to calling it directly while the scenario is open.",
      inputSchema: {
        type: "object",
        properties: {
          tool: { type: "string", description: "A write tool name" },
          args: { type: "object", description: "That tool's arguments" },
        },
        required: ["tool"],
        additionalProperties: false,
      },
      dynamic: true,
      execute: async ({ tool, args }) => {
        const spec = writeTools.get(String(tool));
        if (!spec)
          return errorResult("no_such_tool", `"${String(tool)}" is not a write tool.`, {
            writeTools: [...writeTools.keys()],
          });
        return spec.execute((args ?? {}) as Record<string, unknown>);
      },
    },
    {
      name: "get_delta",
      description:
        "Cost and topology difference between the base design and the open scenario, per node and in total.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      readOnly: true,
      dynamic: true,
      execute: () => {
        const payload = deltaPayload();
        if (!payload) return errorResult("no_scenario", "No scenario is open.");
        return text(payload);
      },
    },
    {
      name: "commit_scenario",
      description:
        "Make the fork the new base design. The scenario closes and these four tools disappear.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      dynamic: true,
      execute: () => {
        const payload = deltaPayload();
        if (!payload) return errorResult("no_scenario", "No scenario is open.");
        useStore.getState().commitScenario();
        closeScenario();
        return text({ committed: payload.scenario, monthlyTotal: payload.forkTotal });
      },
    },
    {
      name: "discard_scenario",
      description:
        "Drop the fork and restore the base design. The scenario closes and these four tools disappear.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      dynamic: true,
      execute: () => {
        const s = useStore.getState();
        if (!s.scenario) return errorResult("no_scenario", "No scenario is open.");
        const name = s.scenario.name;
        s.discardScenario();
        closeScenario();
        const after = useStore.getState();
        return text({
          discarded: name,
          monthlyTotal: computeDelta(
            snapshotOf(after),
            snapshotOf(after),
            pricingOf(after),
          ).baseTotal,
        });
      },
    },
  ];

  for (const spec of specs) {
    await registerSpec(mc, spec, signal);
  }
}

/** UI-side open: forks the state and registers the four scenario tools,
 *  exactly as the open_scenario tool does, so the strip count ticks. */
export async function openScenarioFromUi(name: string): Promise<void> {
  const s = useStore.getState();
  if (s.scenario) return;
  s.openScenario(name);
  s.notify("Scenario forked · change anything, then commit or discard it in the banner");
  const { getModelContext } = await import("./register");
  const mc = typeof document !== "undefined" ? getModelContext() : undefined;
  if (!mc) return;
  const { coreTools } = await import("./tools");
  const writeMap = new Map(coreTools().filter((t) => !t.readOnly).map((t) => [t.name, t]));
  await registerScenarioTools(mc, writeMap);
}

/** UI-side close (banner buttons) keeps the tool lifecycle in sync. */
export function closeScenarioFromUi(kind: "commit" | "discard"): void {
  const s = useStore.getState();
  if (!s.scenario) return;
  // say what happened · both buttons used to leave the canvas looking the
  // same as before, which read as neither of them doing anything
  const name = s.scenario.name;
  let outcome = "";
  try {
    const d = computeDelta(s.scenario.base, snapshotOf(s), pricingOf(s));
    outcome =
      kind === "commit"
        ? `${d.nodes.length} ${d.nodes.length === 1 ? "change" : "changes"} kept · $${d.baseTotal.toFixed(2)} → $${d.forkTotal.toFixed(2)} a month`
        : `back to $${d.baseTotal.toFixed(2)} a month`;
  } catch {
    // pricing can throw on a half-built node · the notice is not worth it
  }
  if (kind === "commit") s.commitScenario();
  else s.discardScenario();
  closeScenario();
  s.notify(`Scenario "${name}" ${kind === "commit" ? "committed" : "discarded"}${outcome ? ` · ${outcome}` : ""}`);
}
