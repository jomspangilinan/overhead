import type { Rule } from "./index";
import { price } from "../pricing";
import { byService, effective, num, requestsOf, saving } from "./util";

export const x86Lambda: Rule = (snapshot, pricing) =>
  byService(snapshot, "lambda").flatMap((node) => {
    const s = effective(node);
    if (s.architecture === "arm64") return [];
    const invocations = requestsOf(s, "invocationsPerMonth", snapshot.traffic);
    const gbSeconds =
      invocations * (num(s.avgDurationMs, 200) / 1000) * (num(s.memoryMb, 512) / 1024);
    const delta =
      gbSeconds *
      (price(pricing, "lambda.gbSecond.x86_64").rate -
        price(pricing, "lambda.gbSecond.arm64").rate);
    return [
      {
        rule: "x86_lambda",
        severity: "warn" as const,
        message: `${node.name} runs on x86_64. arm64 (Graviton) prices ~20% lower per GB-second, and most runtimes move with a config change.`,
        docUrl: "https://aws.amazon.com/lambda/pricing/",
        nodeIds: [node.id],
        estimatedSaving: saving(delta),
      },
    ];
  });
