import { describe, expect, it } from "vitest";
import { SERVICES } from "../src/engine/services";
import {
  defaultSettings,
  settingJsonSchema,
  validateSetting,
} from "../src/engine/defineService";

describe("the spine", () => {
  it("defines all ten services", () => {
    expect(Object.keys(SERVICES)).toHaveLength(10);
  });

  it("every cardLine is a real setting and every default validates", () => {
    for (const def of Object.values(SERVICES)) {
      expect(def.cardLines.length).toBeGreaterThan(0);
      expect(def.cardLines.length).toBeLessThanOrEqual(3);
      for (const [key, value] of Object.entries(defaultSettings(def))) {
        expect(validateSetting(def, key, value)).toBeNull();
      }
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
