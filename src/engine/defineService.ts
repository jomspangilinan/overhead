// The spine. One defineService() per AWS service; everything else —
// inspector form, set_property input schema, list_services output, card
// lines, pricing inputs, CDK props — is derived from these definitions.

import type { CostLine, Role, ServiceId, Traffic } from "./model";
import type { PricingTable } from "./pricing";

/** `group: "security"` puts a setting in the node's Security section (and
 *  the card gear); it is still a plain setting for set_property and CDK. */
export type SettingGroup = "settings" | "security";

export type SettingDef =
  | {
      type: "enum";
      label: string;
      values: readonly string[];
      default: string;
      driver?: boolean;
      description?: string;
      group?: SettingGroup;
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
      group?: SettingGroup;
    }
  | {
      type: "boolean";
      label: string;
      default: boolean;
      driver?: boolean;
      description?: string;
      group?: SettingGroup;
    };

export type SettingsSchema = Record<string, SettingDef>;

/** One CloudFormation resource. `suffix` names the extra resources a node
 *  emits beyond its own (a queue's DLQ, a function's execution role): the
 *  logical id becomes `<node logical id><suffix>`. */
export interface CfnResource {
  suffix?: string;
  Type: string;
  Properties: Record<string, unknown>;
  /** Resource-level Metadata — where an assumption or a stub is recorded. */
  Metadata?: Record<string, unknown>;
  DependsOn?: string[];
}

/** What a service's cfn() is handed: its own logical id (so extra resources
 *  can reference it) and the resource name the user typed. */
export interface CfnCtx {
  logicalId: string;
  resourceName: string;
}

/** What kind of thing this definition describes. `aws` is a real service
 *  with a SKU behind it; `flow` is a plain shape (a step, a decision, an
 *  actor) that carries no price and no CloudFormation. The split drives the
 *  palette's two groups and list_services; everything else is identical,
 *  which is why a flow node can sit in a VPC and be exported like any other. */
export type ServiceFamily = "aws" | "flow";

export interface ServiceDef {
  id: ServiceId;
  /** Default "aws" · see ServiceFamily. */
  family?: ServiceFamily;
  /** The service's name as AWS writes it, e.g. "AWS Lambda". */
  term: string;
  /** Sprite symbol id in public/icons/aws sprite, e.g. "aws-lambda". */
  icon: string;
  /** Layout role — internal to autoLayout; never a UI concept. */
  role: Role;
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
  /** CloudFormation resources for this node — settings in, template out.
   *  The first entry (no suffix) is the node itself; the rest are what it
   *  needs to be deployable (an execution role, a DLQ). */
  cfn?: (settings: Record<string, unknown>, ctx: CfnCtx) => CfnResource[];
  /** The CloudFormation types that mean *this* service on the way back in.
   *  The first is what cfn() emits for the default settings. */
  cfnTypes?: readonly string[];
  /** Settings recovered from a CloudFormation resource — the reverse of
   *  cfn(). Only what the template actually says; the rest stay at their
   *  defaults, which is why a price appears immediately after an import. */
  fromCfn?: (properties: Record<string, unknown>, type: string) => Record<string, unknown>;
  /** The security badge under the icon, derived from the security settings
   *  (shown when the security layer is on). Null = nothing to say. */
  badge?: (settings: Record<string, unknown>) => string | null;
}

export function defineService(def: ServiceDef): ServiceDef {
  for (const key of def.cardLines) {
    if (!def.settings[key]) {
      throw new Error(`${def.id}: cardLine "${key}" is not a setting`);
    }
  }
  // A service that writes CloudFormation must also say how to read it back,
  // or the export is a one-way door for that service alone.
  if (def.cfn && (!def.cfnTypes?.length || !def.fromCfn)) {
    throw new Error(`${def.id}: cfn() needs cfnTypes and fromCfn()`);
  }
  return def;
}

/** Settings in a group, in schema order. */
export function settingsInGroup(def: ServiceDef, group: SettingGroup): [string, SettingDef][] {
  return Object.entries(def.settings).filter(([, s]) => (s.group ?? "settings") === group);
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
