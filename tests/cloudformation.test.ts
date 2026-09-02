// CloudFormation is the two-way format: the template Overhead writes comes
// back as the drawing that made it, and somebody else's template comes back
// as a drawing at all. Reconciliation is what stands in for a sync.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { exportCloudFormation, exportJson } from "../src/engine/exporters";
import { cloudFormationTemplate } from "../src/engine/exporters/cloudformation";
import { parseYaml } from "../src/engine/iac/yaml";
import { importCloudFormation } from "../src/engine/iac/cloudformation";
import { detectFormat, importAny, importOverheadState } from "../src/engine/iac/import";
import { applyReconciliation, reconcile } from "../src/engine/iac/reconcile";
import { migrateSnapshot } from "../src/engine/migrate";
import { DEFAULT_TRAFFIC, type StateSnapshot } from "../src/engine/model";
import { SERVICES } from "../src/engine/services";
import { defaultSettings } from "../src/engine/defineService";
import type { PricingTable } from "../src/engine/pricing";
import { monthlyTotal } from "../src/engine/cost";

const pricing = JSON.parse(
  readFileSync(join(__dirname, "..", "data", "pricing.us-east-1.json"), "utf8"),
) as PricingTable;

const sample = (name: string): StateSnapshot =>
  migrateSnapshot(JSON.parse(readFileSync(join(__dirname, "..", "samples", `${name}.json`), "utf8")));

const ok = <T extends { ok: boolean }>(r: T) => {
  if (!r.ok) throw new Error(`import failed: ${JSON.stringify(r)}`);
  return r as Extract<T, { ok: true }>;
};

describe("CloudFormation export", () => {
  for (const name of ["api-backend", "media-pipeline", "event-driven"]) {
    it(`${name}: every resource is typed, and the YAML reads back as the template`, () => {
      const snap = sample(name);
      const yaml = exportCloudFormation(snap, pricing, name);
      const template = parseYaml(yaml) as { AWSTemplateFormatVersion: string; Resources: Record<string, unknown> };
      // the YAML writer and reader agree with the object they came from
      expect(template).toEqual(cloudFormationTemplate(snap, pricing, name));
      expect(template.AWSTemplateFormatVersion).toBe("2010-09-09");
      const resources = Object.values(template.Resources) as { Type: string }[];
      expect(resources.length).toBeGreaterThanOrEqual(snap.nodes.length);
      for (const r of resources) expect(r.Type).toMatch(/^AWS::[A-Za-z0-9]+::[A-Za-z0-9]+$/);
      // logical ids are unique by construction
      expect(new Set(Object.keys(template.Resources)).size).toBe(Object.keys(template.Resources).length);
    });

    it(`${name}: round-trips through its own metadata`, () => {
      const snap = sample(name);
      const back = ok(importCloudFormation(exportCloudFormation(snap, pricing, name)));
      expect(back.report.source).toBe("overhead");
      expect(back.snapshot.nodes.map((n) => n.id)).toEqual(snap.nodes.map((n) => n.id));
      expect(back.snapshot.nodes.map((n) => n.settings)).toEqual(snap.nodes.map((n) => n.settings));
      expect(back.snapshot.edges.map((e) => `${e.from}->${e.to}`)).toEqual(snap.edges.map((e) => `${e.from}->${e.to}`));
      expect(back.snapshot.containers).toEqual(snap.containers);
      expect(back.snapshot.traffic).toEqual(snap.traffic);
      // the estimate survives the trip, which is the whole point of it
      expect(monthlyTotal(back.snapshot, pricing)).toBeCloseTo(monthlyTotal(snap, pricing), 6);
    });
  }
});

