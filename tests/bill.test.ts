import { describe, expect, it } from "vitest";
import { mapService, summarizeBill } from "../src/engine/bill";

describe("bill ingest", () => {
  it("maps Cost Explorer service names to the ten services", () => {
    expect(mapService("AWS Lambda")).toBe("lambda");
    expect(mapService("Amazon Simple Storage Service")).toBe("s3");
    expect(mapService("Amazon API Gateway")).toBe("apigateway");
    expect(mapService("AWS Step Functions")).toBe("stepfunctions");
    expect(mapService("Amazon Elastic Compute Cloud")).toBeNull();
  });

  it("summarizes a Service,Amount report", () => {
    const rows = [
      ["Service", "Amount"],
      ["AWS Lambda", "12.34"],
      ["Amazon DynamoDB", "$45.60"],
      ["Amazon Elastic Compute Cloud", "100.00"],
      ["Total costs", "157.94"],
    ];
    const s = summarizeBill(rows);
    expect(s.total).toBeCloseTo(157.94, 2);
    expect(s.mappedTotal).toBeCloseTo(57.94, 2);
    expect(s.lines[0].service).toBe("Amazon Elastic Compute Cloud");
    expect(s.unmapped).toEqual(["Amazon Elastic Compute Cloud"]);
  });

  it("falls back to the last numeric column when no Amount header", () => {
    const rows = [
      ["Service", "2026-07", "2026-08"],
      ["AWS Lambda", "10.00", "12.00"],
    ];
    const s = summarizeBill(rows);
    expect(s.lines[0].spend).toBe(12);
  });

  it("handles an empty file", () => {
    expect(summarizeBill([]).total).toBe(0);
  });
});
