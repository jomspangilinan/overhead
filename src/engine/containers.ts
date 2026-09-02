// Containers are structural and AWS-semantic: they nest in a legal order, a
// node lives in exactly one, they roll costs up the tree, and they appear in
// the IaC output. Sections (elsewhere) are the opposite — yours, free-form,
// never validated. Conflating the two was the original mistake.
//
// Five kinds are enabled. Re-enabling external/account/az/asg is a data edit
// in LEGAL_PARENTS and KIND_META plus one line in the ContainerKind union —
// no logic changes.

import type { ArchNode, ServiceId, StateSnapshot } from "./model";
import { toMoney } from "./model";
import type { PricingTable } from "./pricing";
import { allCosts } from "./cost";

export type ContainerKind =
  | "cloud"
  | "region"
  | "vpc"
  | "subnetpub"
  | "subnetpri";

export interface Container {
  id: string;
  kind: ContainerKind;
  name: string;
  cidr?: string;
  parent?: string;
  collapsed: boolean;
  /** Stored only once a user moves or resizes it; otherwise derived. */
  bounds?: { x: number; y: number; w: number; h: number };
}

/** `null` means "may sit at the top level". */
export const LEGAL_PARENTS: Record<ContainerKind, (ContainerKind | null)[]> = {
  cloud: [null],
  region: ["cloud"],
  vpc: ["region"],
  subnetpub: ["vpc"],
  subnetpri: ["vpc"],
};

export const KIND_META: Record<
  ContainerKind,
  { label: string; color: string; icon: string | null; dash?: string }
> = {
  cloud: { label: "AWS Cloud", color: "#8B97A8", icon: "aws-group-cloud" },
  region: {
    label: "Region",
    color: "#00A4A6",
    icon: "aws-group-region",
    dash: "5 4",
  },
  vpc: { label: "VPC", color: "#8C4FFF", icon: "aws-group-vpc" },
  subnetpub: {
    label: "Public subnet",
    color: "#7AA116",
    icon: "aws-group-public",
  },
  subnetpri: {
    label: "Private subnet",
    color: "#00A4A6",
    icon: "aws-group-private",
  },
};

export const CONTAINER_KINDS = Object.keys(LEGAL_PARENTS) as ContainerKind[];

/** Which container kinds a service may sit directly inside. */
const DEFAULT_PLACEMENT: ContainerKind[] = ["region", "cloud"];

export interface PlacementError {
  code:
    | "illegal_parent"
    | "illegal_placement"
    | "no_such_container"
    | "would_cycle"
    | "duplicate_cloud";
  message: string;
  legalParents?: string[];
  legalContainers?: string[];
}

export function legalChildren(kind: ContainerKind | null): ContainerKind[] {
  return CONTAINER_KINDS.filter((k) => LEGAL_PARENTS[k].includes(kind));
}

export function validateContainerParent(
  kind: ContainerKind,
  parentKind: ContainerKind | null,
): PlacementError | null {
  if (LEGAL_PARENTS[kind].includes(parentKind)) return null;
  const legal = LEGAL_PARENTS[kind].map((p) => p ?? "top level");
  return {
    code: "illegal_parent",
    message: `A ${KIND_META[kind].label} cannot sit inside ${
      parentKind ? `a ${KIND_META[parentKind].label}` : "the top level"
    }. It belongs in: ${legal.join(", ")}.`,
    legalParents: legal,
  };
}

/**
 * Where a service may live. Every v1 service is regional/serverless, so the
 * default covers them — but the rule exists so the moment RDS or ECS lands,
 * the agent already gets "…cannot sit directly in a VPC; it needs a subnet".
 */