describe("every service, through CloudFormation and back", () => {
  const snap: StateSnapshot = {
    nodes: Object.values(SERVICES).map((def, i) => ({
      id: def.id,
      service: def.id,
      name: `${def.id}-one`,
      settings: defaultSettings(def),
      position: { x: i * 240, y: 0 },
    })),
    edges: [],
    containers: [],
    sections: [],
    traffic: DEFAULT_TRAFFIC,
  };

  it("round-trips settings and names for all of them", () => {
    const back = ok(importCloudFormation(exportCloudFormation(snap, pricing, "all services")));
    expect(back.snapshot.nodes.map((n) => n.name)).toEqual(snap.nodes.map((n) => n.name));
    expect(back.snapshot.nodes.map((n) => n.settings)).toEqual(snap.nodes.map((n) => n.settings));
  });

  it("reads its own resources structurally, without the metadata block", () => {
    const template = cloudFormationTemplate(snap, pricing, "all services") as { Metadata?: unknown };
    delete template.Metadata;
    const back = ok(importCloudFormation(JSON.stringify(template)));
    expect(back.report.source).toBe("foreign");
    // an AWS managed KMS key has no resource to find · everything else does
    const found = new Set(back.snapshot.nodes.map((n) => n.service));
    for (const def of Object.values(SERVICES)) {
      if (!def.cfn?.(defaultSettings(def), { logicalId: "X", resourceName: "x" }).length) continue;
      expect(found.has(def.id), def.id).toBe(true);
    }
  });
});

const FOREIGN = JSON.stringify({
  AWSTemplateFormatVersion: "2010-09-09",
  Resources: {
    OrdersVpc: { Type: "AWS::EC2::VPC", Properties: { CidrBlock: "10.0.0.0/16", Tags: [{ Key: "Name", Value: "orders-vpc" }] } },
    PrivateA: {
      Type: "AWS::EC2::Subnet",
      Properties: { VpcId: { Ref: "OrdersVpc" }, CidrBlock: "10.0.1.0/24", Tags: [{ Key: "Name", Value: "private-a" }] },
    },
    Jobs: { Type: "AWS::SQS::Queue", Properties: { QueueName: "jobs", FifoQueue: true, RedrivePolicy: { maxReceiveCount: 3 } } },
    Orders: {
      Type: "AWS::DynamoDB::Table",
      Properties: { TableName: "orders", BillingMode: "PROVISIONED", ProvisionedThroughput: { ReadCapacityUnits: 25, WriteCapacityUnits: 9 } },
    },
    Worker: {
      Type: "AWS::Lambda::Function",
      Properties: {
        FunctionName: "worker",
        Architectures: ["x86_64"],
        MemorySize: 2048,
        VpcConfig: { SubnetIds: [{ Ref: "PrivateA" }] },
        Environment: { Variables: { TABLE: { Ref: "Orders" } } },
      },
    },
    WorkerFromJobs: {
      Type: "AWS::Lambda::EventSourceMapping",
      Properties: { EventSourceArn: { "Fn::GetAtt": ["Jobs", "Arn"] }, FunctionName: { Ref: "Worker" } },
    },
    Alarm: { Type: "AWS::CloudWatch::Alarm", Properties: {} },
  },
});

