import type { Rule } from "./index";
import { byService, effective, num } from "./util";

export const memoryDurationTradeoff: Rule = (snapshot) =>
  byService(snapshot, "lambda").flatMap((node) => {
    const s = effective(node);
    const memoryMb = num(s.memoryMb, 512);
    const durationMs = num(s.avgDurationMs, 200);
    if (memoryMb >= 1024 || durationMs <= 500) return [];
    return [
      {
        rule: "memory_duration_tradeoff",
        severity: "info" as const,
        message: `${node.name}: ${memoryMb} MB with ${durationMs} ms average duration. CPU scales with memory — more memory often runs fast enough to cost the same or less. Worth profiling the crossover.`,
        docUrl:
          "https://docs.aws.amazon.com/lambda/latest/operatorguide/computing-power.html",
        nodeIds: [node.id],
      },
    ];
  });
