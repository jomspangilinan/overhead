// Local registry over document.modelContext.registerTool: keeps the live
// tool list for the panel (and mirrors the native toolchange event where
// the browser provides one). Imperative API only; removal is by AbortSignal.

import type { ModelContext, ToolDescriptor, ToolResult } from "./register";
import { getModelContext } from "./register";

export interface RegisteredTool {
  name: string;
  description: string;
  dynamic: boolean;
}

const registry = new Map<string, RegisteredTool>();
const listeners = new Set<() => void>();

export function liveTools(): RegisteredTool[] {
  return [...registry.values()];
}

export function onToolChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn();
}

export function text(payload: unknown): ToolResult {
  let body = typeof payload === "string" ? payload : JSON.stringify(payload);
  // Hard cap ~1.5K chars — chunked delivery is the escape hatch.
  if (body.length > 1500) {
    body = JSON.stringify({
      error: {
        code: "output_too_large",
        message:
          "Result exceeds the 1.5K tool output budget. Use get_export_chunk for large payloads.",
        chars: body.length,
      },
    });
  }
  return { content: [{ type: "text", text: body }] };
}

export function errorResult(code: string, message: string, extra?: object): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify({ error: { code, message, ...extra } }) }] };
}

export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  readOnly?: boolean;
  untrustedContent?: boolean;
  dynamic?: boolean;
  execute: (args: Record<string, unknown>) => Promise<ToolResult> | ToolResult;
}

export async function registerSpec(
  mc: ModelContext,
  spec: ToolSpec,
  signal?: AbortSignal,
): Promise<void> {
  const descriptor: ToolDescriptor = {
    name: spec.name,
    description: spec.description,
    inputSchema: spec.inputSchema,
    annotations: {
      ...(spec.readOnly ? { readOnlyHint: true } : {}),
      ...(spec.untrustedContent ? { untrustedContentHint: true } : {}),
    },
    execute: async (raw: unknown) => {
      try {
        const args = (raw ?? {}) as Record<string, unknown>;
        return await spec.execute(args);
      } catch (err) {
        return errorResult("internal", err instanceof Error ? err.message : String(err));
      }
    },
  };
  await mc.registerTool(descriptor, signal ? { signal } : undefined);
  registry.set(spec.name, {
    name: spec.name,
    description: spec.description,
    dynamic: Boolean(spec.dynamic),
  });
  signal?.addEventListener("abort", () => {
    registry.delete(spec.name);
    emit();
  });
  emit();
}

/** Track a tool registered outside the wrapper (the raw brief-shape call). */
export function trackExternal(name: string, description: string): void {
  registry.set(name, { name, description, dynamic: false });
  emit();
}

export function contextOrNull(): ModelContext | null {
  if (typeof document === "undefined") return null;
  return getModelContext() ?? null;
}