export function validateNodePlacement(
  service: ServiceId,
  containerKind: ContainerKind | null,
  placement: ContainerKind[] = DEFAULT_PLACEMENT,
): PlacementError | null {
  if (containerKind === null) return null; // the canvas itself is always fine
  if (placement.includes(containerKind)) return null;
  // Lambdas may be VPC-attached — a real pattern, and the only one v1 needs.
  if (service === "lambda" && (containerKind === "subnetpri" || containerKind === "subnetpub"))
    return null;
  return {
    code: "illegal_placement",
    message: `${service} cannot sit directly in a ${KIND_META[containerKind].label}. It belongs in: ${placement
      .map((k) => KIND_META[k].label)
      .join(", ")}.`,
    legalContainers: placement,
  };
}

const MAX_DEPTH = 12;

export function ancestorsOf(containers: Container[], id: string): Container[] {
  const byId = new Map(containers.map((c) => [c.id, c]));
  const out: Container[] = [];
  let cur = byId.get(id)?.parent;
  for (let i = 0; cur && i < MAX_DEPTH; i++) {
    const c = byId.get(cur);
    if (!c) break;
    out.push(c);
    cur = c.parent;
  }
  return out;
}

export function wouldCycle(
  containers: Container[],
  id: string,
  newParent: string | undefined,
): boolean {
  if (!newParent) return false;
  if (newParent === id) return true;
  return ancestorsOf(containers, newParent).some((c) => c.id === id);
}

export function descendantIds(containers: Container[], id: string): string[] {
  const out: string[] = [];
  const walk = (parent: string) => {
    for (const c of containers) {
      if (c.parent === parent) {
        out.push(c.id);
        walk(c.id);
      }
    }
  };
  walk(id);
  return out;
}

/** Every node inside this container, at any depth. */
export function nodesUnder(snap: StateSnapshot, id: string): ArchNode[] {
  const ids = new Set([id, ...descendantIds(snap.containers, id)]);
  return snap.nodes.filter((n) => n.container && ids.has(n.container));
}

/** "AWS Cloud › ap-southeast-1 › prod-vpc › private-a" */
export function breadcrumb(snap: StateSnapshot, nodeId: string): string[] {
  const node = snap.nodes.find((n) => n.id === nodeId);
  if (!node?.container) return [];
  const own = snap.containers.find((c) => c.id === node.container);
  if (!own) return [];
  return [...ancestorsOf(snap.containers, own.id).reverse(), own].map((c) => c.name);
}

export interface ContainerStat {
  resources: number;
  monthly: number;
}

/** Recursive rollup: subnet → VPC → region → cloud. Derived, never stored. */
export function containerStats(
  snap: StateSnapshot,
  pricing: PricingTable,
): Map<string, ContainerStat> {
  const cost = new Map(allCosts(snap, pricing).map((c) => [c.nodeId, c.monthly]));
  const stats = new Map<string, ContainerStat>();
  for (const c of snap.containers) stats.set(c.id, { resources: 0, monthly: 0 });

  for (const node of snap.nodes) {
    if (!node.container) continue;
    const own = snap.containers.find((c) => c.id === node.container);
    if (!own) continue;
    const monthly = cost.get(node.id) ?? 0;
    for (const c of [own, ...ancestorsOf(snap.containers, own.id)]) {
      const s = stats.get(c.id);
      if (!s) continue;
      s.resources += 1;
      s.monthly += monthly;
    }
  }
  for (const s of stats.values()) s.monthly = toMoney(s.monthly);
  return stats;
}

/**
 * The outermost collapsed ancestor of a node or container — collapsing a VPC
 * while a subnet inside it is also collapsed must still show exactly one card.
 */
export function outermostCollapsedAncestor(
  containers: Container[],
  containerId: string | undefined,
): string | null {
  if (!containerId) return null;
  const own = containers.find((c) => c.id === containerId);
  if (!own) return null;
  const chain = [own, ...ancestorsOf(containers, own.id)];
  const collapsed = chain.filter((c) => c.collapsed);
  return collapsed.length ? collapsed[collapsed.length - 1].id : null;
}
