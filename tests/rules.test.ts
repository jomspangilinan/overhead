// One test per rule: it fires on the shape it names, stays quiet otherwise,
// and every finding carries a doc citation.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { allFindings } from "../src/engine/findings";
import type { StateSnapshot, ArchNode, ArchEdge } from "../src/engine/model";
import { DEFAULT_TRAFFIC } from "../src/engine/model";
import type { PricingTable } from "../src/engine/pricing";

const pricing = JSON.parse(
  readFileSync(join(__dirname, "..", "data", "pricing.us-east-1.json"), "utf8"),
) as PricingTable;

let seq = 0;
function node(service: string, settings: Record<string, unknown> = {}): ArchNode {
  const id = `${service}-${++seq}`;
  return {
    id,
    service: service as ArchNode["service"],
    name: id,
    settings,
    position: { x: 0, y: 0 },
  };
}

function snap(nodes: ArchNode[], edges: ArchEdge[] = []): StateSnapshot {
  return { nodes, edges, containers: [], sections: [], traffic: { ...DEFAULT_TRAFFIC } };
}

function rulesFired(s: StateSnapshot): string[] {
  return allFindings(s, pricing).map((f) => f.rule);
}

describe("rules", () => {
  it("every finding carries a docUrl citation", () => {
    const s = snap([
      node("apigateway", { apiType: "REST" }),
      node("lambda", { architecture: "x86_64" }),
      node("s3", { purpose: "logs", publiclyServed: true }),
    ]);
    for (const f of allFindings(s, pricing)) {
      expect(f.docUrl).toMatch(/^https:\/\/(docs\.)?aws\.amazon\.com\//);
    }
  });

  it("rest_where_http_would_do fires only without REST-only features", () => {
    expect(rulesFired(snap([node("apigateway", { apiType: "REST" })]))).toContain(
      "rest_where_http_would_do",
    );
    expect(
      rulesFired(snap([node("apigateway", { apiType: "REST", wafAttached: true })])),
    ).not.toContain("rest_where_http_would_do");
    expect(rulesFired(snap([node("apigateway", { apiType: "HTTP" })]))).not.toContain(
      "rest_where_http_would_do",
    );
    const f = allFindings(snap([node("apigateway", { apiType: "REST" })]), pricing).find(
      (x) => x.rule === "rest_where_http_would_do",
    )!;
    expect(f.estimatedSaving).toBeGreaterThan(0);
  });

  it("standard_workflow_high_volume needs volume and no human wait", () => {
    expect(
      rulesFired(snap([node("stepfunctions", { workflowType: "standard", executionsPerMonth: 500000 })])),
    ).toContain("standard_workflow_high_volume");
    expect(
      rulesFired(snap([node("stepfunctions", { workflowType: "standard", executionsPerMonth: 50000 })])),
    ).not.toContain("standard_workflow_high_volume");
    expect(
      rulesFired(
        snap([
          node("stepfunctions", {
            workflowType: "standard",
            executionsPerMonth: 500000,
            hasHumanWaitStep: true,
          }),
        ]),
      ),
    ).not.toContain("standard_workflow_high_volume");
  });

  it("x86_lambda fires on any non-arm64 Lambda with a saving", () => {
    const s = snap([node("lambda", { architecture: "x86_64" })]);
    const f = allFindings(s, pricing).find((x) => x.rule === "x86_lambda")!;
    expect(f).toBeTruthy();
    expect(f.estimatedSaving).toBeGreaterThan(0);
    expect(rulesFired(snap([node("lambda", { architecture: "arm64" })]))).not.toContain(
      "x86_lambda",
    );
  });

  it("memory_duration_tradeoff surfaces the crossover as info", () => {
    const f = allFindings(
      snap([node("lambda", { memoryMb: 512, avgDurationMs: 900 })]),
      pricing,
    ).find((x) => x.rule === "memory_duration_tradeoff")!;
    expect(f.severity).toBe("info");
    expect(
      rulesFired(snap([node("lambda", { memoryMb: 2048, avgDurationMs: 900 })])),
    ).not.toContain("memory_duration_tradeoff");
  });

  it("on_demand_steady_state fires past the provisioned crossover", () => {
    expect(
      rulesFired(
        snap([node("dynamodb", { capacityMode: "on-demand", readsPerMonth: 500_000_000, writesPerMonth: 100_000_000 })]),
      ),
    ).toContain("on_demand_steady_state");
    expect(
      rulesFired(
        snap([node("dynamodb", { capacityMode: "on-demand", readsPerMonth: 100_000, writesPerMonth: 20_000 })]),
      ),
    ).not.toContain("on_demand_steady_state");
    expect(
      rulesFired(snap([node("dynamodb", { capacityMode: "provisioned" })])),
    ).not.toContain("on_demand_steady_state");
  });

  it("no_lifecycle_on_logs wants lifecycle rules on log buckets", () => {
    expect(
      rulesFired(snap([node("s3", { purpose: "logs", lifecycleRules: false })])),
    ).toContain("no_lifecycle_on_logs");
    expect(
      rulesFired(snap([node("s3", { purpose: "logs", lifecycleRules: true })])),
    ).not.toContain("no_lifecycle_on_logs");
    expect(
      rulesFired(snap([node("s3", { purpose: "assets", lifecycleRules: false })])),
    ).not.toContain("no_lifecycle_on_logs");
  });

  it("s3_public_no_cdn clears once CloudFront sits in front", () => {
    const bucket = node("s3", { publiclyServed: true });
    expect(rulesFired(snap([bucket]))).toContain("s3_public_no_cdn");
    const cdn = node("cloudfront");
    expect(
      rulesFired(
        snap(
          [bucket, cdn],
          [{ id: "e1", from: cdn.id, to: bucket.id, kind: "data" }],
        ),
      ),
    ).not.toContain("s3_public_no_cdn");
  });

  it("async_no_dlq is critical for async consumers without a DLQ", () => {
    const q = node("sqs", { dlqConfigured: false });
    const producer = node("sns");
    const s = snap([producer, q], [{ id: "e1", from: producer.id, to: q.id, kind: "async" }]);
    const f = allFindings(s, pricing).find((x) => x.rule === "async_no_dlq")!;
    expect(f.severity).toBe("critical");
    const q2 = node("sqs", { dlqConfigured: true });
    expect(
      rulesFired(
        snap([producer, q2], [{ id: "e1", from: producer.id, to: q2.id, kind: "async" }]),
      ),
    ).not.toContain("async_no_dlq");
  });

  it("unbounded_fanout needs 2+ Lambda consumers with no reserved concurrency", () => {
    const topic = node("sns");
    const l1 = node("lambda");
    const l2 = node("lambda");
    const edges: ArchEdge[] = [
      { id: "e1", from: topic.id, to: l1.id, kind: "async" },
      { id: "e2", from: topic.id, to: l2.id, kind: "async" },
    ];
    expect(rulesFired(snap([topic, l1, l2], edges))).toContain("unbounded_fanout");
    const l3 = node("lambda", { reservedConcurrency: 10 });
    const l4 = node("lambda", { reservedConcurrency: 10 });
    expect(
      rulesFired(
        snap(
          [topic, l3, l4],
          [
            { id: "e1", from: topic.id, to: l3.id, kind: "async" },
            { id: "e2", from: topic.id, to: l4.id, kind: "async" },
          ],
        ),
      ),
    ).not.toContain("unbounded_fanout");
  });
});
