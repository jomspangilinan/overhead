// Cost Explorer CSV → per-service spend, mapped onto the ten services.
// Parsing happens in the tab; nothing is uploaded. Anything read from the
// CSV is untrusted content — the get_bill_summary tool says so.

import type { ServiceId } from "./model";

export interface BillLine {
  service: string;
  mappedService: ServiceId | null;
  spend: number;
}

export interface BillSummary {
  lines: BillLine[];
  total: number;
  mappedTotal: number;
  unmapped: string[];
}

const SERVICE_MAP: [RegExp, ServiceId][] = [
  [/lambda/i, "lambda"],
  [/api ?gateway/i, "apigateway"],
  [/dynamodb/i, "dynamodb"],
  [/simple storage|(^|\W)s3(\W|$)/i, "s3"],
  [/cloudfront/i, "cloudfront"],
  [/simple queue|(^|\W)sqs(\W|$)/i, "sqs"],
  [/simple notification|(^|\W)sns(\W|$)/i, "sns"],
  [/eventbridge|cloudwatch events/i, "eventbridge"],
  [/step functions|states/i, "stepfunctions"],
  [/cognito/i, "cognito"],
];

export function mapService(name: string): ServiceId | null {
  for (const [re, id] of SERVICE_MAP) if (re.test(name)) return id;
  return null;
}

/**
 * Accepts the two common Cost Explorer CSV shapes:
 *  - "Service, Amount" rows (grouped-by-service report)
 *  - wide monthly report with "Service" + trailing total column
 * Rows are papaparse output: arrays of cells.
 */
export function summarizeBill(rows: string[][]): BillSummary {
  if (!rows.length) return { lines: [], total: 0, mappedTotal: 0, unmapped: [] };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const serviceCol = header.findIndex((h) => h.includes("service"));
  let amountCol = header.findIndex(
    (h) => h.includes("amount") || h.includes("cost") || h.includes("total"),
  );
  const start = serviceCol >= 0 ? 1 : 0;
  const sCol = serviceCol >= 0 ? serviceCol : 0;
  if (amountCol < 0) amountCol = -1; // fall back to last numeric cell per row

  const byService = new Map<string, number>();
  for (const row of rows.slice(start)) {
    const service = (row[sCol] ?? "").trim();
    if (!service || /total/i.test(service)) continue;
    const cell =
      amountCol >= 0 ? row[amountCol] : [...row].reverse().find((c) => c && !isNaN(Number(c.replace(/[$,]/g, ""))));
    if (cell === undefined) continue;
    const spend = Number(String(cell).replace(/[$,]/g, ""));
    if (!Number.isFinite(spend) || spend <= 0) continue;
    byService.set(service, (byService.get(service) ?? 0) + spend);
  }

  const lines: BillLine[] = [...byService.entries()]
    .map(([service, spend]) => ({
      service,
      mappedService: mapService(service),
      spend: Math.round(spend * 100) / 100,
    }))
    .sort((a, b) => b.spend - a.spend);

  const total = lines.reduce((a, l) => a + l.spend, 0);
  const mappedTotal = lines
    .filter((l) => l.mappedService)
    .reduce((a, l) => a + l.spend, 0);
  return {
    lines,
    total: Math.round(total * 100) / 100,
    mappedTotal: Math.round(mappedTotal * 100) / 100,
    unmapped: lines.filter((l) => !l.mappedService).map((l) => l.service),
  };
}
