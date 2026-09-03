import { describe, expect, it } from "vitest";
import { SERVICES, servicesInFamily } from "../src/engine/services";
import {
  defaultSettings,
  settingJsonSchema,
  validateSetting,
} from "../src/engine/defineService";

describe("the spine", () => {
  it("defines every service, keyed by its own id", () => {
    expect(servicesInFamily("aws").map((d) => d.id).sort()).toEqual(
      [
        "apigateway",
        "cloudfront",
        "cloudwatchlogs",
        "cognito",
        "dynamodb",
        "eventbridge",
        "firehose",
        "kinesis",
        "kms",
        "lambda",
        "s3",
        "secretsmanager",
        "sns",
        "sqs",
        "ssmparameter",
        "stepfunctions",
      ].sort(),
    );
    for (const [key, def] of Object.entries(SERVICES)) expect(def.id).toBe(key);
  });

  // The flow vocabulary goes through the same spine and is deliberately the
  // opposite of a service: no settings, no card lines, no price. The test
  // says so, so "no price" reads as a decision rather than an omission.
  it("defines the flow shapes as unpriced, settingless nodes", () => {
    expect(servicesInFamily("flow").map((d) => d.id).sort()).toEqual(
      ["actor", "decision", "external", "step", "store", "terminal"].sort(),
    );
    for (const def of servicesInFamily("flow")) {
      expect(Object.keys(def.settings), def.id).toEqual([]);
      expect(def.cardLines, def.id).toEqual([]);
      expect(def.cfn, def.id).toBeUndefined();
      expect(def.cdk, def.id).toBeUndefined();
    }
  });

  // The list every agent reads first. It has to fit the tool budget in one
  // message · it did not, and the tool was answering with an error.
  it("list_services fits the 1.5K tool budget with every service in it", () => {
    const line = (def: (typeof SERVICES)[keyof typeof SERVICES]) => {
      const drivers = Object.entries(def.settings)
        .filter(([, v]) => v.driver)
        .map(([k]) => k);
      return `${def.id} · ${def.term}${drivers.length ? ` · ${drivers.join(", ")}` : ""}`;
    };
    const body = JSON.stringify({
      aws: servicesInFamily("aws").map(line),
      flow: servicesInFamily("flow").map((d) => d.id),
      note: "aws: id · term · price drivers. flow shapes are unpriced, have no settings, and are for the parts of a design AWS does not bill for.",
    });
    expect(body.length).toBeLessThan(1500);
  });

  it("every cardLine is a real setting and every default validates", () => {
    for (const def of servicesInFamily("aws")) {
      expect(def.cardLines.length).toBeGreaterThan(0);
      expect(def.cardLines.length).toBeLessThanOrEqual(3);
      for (const [key, value] of Object.entries(defaultSettings(def))) {
        expect(validateSetting(def, key, value)).toBeNull();
      }
    }
  });

  it("every service has security settings that drive a badge and validate", () => {
    for (const def of servicesInFamily("aws")) {
      const sec = Object.entries(def.settings).filter(([, s]) => s.group === "security");
      expect(sec.length, def.id).toBeGreaterThan(0);
      const badge = def.badge?.(defaultSettings(def));
      expect(typeof badge, def.id).toBe("string");
      expect((badge ?? "").length, def.id).toBeGreaterThan(0);
      for (const [key, sdef] of sec) {
        if (sdef.type === "enum") for (const v of sdef.values) expect(validateSetting(def, key, v)).toBeNull();
        if (sdef.type === "boolean") expect(validateSetting(def, key, true)).toBeNull();
      }
    }
  });

  it("security settings change the badge and reach the CDK output", () => {
    const ddb = SERVICES.dynamodb;
    expect(ddb.badge?.({ ...defaultSettings(ddb), encryption: "customer-managed", pitr: true })).toContain("CMK");
    const code = ddb.cdk!({ ...defaultSettings(ddb), encryption: "customer-managed", pitr: true }, { varName: "t", resourceName: "t" });
    expect(code).toContain("TableEncryption.CUSTOMER_MANAGED");
    expect(code).toContain("pointInTimeRecoveryEnabled: true");
    const s3 = SERVICES.s3;
    expect(s3.cdk!({ ...defaultSettings(s3), blockPublicAccess: false }, { varName: "b", resourceName: "b" })).not.toContain("BLOCK_ALL");
  });

  it("a single service's schema, as list_services prints it, fits the 1.5K tool budget", () => {
    for (const def of Object.values(SERVICES)) {
      const body = JSON.stringify({
        id: def.id,
        term: def.term,
        role: def.role,
        settings: Object.fromEntries(
          Object.entries(def.settings).map(([k, v]) => [
            k,
            {
              type: v.type,
              ...(v.type === "enum" ? { values: v.values } : {}),
              ...(v.type === "number" ? { min: v.min, max: v.max } : {}),
              ...("default" in v ? { default: v.default } : {}),
              ...(v.driver ? { priceDriver: true } : {}),
              ...(v.group === "security" ? { security: true } : {}),
            },
          ]),
        ),
      });
      expect(body.length, `${def.id}: ${body.length}`).toBeLessThanOrEqual(1500);
    }
  });

  it("returns structured errors the agent can recover from", () => {
    const lambda = SERVICES.lambda;
    expect(validateSetting(lambda, "nope", 1)?.code).toBe("unknown_setting");
    expect(validateSetting(lambda, "architecture", "riscv")).toMatchObject({
      code: "invalid_value",
      allowed: ["arm64", "x86_64"],
    });
    expect(validateSetting(lambda, "memoryMb", 64)).toMatchObject({
      code: "out_of_range",
      min: 128,
      max: 10240,
    });
    expect(validateSetting(lambda, "memoryMb", "big")?.code).toBe("invalid_type");
  });

  it("derives JSON schema fragments with capped description length", () => {
    for (const def of Object.values(SERVICES)) {
      for (const s of Object.values(def.settings)) {
        const schema = settingJsonSchema(s);
        expect(String(schema.description).length).toBeLessThanOrEqual(150);
      }
    }
  });
});
