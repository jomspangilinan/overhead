import { defineService } from "../defineService";
import { price } from "../pricing";
import { line, num } from "./util";

export const lambda = defineService({
  id: "lambda",
  term: "AWS Lambda",
  icon: "aws-lambda",
  lane: "handlers",
  settings: {
    architecture: {
      type: "enum",
      values: ["arm64", "x86_64"],
      default: "arm64",
      label: "Architecture",
      driver: true,
    },
    memoryMb: {
      type: "number",
      min: 128,
      max: 10240,
      default: 512,
      label: "Memory (MB)",
      driver: true,
    },
    timeoutSec: {
      type: "number",
      min: 1,
      max: 900,
      default: 3,
      label: "Timeout (s)",
    },
    avgDurationMs: {
      type: "number",
      min: 1,
      default: 200,
      label: "Avg duration (ms)",
      driver: true,
    },
    invocationsPerMonth: {
      type: "number",
      min: 0,
      optional: true,
      label: "Invocations / month",
      driver: true,
      description: "Defaults to the canvas traffic figure",
    },
    reservedConcurrency: {
      type: "number",
      min: 0,
      optional: true,
      label: "Reserved concurrency",
    },
    dlqConfigured: {
      type: "boolean",
      default: false,
      label: "DLQ / on-failure destination",
    },
  },
  cardLines: ["architecture", "memoryMb", "avgDurationMs"],
  price: (s, traffic, pricing) => {
    const invocations = num(s.invocationsPerMonth, traffic.requestsPerMonth);
    const memoryGb = num(s.memoryMb, 512) / 1024;
    const durationSec = num(s.avgDurationMs, 200) / 1000;
    const gbSeconds = invocations * durationSec * memoryGb;
    const arch = s.architecture === "x86_64" ? "x86_64" : "arm64";
    return [
      line(price(pricing, "lambda.requests"), invocations),
      line(price(pricing, `lambda.gbSecond.${arch}`), gbSeconds),
    ];
  },
});
