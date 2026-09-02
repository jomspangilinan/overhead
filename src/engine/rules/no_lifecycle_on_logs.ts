import type { Rule } from "./index";
import { price } from "../pricing";
import { byService, effective, num, saving } from "./util";

export const noLifecycleOnLogs: Rule = (snapshot, pricing) =>
  byService(snapshot, "s3").flatMap((node) => {
    const s = effective(node);
    if (s.purpose !== "logs" && s.purpose !== "backup") return [];
    if (s.lifecycleRules === true) return [];
    const storageGb = num(s.storageGb, 50);
    const standardMonthly = storageGb * price(pricing, "s3.storageGbMonth").rate;
    // Moving aged objects to IA/Glacier tiers typically halves the storage line.
    const estimated = standardMonthly * 0.5;
    return [
      {
        rule: "no_lifecycle_on_logs",
        severity: "warn" as const,
        message: `${node.name} holds ${s.purpose} data in Standard with no lifecycle rule. Logs and backups age predictably — transition or expire them and the storage line stops growing.`,
        docUrl:
          "https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html",
        nodeIds: [node.id],
        estimatedSaving: saving(estimated),
      },
    ];
  });
