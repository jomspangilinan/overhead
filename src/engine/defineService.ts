// The spine. One defineService() per AWS service; everything else —
// inspector form, set_property input schema, list_services output, card
// lines, pricing inputs, CDK props — is derived from these definitions.

import type { CostLine, Lane, ServiceId, Traffic } from "./model";
import type { PricingTable } from "./pricing";

export type SettingDef =
  | {
      type: "enum";
      label: string;
      values: readonly string[];
      default: string;
      driver?: boolean;
      description?: string;
    }
  | {
      type: "number";
      label: string;
      min?: number;
      max?: number;
      default?: number;
      optional?: boolean;
      driver?: boolean;
      unit?: string;
      description?: string;
    }
  | {
      type: "boolean";
      label: string;
      default: boolean;
      driver?: boolean;
      description?: string;
    };

export type SettingsSchema = Record<string, SettingDef>;

export interface ServiceDef {
  id: ServiceId;
  /** The service's name as AWS writes it, e.g. "AWS Lambda". */
  term: string;
  /** Sprite symbol id in public/icons/aws sprite, e.g. "aws-lambda". */
  icon: string;
  /** Default lane; overridable per node. */
  lane: Lane;
  settings: SettingsSchema;
  /** The 2–3 settings that decide price, shown on the card. */
  cardLines: readonly string[];
  price: (
    settings: Record<string, unknown>,
    traffic: Traffic,
    pricing: PricingTable,
  ) => CostLine[];
  /** CDK construct code for this node — settings in, TypeScript out. */
  cdk?: (
    settings: Record<string, unknown>,
    ctx: { varName: string; resourceName: string },
  ) => string;
}

export function defineService(def: ServiceDef): ServiceDef {
  for (const key of def.cardLines) {
    if (!def.settings[key]) {
      throw new Error(`${def.id}: cardLine "${key}" is not a setting`);
    }
  }
  return def;
}

/** Defaults derived from the schema — the engine's only source of defaults. */
export function defaultSettings(def: ServiceDef): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, s] of Object.entries(def.settings)) {
    if ("default" in s && s.default !== undefined) out[key] = s.default;
  }
  return out;
}

export interface SettingError {
  code: "unknown_setting" | "invalid_type" | "invalid_value" | "out_of_range";
  setting: string;
  message: string;
  allowed?: readonly string[];
  min?: number;
  max?: number;
}

/**
 * Validate one setting value against the schema. Strict in code, loose in
 * the tool JSON schema — the structured error is the agent's recovery path.
 */
export function validateSetting(
  def: ServiceDef,
  key: string,
  value: unknown,
): SettingError | null {
  const s = def.settings[key];
  if (!s) {
    return {
      code: "unknown_setting",
      setting: key,
      message: `"${key}" is not a setting of ${def.term}. Settings: ${Object.keys(def.settings).join(", ")}`,
    };
  }
  switch (s.type) {
    case "enum": {
      if (typeof value !== "string" || !s.values.includes(value)) {
        return {
          code: "invalid_value",
          setting: key,
          message: `"${String(value)}" is not one of: ${s.values.join(", ")}`,
          allowed: s.values,
        };
      }
      return null;
    }
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return {
          code: "invalid_type",
          setting: key,
          message: `${key} must be a finite number`,
        };
      }
      if ((s.min !== undefined && value < s.min) || (s.max !== undefined && value > s.max)) {
        return {
          code: "out_of_range",
          setting: key,
          message: `${key} must be between ${s.min ?? "-∞"} and ${s.max ?? "∞"}`,
          min: s.min,
          max: s.max,
        };
      }
      return null;
    }
    case "boolean": {
      if (typeof value !== "boolean") {
        return {
          code: "invalid_type",
          setting: key,
          message: `${key} must be true or false`,
        };
      }
      return null;
    }
  }
}

/** JSON-schema fragment for one setting — feeds set_property and the inspector. */
export function settingJsonSchema(s: SettingDef): Record<string, unknown> {
  const base: Record<string, unknown> = {
    description: `${s.label}${s.description ? ` — ${s.description}` : ""}`.slice(0, 150),
  };
  switch (s.type) {
    case "enum":
      return { ...base, type: "string", enum: [...s.values] };
    case "number":
      return {
        ...base,
        type: "number",
        ...(s.min !== undefined ? { minimum: s.min } : {}),
        ...(s.max !== undefined ? { maximum: s.max } : {}),
      };
    case "boolean":
      return { ...base, type: "boolean" };
  }
}
