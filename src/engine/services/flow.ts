// The second vocabulary: a flow diagram that is not AWS.
//
// Everything else in `services/` is an AWS service with a price. These six
// are shapes: a step, a decision, a start/end, an actor, a store, a system
// that is not ours. They go through the *same* defineService() spine, which
// is the whole point · the palette, the Inspector, `add_service`,
// `patch_state`, the Layers tree, containers, sections, undo, export and the
// Mermaid round trip all treat them like anything else, because they are.
//
// What they do not have is a price. `price()` returns no lines, so the node
// carries no monthly figure (`AwsNode` shows nothing rather than $0.00) and
// contributes nothing to the total. That is the honest reading: Overhead
// prices AWS SKUs, and a box labelled "billing team approves" is not one.
// It is still part of the design · it is drawn, exported, and the agent can
// read and edit it.

import { defineService } from "../defineService";

/** No SKU, no line, no figure. Shared by all six so the reason is in one place. */
const unpriced = () => [];

/** One free-text-ish setting every shape has: what this box means. Kept as
 *  an enum-free number-free note is not a thing the schema has, so shapes
 *  carry no settings at all · the name on the node is the content. */
const noSettings = {} as const;

export const flowStep = defineService({
  id: "step",
  term: "Step",
  icon: "flow-step",
  family: "flow",
  role: "handlers",
  settings: noSettings,
  cardLines: [],
  price: unpriced,
});

export const flowDecision = defineService({
  id: "decision",
  term: "Decision",
  icon: "flow-decision",
  family: "flow",
  role: "handlers",
  settings: noSettings,
  cardLines: [],
  price: unpriced,
});

export const flowTerminal = defineService({
  id: "terminal",
  term: "Start / end",
  icon: "flow-terminal",
  family: "flow",
  role: "ingress",
  settings: noSettings,
  cardLines: [],
  price: unpriced,
});

export const flowActor = defineService({
  id: "actor",
  term: "Actor",
  icon: "flow-actor",
  family: "flow",
  role: "ingress",
  settings: noSettings,
  cardLines: [],
  price: unpriced,
});

export const flowStore = defineService({
  id: "store",
  term: "Store",
  icon: "flow-store",
  family: "flow",
  role: "data",
  settings: noSettings,
  cardLines: [],
  price: unpriced,
});

export const flowExternal = defineService({
  id: "external",
  term: "External system",
  icon: "flow-external",
  family: "flow",
  role: "data",
  settings: noSettings,
  cardLines: [],
  price: unpriced,
});
