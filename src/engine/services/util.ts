import type { CfnResource } from "../defineService";
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

// ── CloudFormation helpers ────────────────────────────────────────────────
// Shared by every service's cfn() / fromCfn(). Kept here so the emitted
// template speaks one dialect and the reader knows the same one.

/** An IAM service role, so the emitted template deploys as it stands. */
export function roleResource(
  suffix: string,
  principal: string,
  managedPolicyArns: string[],
): CfnResource {
  return {
    suffix,
    Type: "AWS::IAM::Role",
    Properties: {
      AssumeRolePolicyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { Service: principal },
            Action: "sts:AssumeRole",
          },
        ],
      },
      ManagedPolicyArns: managedPolicyArns,
    },
  };
}

/** Read an enum back from a template: the value if the schema allows it,
 *  else the default, so a foreign template never lands an invalid setting. */
export function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** A CloudFormation string that may be an intrinsic — "" when it is one. */
export function plain(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Drop the keys a template did not mention, so defaults keep their place. */
export function defined(settings: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(settings)) if (v !== undefined) out[k] = v;
  return out;
}
