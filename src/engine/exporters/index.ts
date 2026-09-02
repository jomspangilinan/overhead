import type { StateSnapshot } from "../model";
import type { PricingTable } from "../pricing";
import { exportJson } from "./json";
import { exportMarkdown } from "./markdown";
import { exportMermaid } from "./mermaid";
import { exportCdk } from "./cdk";

export type ExportFormat = "json" | "markdown" | "mermaid" | "cdk";

export const EXPORT_FORMATS: ExportFormat[] = ["json", "markdown", "mermaid", "cdk"];

function stackName(title: string): string {
  const words = title.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const pascal = words.map((w) => w[0].toUpperCase() + w.slice(1)).join("");
  return (pascal || "Overhead") + "Stack";
}

export function exportAs(
  format: ExportFormat,
  snapshot: StateSnapshot,
  pricing: PricingTable,
  title = "Architecture estimate",
): string {
  switch (format) {
    case "json":
      return exportJson(snapshot, pricing);
    case "markdown":
      return exportMarkdown(snapshot, pricing, title);
    case "mermaid":
      return exportMermaid(snapshot, pricing);
    case "cdk":
      return exportCdk(snapshot, pricing, stackName(title));
  }
}

export const CHUNK_SIZE = 1200;

export function chunkCount(content: string): number {
  return Math.max(1, Math.ceil(content.length / CHUNK_SIZE));
}

export function chunkOf(content: string, index: number): string {
  return content.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE);
}

export { exportJson, exportMarkdown, exportMermaid, exportCdk };
