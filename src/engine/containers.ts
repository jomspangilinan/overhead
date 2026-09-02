// Containers are frames with an AWS meaning: a node lives in exactly one,
// they roll costs up the tree, and they appear in the IaC output. They are
// never validated · a VPC may sit at the top level, DynamoDB may sit in a
// subnet · the user draws what they mean. Sections (elsewhere) are the
// same idea without the AWS meaning.
//
// Five kinds are enabled. Adding external/account/az/asg is a data edit in
// TYPICAL_PARENTS and KIND_META plus one line in the ContainerKind union.

import type { ArchNode, StateSnapshot } from "./model";
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

/**
 * Where a kind *usually* sits, used only to pick a sensible default parent
 * when the user adds one (a VPC lands in the selected region). It is a
 * hint, never a rule: any container may sit inside any other, or at the
 * top level, and any service may sit in any container. The only thing
 * ever refused is a cycle or a reference to something that does not exist.
 */
export const TYPICAL_PARENTS: Record<ContainerKind, ContainerKind[]> = {
  cloud: [],
  region: ["cloud"],
  vpc: ["region", "cloud"],
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

export const CONTAINER_KINDS = Object.keys(TYPICAL_PARENTS) as ContainerKind[];

export interface PlacementError {
  code: "no_such_container" | "no_such_node" | "would_cycle";
  message: string;
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
