import type { CostLine } from "../model";
import type { PriceEntry } from "../pricing";

export function line(entry: PriceEntry, qty: number): CostLine {
  return {
    sku: entry.sku,
    unit: entry.unit,
    qty,
    rate: entry.rate,
    monthly: qty * entry.rate,
    sourceUrl: entry.sourceUrl,
  };
}

export function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export const HOURS_PER_MONTH = 730;
