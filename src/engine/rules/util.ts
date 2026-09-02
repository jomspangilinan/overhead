import type { ArchNode, StateSnapshot, Traffic } from "../model";
import { toMoney } from "../model";
import { defaultSettings } from "../defineService";
import { getService } from "../services";

/** Node settings with schema defaults filled in — what the cost engine sees. */
export function effective(node: ArchNode): Record<string, unknown> {
  const def = getService(node.service);
  return def ? { ...defaultSettings(def), ...node.settings } : node.settings;
}

export function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function requestsOf(
  s: Record<string, unknown>,
  key: string,
  traffic: Traffic,
  factor = 1,
): number {
  return num(s[key], traffic.requestsPerMonth * factor);
}

export function saving(n: number): number | undefined {
  const m = toMoney(n);
  return m > 0 ? m : undefined;
}

export function byService(snapshot: StateSnapshot, service: string): ArchNode[] {
  return snapshot.nodes.filter((n) => n.service === service);
}
