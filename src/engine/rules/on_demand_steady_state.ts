import type { Rule } from "./index";
import { price } from "../pricing";
import { byService, effective, requestsOf, saving } from "./util";

const HOURS = 730;
const SECONDS = HOURS * 3600;

export const onDemandSteadyState: Rule = (snapshot, pricing) =>
  byService(snapshot, "dynamodb").flatMap((node) => {
    const s = effective(node);
    if (s.capacityMode !== "on-demand") return [];
    const reads = requestsOf(s, "readsPerMonth", snapshot.traffic);
    const writes = requestsOf(s, "writesPerMonth", snapshot.traffic, 0.25);
    const onDemand =
      reads * price(pricing, "dynamodb.onDemandRead").rate +
      writes * price(pricing, "dynamodb.onDemandWrite").rate;
    // steady state: average request rate ≈ provisioned capacity needed
    const rcu = Math.max(1, Math.ceil(reads / SECONDS));
    const wcu = Math.max(1, Math.ceil(writes / SECONDS));
    const provisioned =
      rcu * HOURS * price(pricing, "dynamodb.rcuHour").rate +
      wcu * HOURS * price(pricing, "dynamodb.wcuHour").rate;
    // fire only past a clear crossover — on-demand's elasticity is worth something
    if (provisioned >= onDemand * 0.8) return [];
    return [
      {
        rule: "on_demand_steady_state",
        severity: "warn" as const,
        message: `${node.name} is on-demand with steady traffic (~${rcu} RCU / ${wcu} WCU average). Past this volume, provisioned capacity is the cheaper mode.`,
        docUrl:
          "https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/capacity-mode.html",
        nodeIds: [node.id],
        estimatedSaving: saving(onDemand - provisioned),
      },
    ];
  });