describe("importing somebody else's template", () => {
  const result = ok(importCloudFormation(FOREIGN, { region: "us-east-1" }));

  it("reads the resources it models and says what it left out", () => {
    expect(result.report.source).toBe("foreign");
    expect(result.snapshot.nodes.map((n) => n.name).sort()).toEqual(["jobs", "orders", "worker"]);
    expect(result.report.skipped).toEqual([{ type: "AWS::CloudWatch::Alarm", count: 1 }]);
  });

  it("reads settings back through fromCfn, and only those", () => {
    const worker = result.snapshot.nodes.find((n) => n.name === "worker")!;
    expect(worker.settings.architecture).toBe("x86_64");
    expect(worker.settings.memoryMb).toBe(2048);
    expect(worker.settings.vpcAttached).toBe(true);
    // the template says nothing about how often it runs · that stays default
    expect(result.stated[worker.id]).not.toContain("avgDurationMs");
    const table = result.snapshot.nodes.find((n) => n.name === "orders")!;
    expect(table.settings.capacityMode).toBe("provisioned");
    expect(table.settings.provisionedRcu).toBe(25);
    const queue = result.snapshot.nodes.find((n) => n.name === "jobs")!;
    expect(queue.settings.queueType).toBe("fifo");
    expect(queue.settings.dlqConfigured).toBe(true);
  });

  it("takes containment from the VPC and the subnet the function names", () => {
    const worker = result.snapshot.nodes.find((n) => n.name === "worker")!;
    const subnet = result.snapshot.containers.find((c) => c.id === worker.container)!;
    expect(subnet.kind).toBe("subnetpri");
    expect(subnet.name).toBe("private-a");
    const vpc = result.snapshot.containers.find((c) => c.id === subnet.parent)!;
    expect(vpc.kind).toBe("vpc");
    expect(vpc.cidr).toBe("10.0.0.0/16");
  });

  it("infers the connections from what references what", () => {
    const name = (id: string) => result.snapshot.nodes.find((n) => n.id === id)!.name;
    const drawn = result.snapshot.edges.map((e) => `${name(e.from)} ${e.kind} ${name(e.to)}`).sort();
    // the event source mapping is the queue feeding the worker; the env var
    // is the worker reading the table
    expect(drawn).toEqual(["jobs async worker", "worker data orders"]);
  });

  it("reads hand-written YAML, short-form intrinsics included", () => {
    const yaml = [
      "AWSTemplateFormatVersion: '2010-09-09'",
      "Resources:",
      "  Uploads:",
      "    Type: AWS::S3::Bucket",
      "    Properties:",
      "      BucketName: uploads   # where the originals land",
      "      VersioningConfiguration:",
      "        Status: Enabled",
      "  Resizer:",
      "    Type: AWS::Lambda::Function",
      "    Properties:",
      "      FunctionName: resizer",
      "      MemorySize: 1536",
      "      Architectures: [arm64]",
      "      Environment:",
      "        Variables:",
      "          BUCKET: !Ref Uploads",
      "  Notify:",
      "    Type: AWS::SNS::Topic",
      "    Properties:",
      "      TopicName: notify",
      "      KmsMasterKeyId: !Sub 'alias/${AWS::AccountId}-sns'",
    ].join("\n");
    const r = ok(importCloudFormation(yaml));
    expect(r.snapshot.nodes.map((n) => n.name).sort()).toEqual(["notify", "resizer", "uploads"]);
    const bucket = r.snapshot.nodes.find((n) => n.name === "uploads")!;
    expect(bucket.settings.versioning).toBe(true);
    const fn = r.snapshot.nodes.find((n) => n.name === "resizer")!;
    expect(fn.settings.memoryMb).toBe(1536);
    expect(fn.settings.architecture).toBe("arm64");
    expect(r.snapshot.nodes.find((n) => n.name === "notify")!.settings.encryption).toBe("sse-kms");
    // !Ref Uploads inside the function's environment is the connection
    expect(r.snapshot.edges.map((e) => `${e.kind}`)).toEqual(["data"]);
  });

  it("refuses something that is not a template", () => {
    const r = importCloudFormation('{"hello":"world"}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("not_a_template");
  });
});

describe("telling the two importable formats apart", () => {
  const drawing = sample("api-backend");
  const saved = exportJson(drawing, pricing);

  it("reads content, not the extension · both are .json", () => {
    expect(detectFormat(saved)).toBe("overhead");
    expect(detectFormat(JSON.stringify(cloudFormationTemplate(drawing, pricing, "x")))).toBe("cloudformation");
    expect(detectFormat(exportCloudFormation(drawing, pricing, "x"))).toBe("cloudformation");
    expect(detectFormat('{"hello":1}')).toBe(null);
    expect(detectFormat("not json at all")).toBe(null);
  });

  it("an Overhead file comes back exactly, positions included", () => {
    const back = ok(importOverheadState(saved));
    expect(back.snapshot.nodes.map((n) => n.id)).toEqual(drawing.nodes.map((n) => n.id));
    expect(back.snapshot.nodes.map((n) => n.position)).toEqual(drawing.nodes.map((n) => n.position));
    expect(back.snapshot.nodes.map((n) => n.settings)).toEqual(drawing.nodes.map((n) => n.settings));
    expect(monthlyTotal(back.snapshot, pricing)).toBeCloseTo(monthlyTotal(drawing, pricing), 6);
  });

  it("refuses a file whose services this build does not have", () => {
    const r = importOverheadState(JSON.stringify({ nodes: [{ id: "a", service: "quantum", settings: {} }] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/quantum/);
  });

  it("says so when the pinned format is not what the file is", () => {
    const r = importAny(saved, { format: "cloudformation" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/Overhead file/);
    expect(ok(importAny(saved)).format).toBe("overhead");
  });
});

describe("reconciliation", () => {
  const drawing = sample("api-backend");

  it("finds nothing to do against its own template", () => {
    const back = ok(importCloudFormation(exportCloudFormation(drawing, pricing, "api-backend")));
    const diff = reconcile(drawing, back.snapshot, back.stated);
    expect(diff.counts).toEqual({ added: 0, removed: 0, changed: 0, same: drawing.nodes.length });
    expect(diff.edges).toEqual([]);
  });

  it("names the settings a template changed, and merge applies only those", () => {
    const fn = drawing.nodes.find((n) => n.service === "lambda")!;
    const tuned: StateSnapshot = {
      ...drawing,
      nodes: drawing.nodes.map((n) => (n.id === fn.id ? { ...n, settings: { ...n.settings, avgDurationMs: 777 } } : n)),
    };
    const edited: StateSnapshot = {
      ...drawing,
      nodes: drawing.nodes.map((n) => (n.id === fn.id ? { ...n, settings: { ...n.settings, memoryMb: 3008 } } : n)),
    };
    // as a foreign template would state it: architecture and memory, nothing else
    const stated = { [fn.id]: ["architecture", "memoryMb"] };
    const diff = reconcile(tuned, edited, stated);
    expect(diff.counts.changed).toBe(1);
    expect(diff.nodes.find((n) => n.kind === "changed")!.changes).toEqual([
      { key: "memoryMb", from: fn.settings.memoryMb, to: 3008 },
    ]);
    const merged = applyReconciliation(tuned, edited, diff, "merge", stated);
    const after = merged.nodes.find((n) => n.id === fn.id)!;
    expect(after.settings.memoryMb).toBe(3008);
    expect(after.settings.avgDurationMs).toBe(777); // the drawing's own tuning survives
  });

  it("merge adds what the template has and keeps what only the drawing has", () => {
    const extra: StateSnapshot = {
      ...drawing,
      nodes: [
        ...drawing.nodes,
        { id: "new-topic", service: "sns", name: "alerts", settings: {}, position: { x: 0, y: 0 } },
      ],
      edges: [...drawing.edges, { id: "e-new", from: drawing.nodes[0].id, to: "new-topic", kind: "async" }],
    };
    const trimmed: StateSnapshot = { ...drawing, nodes: drawing.nodes.slice(1), edges: [] };
    const diff = reconcile(trimmed, extra);
    expect(diff.counts.added).toBe(2); // the resource it dropped, plus the topic
    const merged = applyReconciliation(trimmed, extra, diff, "merge");
    expect(merged.nodes.map((n) => n.name)).toContain("alerts");
    expect(merged.nodes.length).toBe(extra.nodes.length);
    const replaced = applyReconciliation(trimmed, extra, diff, "replace");
    expect(replaced).toBe(extra);
  });

  it("reports the connections a template adds and drops", () => {
    const [a, b] = drawing.nodes;
    const without: StateSnapshot = { ...drawing, edges: drawing.edges.filter((e) => !(e.from === a.id && e.to === b.id)) };
    const diff = reconcile(without, drawing);
    const added = diff.edges.filter((e) => e.kind === "added");
    expect(added.length).toBeGreaterThan(0);
    const back = reconcile(drawing, without);
    expect(back.edges.some((e) => e.kind === "removed")).toBe(true);
  });
});
