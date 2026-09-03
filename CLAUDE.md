# Overhead — the whole thing in one document

> **The view from above your AWS architecture — and what it costs to run.**
> Entry for the WebMCP Challenge (Devpost). Deadline **3 Sep 2026, 1:00 PM PDT** = **Thu 4 Sep, 04:00 Manila**;
> submit by 03:00.
>
> **`SCRIPT.md` is the pitch and `DEVPOST.md` the submission copy; both hang off one claim (below).**
> **This file is the only handover doc.** Claude Code loads it automatically. It describes what is *built*, not
> what was once planned — when the code and this file disagree, fix whichever is wrong and say so.
> `reference/` holds assets, not documents; `README.md` is the public readme for judges.

**References**

| | |
|---|---|
| Live app | https://overhead-ecru.vercel.app (Vercel project `overhead`, static export) |
| Repo | https://github.com/jomspangilinan/overhead — **still private; flip to public before submitting** |
| App mock (visual reference, now superseded on layout — see §7) | https://claude.ai/code/artifact/950995d4-6bba-4566-92c7-3ee0330c32bc = `reference/overhead-mock.html` |
| Diagram-language walkthrough | https://claude.ai/code/artifact/a02ba1aa-3893-4fdd-af39-8bf7058c82f3 |
| Visual directions (Instrument chosen) | https://claude.ai/code/artifact/839f9ec4-06e4-4756-a54b-ff9f880a4cad |

Local assets: `reference/overhead-mock.html` (the mock, offline), `reference/diagram-module.js` (vanilla-SVG
geometry the canvas was ported from — do not ship), `reference/aws-icon-sprite.svg` (26 official AWS icons as
`<symbol>`s; the copy the app loads is `public/icons/aws/sprite.svg`). Full icon package:
`~/Downloads/Icon-package_07312026.5846e92413caa21490223536cc97f1269e44fa92/`.

---

## 0. State of the build

Phases 0–9 (§15) are done under the current spec; what remains is **video, README refresh, submit**.

- Phase 0 passed 2026-09-02: `overhead_ping` registered and **executed from the ChatGPT desktop app's in-app
  browser** and from Chrome with the WebMCP flag.
- Engine: sixteen services, live Price List data for `us-east-1` + `ap-southeast-1`, nine findings, scenarios
  with dynamic tool registration, exporters (JSON/Markdown/Mermaid/SVG/CDK — `cdk synth` passes on all three
  samples), bill ingest.
- Model: **containers + sections** replaced the old lanes/groups (§5). Autosave migrates v1 state.
- Chrome: Instrument palette in a **docked** shell (§7) — the user overruled the mock's floating panels.
  2026-09-02 UX pass: the shell has a hard floor so the canvas never measures zero; frames drag, resize and
  accept dropped nodes; the Inspector is sectioned; Add is a floating palette and Templates a dialog.
  2026-09-02 evening (the user's Figma / Claude Design review): a **bottom-centre toolbar** with tooltips
  and one **View gear** (layers, cards, cost display); Add covers services *and* containers; the Section
  tool **draws a rectangle**; edges got four-sided anchors, waypoints, arrow modes, shapes, self-loops and
  a floating styling toolbar (kind and style kept apart); Layers is **one object tree** with sections,
  groups (⌘G) and connections; containers and sections share **one frame chrome and gesture** and moving a
  frame carries the sections inside it; security is schema-driven with gears on cards, frames and the
  view. Three root causes fixed on the way: frames never received pointer events (`.react-flow__viewport`
  is `pointer-events: none` and the portal inherited it); React Flow logged #015 on every drag because
  controlled nodes never carried `measured`; an unlayered `[data-tip] { position: relative }` beat
  Tailwind's `absolute` on anything with a tooltip (pads, gears).
  2026-09-02 late: **placement rules are gone** (any frame in any frame, any service in any frame; only
  cycles and unknown ids are refused), frame controls (collapse · gear · move) show only while a frame is
  selected or its header hovered, sections fold with the container that holds them and follow the
  drawing on drop, the Layers tree is an accordion (Connections folded by default) with drag-and-drop,
  auto-layout is container-aware, the Connect tool drags from anywhere on a node, and the "+" pads show on
  node hover again (a `pointer-events: none` hover zone never hovered).
  2026-09-03: **only the move grip moves a frame** (the header band selects), **frames have no gear**
  (selecting one opens the Inspector, so the popover was a second way to edit the same fields),
  **sections collapse** like containers, **any collapsed frame is one card** (`FrameCard`) that clicks to
  select and expands from its own button, an **empty** frame collapses to a card too, and Layers drops
  show a **Figma-style insertion line** (drop between rows to move out, onto a row to nest).
  2026-09-03 (the user going through Scenario, Trace, auto-layout and Export): **auto-layout is
  graph-driven** (columns are dependency depth, not the service's role · §5b), **Scenario never opens
  a `window.prompt`** (it forks on the click, the banner's name is an input, and the banner now lists
  every change against the base, priced, with the touched resources ringed on the canvas · §7),
  **Trace explains itself** (a pill says what to click, the traced edges animate, the pill then reads
  the hops and what that path costs, and the tool disarms after one trace), and **Export is a dialog**
  with named formats, a live preview and **PNG · SVG · PDF of the whole drawing** (§12) instead of a
  tab strip hidden inside the right dock.
  2026-09-03 (the user: "I want to be able to draw the diagram through code · and the agent should have
  it too"): the drawing is now **one document with three writers** · the canvas, the **Code** tab in the
  right dock (§7, live JSON both ways) and the agent's **`get_state` / `patch_state`** (§9). All three go
  through `engine/patch.ts` `applyPatch`, which merges partial objects **by id** (an agent's array index
  goes stale the moment a human drags something; an id does not), merges object fields one level deep so
  touching `memoryMb` does not wipe `architecture`, creates on an unknown id, and refuses the **whole**
  patch when any part of it fails the service schema · a half-applied document is worse than a refused one.
  2026-09-03 (the user: "can we also support mermaid diagrams? I feel like it's a good idea to have it
  be editable instead of just stuck with AWS Diagram"): **the canvas is not only AWS** and **Mermaid
  goes both ways** · §5c and §12c. Six flow shapes through the same `defineService()` spine, a
  Mermaid reader beside the CloudFormation one, and a **Mermaid tab** in the right dock that edits
  the drawing live the way the Code tab does.
  2026-09-03 (the user: "importing event-driven is not auto layout?"): **the samples are arranged on
  disk** now (`npm run layout-samples` → `tests/sample-layout.test.ts`, which also asserts it) and the app's
  seed just loads one. It used to re-run `autoLayout` at seed time, so the app's copy of event-driven and
  the one you imported were two different drawings · the sample was a sketch from an earlier build (a flat
  240 px grid, no frame bounds) and only the seed path ever tidied it. The import rule stays "a document
  that brings its own geometry keeps it", which is now right for samples too. And **fitting fits the
  drawing, not the nodes** (`canvas/fitDrawing.ts`, one implementation behind the first fit after a seed,
  the Import dialog and the zoom pill's Fit): React Flow's `fitView` only knows its own nodes, and frames
  are painted through a `ViewportPortal`, so a VPC reaching below its lowest resource was cut off at 100%.
  The rectangle is node bounds ∪ every stored frame rectangle · the same union the picture exporters use.
- 39 tools live, 43 while a scenario is open (§9).
- Tests: 261 across 24 vitest files (on `multiplayer`).

**Workflow the user asked for:** keep `npm run dev` running; the user reviews every change on
`localhost:3000` **before** anything is deployed. Deploy only when they say "deploy" (`npx vercel deploy
--prod --yes`). Commit small and often, no attribution trailers. **`npm run build` deletes the dev server's
`.next` cache** — after any production build, `pkill -f "next dev"; rm -rf .next; npm run dev`.

---

## Non-negotiables

- **`document.modelContext`**, `navigator.modelContext` as fallback. Never `provideContext`, never
  `unregisterTool` — abort with `AbortSignal`.
- Register in one `'use client'` provider at the root (`src/webmcp/provider.tsx`, mounted in
  `app/layout.tsx`), after hydration, in the **top-level document**. Imperative API only. The provider renders
  nothing; it publishes its outcome to the store and the bottom bar reads it.
- `src/webmcp/register.ts` contains a raw `document.modelContext.registerTool({ name, description,
  inputSchema, execute })` in that literal shape (`overhead_ping`) — the brief says repos should have it. Keep it.
- Every mutation updates the store **before** the tool returns.
- Read tools carry `readOnlyHint: true`; anything returning parsed bill content carries
  `untrustedContentHint: true`. Outputs ≤ ~1.5K chars (`text()` in `toolRegistry.ts` errors past that). Names
  ≤ 30, descriptions ≤ 500, param descriptions ≤ 150.
- No backend, no auth, no API routes. Static export. **One exception, on the `multiplayer` branch
  only** (2026-09-03, at the user's repeated request): `app/api/room/route.ts`, a WebSocket relay for
  live rooms, which is why that branch drops `output: "export"`. `main` stays static and shippable
  until the branch is reviewed. The relay stores nothing, reads nothing back, and is never contacted
  unless a URL carries `?room=`.
- **Never hardcode a price.** Rates come from `data/pricing.<region>.json`, generated by
  `scripts/fetch-pricing.ts` from the AWS Price List Bulk API, each SKU keeping its `sourceUrl`.
- **Every finding returns a `docUrl`.**
- MIT licence at the root; official AWS icons in `public/icons/aws/` with `NOTICE.md` carving them out of it.
- `src/engine/**` imports nothing from React or the DOM. Cost, findings, container stats and deltas are
  **derived selectors**, never stored.
- **Every affordance the chrome shows must work.** A printed keyboard hint is a binding; a button has an
  `onClick`; a toolbar tool changes something. If it can't be made real, remove it.
- **No band-aids.** Fix at the root with one shared implementation (containers and sections share
  `FrameChrome` + `useFrameGesture`; pads and edge anchors share `shapeOf`/`anchorPoint`); verify with a
  measurement (a unit test or a headless number), then check the siblings.
- **No em dashes in UI copy** (tooltips, notices, labels, setting descriptions). Use `·` or a colon.

---

## 1. What it is

Sketch a **serverless AWS architecture with your agent on a live canvas**. Every node carries its real AWS
price from the AWS Price List. Fork the design, compare the delta, fix what the findings flag, then export as
CDK, Markdown, Mermaid, SVG, or a JSON state file that reloads.

Three moves on one canvas:

1. **Sketch** — *"HTTP API → Lambda → DynamoDB, S3 uploads behind CloudFront, SQS for thumbnails, ~5M
   req/month."* Nodes land; a running monthly figure appears; the agent calls `get_findings` on its own work
   and fixes what it flagged.
2. **Tune** — *"What if the thumbnail Lambda runs on ARM at 1024 MB?"* A scenario opens, four scenario tools
   appear, the delta is drawn. Cost goes **down** because duration halves.
3. **Ground** — drop a Cost Explorer CSV. Parsed in the tab, never uploaded. Real spend lands on real nodes.

**Positioning:** a draw.io MCP lets an agent *draw* an AWS diagram. Overhead lets an agent *design* an AWS
architecture — the diagram is just the view.

**The "open web" line for the write-up:** before WebMCP, only platforms big enough to ship an API and an
official MCP server could expose capability to agents. Now any web page can, to whatever agent the visitor
brought — no platform's permission, no partnership, no backend.

## 2. Who it's for

- **Consultancies quoting a build** — a defensible monthly figure and a client-readable diagram before the
  proposal goes out. (Demo persona: a solo cloud consultant pricing a client's serverless backend.)
- **Teams triaging a bill** — the invoice jumped; which node; cheapest fix.
- **Engineers learning AWS** — nothing teaches architecture faster than watching a number move.

## 3. Scope

**v1 (shipped):** sixteen AWS services and six flow shapes (§5c) — Lambda, API Gateway, DynamoDB, S3, CloudFront, SQS, SNS, EventBridge,
Step Functions, Cognito, Kinesis Data Streams, Data Firehose, KMS, Secrets Manager, Parameter Store,
CloudWatch Logs. The last six answer "what does the plumbing cost": **encryption is not free** (a customer
managed key is $1 per key version per month before it is used, and every request is billed), a secret is
$0.40 a month against a standard parameter's nothing, and CloudWatch Logs ingestion routinely beats the
Lambda that wrote the log. Driver-based pricing. Scenario forking with delta. Findings with doc links and savings.
Exports. Live tool readout. Containers (cloud/region/VPC/subnets) and sections.

Flow shapes are the one thing on this canvas AWS has no name for, and they are deliberately
**unpriced** rather than priced at zero · §5c.

**Deferred:** `external` / `account` / `az` / `asg` container kinds (the validator tables are the only thing to
extend), NAT/ALB/RDS/ECS, enterprise findings, Terraform, fan-out collapse, `refresh_pricing`.

**Out of scope:** auth, backend, live AWS account connection, EC2 hourly pricing, multi-region.

## 4. Judging criteria and how we meet them

| Criterion | Argument |
|---|---|
| **WebMCP Leverage** (tiebreak #1) | 38 semantic tools in nine families, not draw primitives. Dynamic registration via `AbortController` — four tools exist only while a scenario is open, and the bottom bar's count ticks. Correct `readOnlyHint` / `untrustedContentHint`. Structured errors the agent must resolve (unknown container, a frame nested in itself, invalid setting). UI state commits before a tool returns. Raw `registerTool` present exactly as the brief prints it. |
| **Execution** | One screen, no login, no backend, no keys. Seeded sample with real containment. Undo/redo, full keyboard map, empty state, exports that `cdk synth`. |
| **Potential Impact** | Everyone with an AWS account. The gap between "what we'll build" and "what it'll cost" is served today only by the Pricing Calculator (no topology) or a spreadsheet. |
| **Creativity & Ambition** | Architecture + live cost + agent on one canvas; bill → diagram; containers that are semantic (priced, exported as IaC) not decorative; a diagram language that removes arrow spaghetti. |

## 5. Containment and sections

Two kinds of grouping. Conflating them was the original mistake; so was imposing lanes.

### 5a. Containers — frames with an AWS meaning, nested (`src/engine/containers.ts`)

A container is a frame that rolls cost up the tree and appears in IaC. A node lives in exactly one. Five
kinds are enabled; the other four from the mock are a data edit in `TYPICAL_PARENTS` and `KIND_META` plus
the `ContainerKind` union.

| Kind | Colour | Border | Icon | Typical parent (a hint) |
|---|---|---|---|---|
| `cloud` | `#8B97A8` | solid | `aws-group-cloud` | top level |
| `region` | `#00A4A6` | **dashed** | `aws-group-region` | cloud |
| `vpc` | `#8C4FFF` | solid | `aws-group-vpc` | region, cloud |
| `subnetpub` | `#7AA116` | solid | `aws-group-public` | vpc |
| `subnetpri` | `#00A4A6` | solid | `aws-group-private` | vpc |

- **Nothing is validated** (the user overruled the old rules on 2026-09-02: "you should not put
  restriction to the containers"). Any kind may sit at the top level or inside any other; any service may
  sit in any container. `TYPICAL_PARENTS` only picks the default parent when the palette adds one (the
  selected frame if typical, else the nearest typical ancestor, else the selected frame, else the deepest
  typical frame, else top level). `PlacementError` is now only `no_such_container` / `no_such_node` /
  `would_cycle`, from `addContainer`, `moveIntoContainer`, `setContainerParent`. `migrateSnapshot` keeps
  any nesting and only cuts a dangling or cyclic parent.
- Why containers are still frames and not nodes ("VPC is basically a service"): a VPC has to *hold*
  subnets and Lambdas, so it is a box; it carries no price because no VPC SKU (NAT, endpoints) is in the
  price list yet. The palette, the Layers tree and drag-and-drop treat frames and resources alike.
- `containerStats()` rolls resources and monthly cost up subnet → VPC → region → cloud. Derived.
- `breadcrumb(snap, nodeId)` → `["AWS Cloud", "ap-southeast-1", "orders-vpc", "private-a"]`; `get_node`
  returns it as `placement`.
- Frames (`ContainerFrames.tsx`, geometry in `src/engine/frames.ts`) are painted parents-first via
  `ViewportPortal`. The drawn box is **content ∪ stored `bounds`**: content = members + child frames with
  per-kind padding; `bounds` (set by a drag, a resize, or on creation of an empty container) is a floor and
  a position, never a clip — a member dragged past the edge grows the frame, removing members shrinks it
  back to the stored rectangle and no further. `setContainerBounds` clamps to the content floor.
- **Direct manipulation** (`canvas/frames/FrameChrome.tsx` + `useFrameGesture.ts`, shared with sections):
  **only the move grip** drags the frame and everything inside (`frameDrag` preview, `moveContainer` →
  `translateFrame` commits once on release → one undo step). The header band and the name **select**, so
  a stray press never shifts the drawing; double-click the name renames (`name · cidr`); the corner grip
  resizes. **There is no gear on a frame**: selecting it opens it in the Inspector, and a popover
  editing the same fields was redundant. The right-hand cluster (**collapse · move**) and the resize grip
  are **never permanent**: `.oh-frame-cluster` is hidden until the frame is selected (`data-selected`) or
  its header is hovered (`.oh-frame:hover`, reached through the header band since the wrapper itself
  takes no pointer events). **Moving a frame also moves every section
  whose members are all inside it** (`movedSectionIds`); a section spanning in and out stays and stretches.
  **Gotcha:** everything rendered through `ViewportPortal` inherits React Flow's
  `.react-flow__viewport { pointer-events: none }` — `globals.css` opts the handles back in
  (`.oh-frame-head`, `.oh-frame-grip`, `.oh-frame-move`, `.oh-frame-gear`, …) and they carry `nopan nodrag`.
- **Drop to re-parent:** dropping a node inside another frame calls `moveIntoContainer`; nothing is
  refused. While a node is dragged its own frame leaves it out (`exclude`), so the frame doesn't chase it.
  The same drop updates section membership (`sectionsAfterDrop`, §5b).
- An empty container gets `DEFAULT_SIZE` bounds placed inside its parent (or clear of everything) — this is
  why "Add AWS Cloud" used to look like it did nothing: a memberless frame had nothing to derive from.
- **Any frame collapses** to one 220×84 card (`FrameCard.tsx`, React Flow type `frame`, ids
  `container:<id>` / `section:<id>`): containers and sections alike. `outermostCollapsedAncestor` makes a
  collapsed VPC win over a collapsed subnet inside it, and a collapsed container wins over a section
  holding the same node. Edges re-route to the card and edges wholly inside are dropped (`Canvas.tsx`
  `collapsedByNode`, a node → host card id map). A frame with **nothing inside** collapses too, to a card
  at its own rectangle, so collapsing an empty VPC never makes it vanish. Clicking a card selects the
  frame itself (the Inspector shows it, with Expand); its expand button and a double-click both open it;
  hover isolation never dims a card (`.oh-frame-card`).
- `removeContainer` re-parents children and members upward — never deletes what was inside.

### 5b. Sections and groups — yours, free-form, orthogonal (`Section` in `src/engine/model.ts`)

- `{ id, name, color, kind?: 'section'|'group', parentId?, bounds?, nodeIds[], collapsed, style?: { dash,
  width, fill } }`. **`nodeIds` is the single source of truth**; nothing is stored on the node.
- **Made by drawing:** the Section tool (S) drags a rectangle on the canvas; the section gets those bounds
  and every resource whose centre is inside as members (`Canvas.tsx` `onDrawUp`). Also from the Layers
  header (from the selection) and the `add_section` tool.
- A **section** draws a dashed frame with the **same chrome as a container** (`FrameChrome`: header band,
  name, gear, move grip, resize grip in the same places); its geometry is `sectionBoxes` in
  `engine/frames.ts` (members ∪ stored bounds, `SECTION_PAD` + `SECTION_HEAD`). `style` is the user's
  border/fill; absent = dashed 1.4 px with a faint tint. The gear opens the appearance popover; selecting
  it shows Appearance / Members / Frame in the Inspector.
- **Moving:** `moveSection` → `translateFrame` moves its members through nested sections, its own bounds
  and every descendant section's bounds, in one undo step. Selecting a section sets `selectedIds` to its
  members (deep) so dragging any member carries the rest.
- **Membership follows the drawing.** A lone node dropped with its centre outside a section's box (drawn
  without it) leaves that section; dropped inside one it joins (`engine/frames.ts` `sectionsAfterDrop`,
  called from `Canvas.tsx` on drag stop). A section that would vanish without the node keeps it; groups
  are never touched. This is what "I can't move a service outside a section" was: membership was only
  `nodeIds`, and the box stretched to follow.
- **Folds with its container.** Members hidden inside a collapsed container leave the section's box
  (`FrameOpts.hidden`); a section whose every member is hidden is not drawn at all. Before this a
  collapsed container's card sat inside a still-drawn section, which read as the section owning it.
- **Sections collapse** exactly as containers do (`setSectionCollapsed`; the collapse control on the
  frame, the Layers row, and the Inspector): members hide and the section becomes a `FrameCard`.
- A **group** (`kind: 'group'`, ⌘G on a multi-selection, ⇧⌘G ungroups) draws nothing: a folder in Layers
  whose members select and move together. Same model, `addGroup` / `ungroup`.
- `parentId` nests sections/groups under a section **in the tree only** (`layers.ts`).
- Never validated; crosses containers freely; a node may be in many sections or none. `sections` is a
  layer (View gear), default on.
- `auto_layout` (`src/engine/layout.ts`, L on the toolbar) is **container-aware** and **graph-driven**:
  every scope lays out what it holds as a grid whose **columns are dependency depth** (`ranks()`:
  longest path over the edges inside that scope, with the back edges of a cycle dropped by DFS
  colouring) and whose rows are ordered to **cross as little as possible** (below). A frame's size is
  what its contents need plus `FRAME_PAD`/`FRAME_HEAD`, and its parent packs it the same way up to the
  canvas. Every container's `bounds` is re-fitted.
  **A child frame is a box in the same flow, not a shelf underneath it** (2026-09-03, "I thought the
  autolayout will make it so that the edges will not be intersecting as much"): `place()` ranks and
  orders resources and child frames together, an edge to anything inside a frame (at any depth) counting
  as an edge to the frame, so a VPC whose Lambda is fed by an API Gateway takes the column *after* the
  API. Frames used to be parked in a row beneath their scope, and that was the whole tangle in
  event-driven: `ingest-api → ingest-handler` had to leave the bottom of the region and cut back across
  `domain-bus → order-flow` and `domain-bus → fan-out` to reach a frame at the left margin. Two things
  that did **not** fix it, tried and measured first: sweeping the row order harder, and shifting the
  frame row sideways under the column that feeds it · both left the count at 2, because the edge still
  had to travel down and back. As boxes in the flow it is **0**.
  **A scope's columns are seeded by depth in the *whole* drawing** (2026-09-03, the user: "I think
  the auto layout didn't involve our added stuff?"). A scope ranks what it holds and a frame is one
  box in it, so **every path that leaves a frame and comes back collapses to one rank**: in
  an early cut of `partner-checkout` the payment provider (called from inside the region) and the
  finance ledger (written by a Lambda two steps later) came out in the same column, four boxes stacked in a line
  with the arrows crossing between them · **4 crossings**. So each box now *starts* at its depth in
  the whole drawing (a frame at the shallowest depth it holds · where the path feeding it arrives),
  and the scope's own edges relax over that seed the way a longest path does. Both constraints hold:
  an edge inside the scope still runs strictly left to right, and two boxes at genuinely different
  depths stop sharing a column even when the scope cannot see why. **0 crossings.**
  Seeding rather than tie-breaking is the part that matters, and it was measured: as a tie-break
  inside each local rank the same drawing put the orders queue (five steps deep) in the column
  *before* the validator (two), because both are local roots · the queue is only fed from outside
  the region. `tests/layout.test.ts` holds the rule with two nodes a frame feeds and no edge between
  them, and both new samples are in the crossing ceilings.
  **A placeholder takes a row** (2026-09-03, the user pointing at two edges arriving at one node as
  one thick line): a column-skipping edge's placeholder used to decide the order and then be
  dropped, which left the edge with no lane · the line was still drawn straight from source to
  target, so in `refund-approval` the edge from "Approve automatically" to "Issue the refund" ran
  clean **through** the "Approved?" diamond between them. Ordering was never the whole job; the
  point of a dummy vertex is that the real nodes move out of the way. It is a box one node tall
  (zero height does not line up with the rows its edge leaves and enters, and the node below lands
  back under the line), it **wins an ordering tie** (a tie means both orders cross the same number
  of edges, and the lane is the one that has to be where its line runs), and **one ordering pass now
  always runs** · the sweeps used to exit before ordering anything when a drawing already crossed
  nothing, which is exactly the case the lane is for.
  **Every column is centred on the drawing, when that is not worse** (2026-09-04, the user showing
  two pictures of the same graph: "the auto layout should prioritise readability · we can't avoid
  intersecting stuff, we can minimise, but still prioritise readability"). Columns were stacked from
  the top, so three sources into one target put the target level with the **first** source and the
  other two arrived as long diagonals climbing to it. Centred, the target sits in the middle of the
  three and the arrows converge · which is how anybody draws a fan-in by hand, and the same for a
  fan-out on the other side.
  It is **not free**, which is why it is chosen rather than applied: for an edge between adjacent
  columns only the row order decides whether it crosses, but an edge that **skips** a column is a
  straight line over the top of one, and moving a column changes what it cuts through. Centring took
  saas-platform from 1 crossing to 7. So `place()` builds both arrangements and counts them
  (`crossingsOf`, exported from `layout.ts` and the same measure `tests/layout-crossings.test.ts`
  applies to the finished drawing · one implementation, so the layout optimises against exactly what
  the tests hold it to), and keeps the centred one unless it made the drawing worse. All six samples
  are back at their previous counts, and the small ones now read symmetrically.
  **Crossing reduction** (`reduceCrossings`): the row order inside each column is what decides how many
  edges cross, so an edge that skips a column gets a **placeholder vertex** in every column it passes
  (it had no say at all before, and it is the one crossing everything), and the order is swept **down
  and back up** repeatedly by the **median** of each box's neighbours (Eades & Wormald · a mean is
  dragged around by one distant member of a fan-out), keeping the best arrangement seen. Placeholders
  decide order and never take a row. The old pass looked backwards only, which can never account for
  what a column feeds.
  `tests/layout-crossings.test.ts` counts crossings **geometrically** on the real output · all four
  samples are at 0, and the ceilings are asserted so a future change cannot quietly make a drawing worse.
  **Columns used to come from the service's role**, which drew the media-pipeline chain
  (cdn → assets → queue → worker) as cdn, worker, queue, assets with every arrow running backwards ·
  roles are now only `ServiceDef.role` and a `placeInRole` hint for a single new node, never the
  layout. Sections are emitted **per column of resources outside every frame, and only when the
  column holds two or more** (`auto-*` ids, replaced on re-run, user sections untouched): a dashed box
  around one icon says nothing, and a four-node chain used to come back wearing four of them.
  **Widths and gaps are measured, not constant** (2026-09-03): a column is as wide as the widest thing
  drawn in it, which is often the resource *name* and not the node, and the gap between two columns is
  opened by the widest edge label that has to sit in it (`textWidth`, base `COL_GAP` 44 / `ROW_GAP` 40).
  It is **mode-aware**: `LayoutOpts` separates the room a node needs (`nodeW`/`nodeH`, always the
  200×100 hit-box) from what it draws (`drawW`/`drawH`, `ICON_DRAW_W`/`ICON_DRAW_H` in icon mode,
  the hit-box in card mode, chosen from `cardModeOf`). Columns and rows are spaced by what is drawn,
  so a row of 56 px icons is not pitched as if each were a 200 px card, while every block's extent is
  still measured over the centres ± the hit-box, so a frame always contains what it holds and
  siblings never overlap in the mode they were laid out for.
  **This was pitched by the hit-box in both modes for an hour** (2026-09-03) and put back at the
  user's word: cards then never overlapped at any zoom, but the icon view every drawing opens in was
  the one that got worse · event-driven fit at 47% rather than 67%, and it read as unrelated icons
  rather than a chain. The trade is named rather than hidden: **an icon layout crowds once cards
  appear**, and the way out is that toggling cards re-arranges (below). The one path with no answer
  is reaching card mode by *zooming* past 130% without pressing K · that arrangement was spaced for
  icons and nothing re-ran.
  **Reaching card mode re-arranges the drawing for it** · K, the View gear, the Cost layer, or
  zooming past 130%. The trigger is `retidy(get, was)` in the store, called by `setCardsForced`,
  `setLayer` and `setZoom`, and it does nothing unless `cardModeOf` actually flipped (the zoom fires
  on every wheel tick and crosses the threshold once). It is **one undo step** · history subscribes
  to the model and a layout is a model change like any other; ⌘Z brings the positions back and the
  view stays in cards, because the view is not the model.
  It was the **explicit toggle only** for an hour, on the reasoning that re-arranging under a zoom
  gesture moves the canvas while you are reading it. The user found the hole immediately (2026-09-03,
  at 175%: "it didn't automatically tidy"): a card layout you only get by remembering to press K is
  not a layout, and zooming in to read a label is exactly when the crowding shows.
  **The View gear says which source is live.** Cards have three, and the checkbox is only one of
  them, so on its own it read as broken · cards on screen, box unticked, the reason buried in a
  parenthesis. It now reads "Cards are on from 165% zoom · the box pins them on when that changes",
  and falls back to naming the other two sources when they are off.
  Auto-layout also **says what it did** ("Arranged 13 resources in 5 columns by dependency · icon spacing · 1 section"),
  including when it removes `auto-` sections a previous run left behind: a four-node chain has no column
  worth a section, so re-running looked like it was deleting them for no reason.
  `tests/layout.test.ts` checks containment, no sibling overlap, edge-driven columns, the ignored back
  edge, row order, the section rule, and the two measured-spacing rules.

### 5c. Flow shapes — the canvas is not only AWS (`src/engine/services/flow.ts`)

2026-09-03, the user: *"we can have like a flow diagram outside the AWS stuff."* Six definitions —
`step`, `decision`, `terminal` (start/end), `actor`, `store`, `external` — go through the **same**
`defineService()` spine every AWS service goes through, so the palette, the Inspector,
`add_service`, `patch_state`, containers, sections, the Layers tree, undo, auto-layout and every
exporter treat them like anything else. A decision can sit in a VPC; a section can hold one; the
agent adds one with the tool it already has.

- **What they do not have is a price.** `price()` returns no lines, so the card shows **no figure at
  all** rather than `$0.00` (`AwsNode` reads `family`) and the total is unmoved. `family: "flow"` on
  `ServiceDef` is what splits them from `"aws"` (the default); `servicesInFamily()` is the one
  reader, and the sweeping tests (`golden-costs`, `define-service`) now say which family they mean.
  No `cfn`, no `cdk` · the CDK exporter already wrote `// <name>: no CDK mapping` for anything
  without one, and `npm run synth` passes with a flow sample in it.
- **Their icons are ours** (`Sprite.tsx`, `FLOW_SPRITE`): drawn on the AWS sprite's 80-unit grid so
  `<use>` sizes them identically, injected into the same `[data-oh-sprite]` element so the picture
  exporters keep working, and kept **out** of `public/icons/aws/sprite.svg` because `NOTICE.md`
  carves that file out of the MIT licence. Literal colours, not `currentColor` or a token: the
  exporters serialise into an isolated document where neither resolves.
- **Auto-layout does not box them in a role section.** A section it emits is named after a role
  ("Ingress", "Data"), and a role is an AWS idea · a decision and a start marker sharing a column
  are not "Data". They keep every other part of the layout (`layout.ts`, asserted in
  `tests/layout.test.ts`).
- **One grammar per drawing** (2026-09-03, the user: "I don't get how you mixed architecture and
  also a flow chart? Does that work that way?"). It does not, and the first sample proved it. An
  architecture diagram says *what exists and what talks to what* · every node is a component. A
  flowchart says *what happens in what order* · nodes are steps and branches in time. A decision
  diamond next to a Lambda asserts both at once, and no amount of layout rescues it. So the six
  shapes split by grammar, and there is a sample for each:
  - `actor` · `external` · `store` are **components**, and belong on an architecture canvas · a
    real architecture routinely contains things AWS does not bill for (the user, a payment
    provider, an on-prem system, a partner's API). `samples/partner-checkout.json`: a shopper, a
    payment provider, a warehouse WMS and a finance ledger around an HTTP API, two Lambdas, a queue
    and a table. $21.76, counting only the parts AWS bills for.
  - `step` · `decision` · `terminal` are **control flow**, and belong on a flowchart of their own.
    `samples/refund-approval.json`: eleven shapes, no AWS, no containers, **$0.00** · the same
    canvas, the same tools, the same Mermaid tab, nothing to price.
  Nothing in the engine enforces the split · a decision can still sit in a VPC if somebody means
  it. The samples teach the distinction rather than the validator imposing it.
- **`samples/saas-platform.json` is the showcase** (2026-09-03, the user: "I want a more complicated
  template · base it on a standard startup"): a Series-A B2B SaaS, **26 resources**, one of **every
  priced service**, four levels of containment (cloud › region › vpc › private-a, with a
  VPC-attached `report-runner` in the subnet), three non-AWS components, 27 connections,
  **$1,224.98/month** with Cognito at 25k MAU the biggest line by far · which is true, and worth
  saying rather than hiding. It is the drawing the audit loop is demonstrated on: **eight findings
  on purpose**, one per rule bar `s3_public_no_cdn`, spread over eight nodes so none reads as a
  pile-up · a REST API that should be HTTP, a table on on-demand past the crossover, an x86 worker
  with no DLQ (the one critical), an unbounded SNS fan-out, a logs bucket with no lifecycle, a
  Standard workflow at 150k executions, and a 512 MB / 800 ms Lambda. `tests/saas-platform.test.ts`
  asserts exactly those eight, because they are load-bearing and a price-list refresh could move a
  crossover and silently retire one. 1 crossing, measured.

### Migration (`src/engine/migrate.ts`)

Everything loaded from outside the current build (autosave `overhead-state-v2`, legacy `overhead-state-v1`,
`import_state`, samples) passes through `migrateSnapshot`: `groups[]` → `containers[]`, `logical` → a section
carrying its members, `az` dissolves upward, `subnet` → `subnetpub`, `node.group` → `node.container`,
`node.lane` dropped, illegal parents repaired up the chain, dangling containers unset.

## 6. Diagram language

1. **Keep the icons.** Nodes are the AWS standard: official Architecture Icon at 56 px, resource name beneath.
2. **One look, then deep dive.** Default view = icons, names, typed edges, containers, sections.
3. **The card houses the icon.** Zoom ≥ **130%** (or the Cards tool, K, or the Cost layer) and each icon moves
   inside a 200×76 card: service term, resource name, the 2–3 settings that decide price, security badge,
   monthly cost. Constant 200×100 hit-box in both modes (`src/canvas/nodeMetrics.ts`), so edges and drops stay stable · `ICON_DRAW_W`/`ICON_DRAW_H` beside it are what an icon *draws*, which is what auto-layout spaces by (§5b).
4. **Three edge kinds, three encodings, nothing else.** `sync` solid + arrowhead · `async` dashed `7 5` +
   arrowhead · `data` dotted `2 5`, no head. Permissions, logging, encryption are **node properties** (security
   badges), never edges.
5. **Edges are floating and four-sided** (`edgeGeometry.ts`, pure TS): anchors come from node position +
   visual shape (`shapeOf`: icon rim ±34 around centre y 39 · card ±100 × ±38), never from handle
   coordinates; the node's handles and "+" pads are placed from the same `shapeOf`/`anchorPoint`.
   `pickSides` chooses exit/entry sides by geometry (the axis with the larger clear gap wins, so a target
   below is left from the bottom and entered from the top), with one bias: **a run that climbs about as
   far as it travels (`|dy| > |dx| · 0.75`) is a vertical move** (2026-09-04, the user: "two branches,
   one goes up one goes down, but the system decided we should intersect the arrows"). `domain-bus →
   order-events` in event-driven is dx 129 / dy −120 and the horizontal branch won it by a hair, so it
   entered `order-events` on the **left** · the same side `order-events → notifier` leaves from, and the
   two lay on top of each other at the node. Routed vertically it rises out of the top and that left
   side is free; a **`return`** case leaves and enters from
   underneath when a back edge sits on the same row as its target and spans more than `RETURN_SPAN`,
   because a write-back two columns to the left used to run its line and its label straight through
   whatever was in between; `bracket` only when shapes overlap;
   `edge.anchors` pins a side per end. **Sides are picked in `Canvas.tsx`** so fans (`fan`) are keyed per
   node *and* side, and **a side's slots run in the same direction as the things they point at**
   (`fanSlots`, 2026-09-04). They ran in *declaration order* before, which is no order at all: two
   edges leaving one side took slots by chance, and whenever the one heading up drew the lower slot
   the pair crossed within a few pixels of the node and read as a single line · which is what
   "there's 2 routes but one gone missing" was, on Customer in saas-platform. A left or right side
   spreads vertically so its edges sort by the other end's `cy`; a top or bottom side spreads
   horizontally so they sort by `cx`. A fan then cannot cross itself at the node in **any** drawing:
   it is a rule about the geometry, not a constant fitted to one picture. Ties break on the id, so
   the order is stable across renders. A path runs through `[p0, ...waypoints, p3]` as a curve (cubic segments, end tangents
   along the side normals), straight polyline, or axis-aligned steps (`style.shape`); self-loops draw
   `loopPath`. Selected, an edge shows its waypoints (drag; double-click or Delete removes), a dashed "+"
   per segment (`geo.mids`) that adds one, a floating **styling toolbar** (`EdgeStylePicker`) and a
   double-click-to-edit label. Connections start from any of the four handles (`ConnectionMode.Loose`, ids
   `left/right/top/bottom`); each side's "+" pad (hover zone around the visible shape) spawns a connected
   service through the palette (`pendingConnection`); dropping a connection on empty canvas opens the same
   palette at the drop. **`kind` and `style` are separate.** `kind` is semantic (Connection section:
   request · event · data flow); `style` is visual (dash / arrow `none|end|start|both` / weight / shape);
   neither writes the other; absent style = the kind's default look (`dashOf`, `arrowModeOf`).
6. **Layers:** `request` · `events` · `data` · `security` · `cost` · `sections`. Default on: request, events,
   data, sections.
7. **Volume on edges.** Stroke width follows `volumePerMonth` on a log scale (1.2 → 3.5 px).
8. **Hover isolates, frames included.** A node's edges brighten, the rest dims to 16% · and a frame
    dims to 22% unless it **holds** something lit (2026-09-03, the user: "when I hover an object the
    containers/sections don't dim"). They were never part of it: the dimming is a CSS rule on
    `.react-flow__node` / `.react-flow__edge`, and a frame is painted through a `ViewportPortal`, so
    hovering one resource faded the whole drawing and left a VPC holding nothing relevant at full
    strength · which read as the answer. The lit set is computed once in `Canvas` and handed to the
    frames through `canvas/isolation.tsx` (`LitProvider` / `useLit` / `frameDim`) rather than
    recomputed, so the frames and the resources can never disagree. A frame around the lit resource
    keeps its opacity on purpose: it is how you see *where* the lit thing is. 22% rather than 16%
    because a frame is a thin outline, not a filled icon. It works on the graph **as drawn**:
   `hoverSeeds` turns a hovered collapsed-frame card into every member hidden inside it (so its edges
   light), and `litKeys` maps the lit model ids onto what is rendered (a hidden member → the card that
   stands in for it). Without that the card you were pointing at was the one thing that dimmed, and the
   frame around it looked active instead. The card's border goes to the accent on hover and while
   selected, which needs the frame colour to ride on the wrapper as `--frame-color`: an inline
   `border-color` beats every stylesheet rule.
9. **Trace, don't number.** `trace_request` (or the T tool + a click) lights the path from a node ·
    **one route at a time** (2026-09-03, the user: "I want it to go one by one per branch"). One walk
    (`engine/trace.ts` `traceFrom`, pure and tested) returns both the set reached and the **routes**:
    every origin→leaf path as an ordered list of edge ids, longest first. It replaced the same BFS
    written twice, in `Canvas.tsx` and in `tools.ts`, which is why the canvas and the agent could
    have disagreed.
    `TracePulse.tsx` runs a dot along one route at a time, and **the lighting follows it** · a
    26-resource trace lit all at once says "these are highlighted", walked route by route it says
    what happens. The dot reads its geometry off the *rendered* `<path>` by edge id
    (`getPointAtLength`), so it already has the waypoints, anchors and shape the user picked rather
    than a second copy of `edgeGeometry` to keep in step. `prefers-reduced-motion` turns it off.
    **How it plays is one setting with four values** · `tracePlay: "all" | "slow" | "medium" | "fast"`
    (`TRACE_SPEED`: 200 / 430 / 900 flow units a second). **`all` is the base**: the whole path lit at
    once, no pulse, which is what a trace did before there were routes and is still the right thing
    when you want the shape rather than the sequence. The pill shows all four as a segmented control
    with the route counter beside it · the first cut hid the toggle inside the counter's label, where
    the user could not find it and could not change the pace at all. Presentation state, never the
    model. `trace_request` takes the same `play` (validated against the same list, structured error
    with `allowed`) and returns the routes named · the only part of a trace an agent can read back,
    and the way it drives the animation for a demo.
10. **Settings never sit on the diagram.** The Inspector shows the schema form; the card shows the three that
    decide price.
11. **Findings are rings and stripes.** Icon mode: amber/red ring. Card mode: stripe on the left edge.
    The scenario's `.forked` ring goes on the **same element** (`.oh-icon-body`): it was on
    `.overhead-node`, the 200×100 hit-box, so in icon mode it drew a rectangle three times the width of
    a 56 px icon and two touched resources side by side produced overlapping boxes that read as a frame
    around both rather than as two marked nodes (2026-09-04).

### The spine: one schema per service

```ts
// src/engine/services/lambda.ts
export const lambda = defineService({
  id: 'lambda', term: 'AWS Lambda', icon: 'aws-lambda',
  role: 'handlers',                    // layout hint only
  settings: { architecture: { type: 'enum', values: ['arm64','x86_64'], default: 'arm64', label: 'Architecture', driver: true }, …,
              iamRole: { type: 'enum', values: ['least-privilege','broad'], default: 'least-privilege', label: 'Execution role', group: 'security' } },
  cardLines: ['architecture', 'memoryMb', 'avgDurationMs'],
  badge: (s) => 'IAM role' | 'IAM role · VPC' | …,   // the security badge, from the security settings
  price: (s, traffic, pricing) => CostLine[],   // from the price list, never literals
  cdk:   (s, { varName, resourceName }) => string,  // security settings become construct props or comments
  cfnTypes: ['AWS::Lambda::Function'],              // what this service is called in a template
  cfn:   (s, { logicalId, resourceName }) => CfnResource[],  // the template resources, incl. its execution role
  fromCfn: (properties, type) => Partial<Settings>, // and the way back · only what the template states
});
```

From this one definition derive: the Inspector form (Settings + Security), the card gear, the badge,
`set_property`'s validation, `list_services` (security settings flagged), the card's lines, pricing, CDK,
**and CloudFormation in both directions** (`defineService()` refuses a `cfn` without a `fromCfn`, so no
service can write a template it cannot read back). **One vocabulary for the human and the agent.** Security settings are never priced unless the SKU is
already in the price list (none are today).

## 7. Chrome — Instrument, docked

Direction is **Instrument** (dark, dense, pro-tool). The mock floats every panel; **the user overruled that**
("too many floating things") — panels are **docked** and reserve space. Only two small pills float.

```
grid-template-columns: auto(left dock)  minmax(420px, 1fr)(canvas)  auto(right dock)
grid-template-rows:    46px(top bar)  minmax(280px, 1fr)  36px(bottom bar)
```

The canvas track has a **hard floor**. Without it a small window resolved `1fr` to 0, React Flow measured a
zero box (its error #004) and the canvas went blank for good. Docks narrow first via `.oh-dock` media
queries; past that the shell overflows and the body clips. `.overhead-canvas` is `absolute; inset: 0` in
`.oh-main` — never percentage-sized. React Flow's attribution stays **visible** (no Pro plan): restyled to
the palette at bottom-centre, never `display: none`.

- **Toolbar** (`chrome/Toolbar.tsx`, a floating pill at the bottom-centre of the canvas; the user chose it
  over the left rail): select V · hand H │ add A · connect C · section S │ trace T · auto-layout L │ grid ⇧G ·
  undo ⌘Z · redo ⇧⌘Z │ View gear. Every button has a `data-tip` tooltip above it; no native `title` on
  chrome buttons. A opens the palette (services and containers together; B still opens it containers
  first); S arms the rectangle tool; C turns every node's visible shape into one handle (`AwsNode`
  `body`, `.oh-body-handle`) so a drag from anywhere on a node to anywhere on another connects them (no
  side recorded, the edge floats; a plain click still selects, nodes don't drag); T makes the next node
  click trace; K toggles card view (also in the View gear). Templates lives in the top bar. The "+" pads
  show on **node hover** (`.react-flow__node:hover .oh-side-pad`); the earlier hover zone was
  `pointer-events: none` and so never hovered, which is why they vanished.
  **Two stacking rules make connections possible at all** (2026-09-03, found by `elementFromPoint` on
  every handle): `.react-flow__handle` needs `z-index: 4`, because a node's artwork is an `inset-0`
  sibling painted after the handles and otherwise covers all four, so a press meant to start a
  connection started a node drag; and `.react-flow__viewport-portal` needs `z-index: 0` under
  `.react-flow__nodes` (`z-index: 1`), because the portal is the viewport's last child and a frame's
  header band otherwise swallowed the pads and handles of any node beneath it. Frames are the drawing's
  background, so painting them under the resources is also the right order.
  **A handle React Flow has not measured cannot start a connection**: the Connect tool's `body` handle
  appears only while the tool is armed, so `ModeInternals` calls `updateNodeInternals` on that flip as
  well as the card flip. Without it the handle rendered, took the pointerdown, and did nothing.
- **Top bar** (`chrome/TopBar.tsx`): brand · editable **drawing name** · price-list pill with the region
  select · monthly total (23 px mono — the one loud number) · Scenario · **Import** · Export.
  There is no Templates button: a template is an import too (our JSON instead of your YAML), so the
  four seeded architectures are a **source inside the Import dialog** and `Templates.tsx` is gone.
  Import opens `ImportPanel.tsx` (§12b); dropping a template on the canvas opens the same dialog.
- **Scenario** forks on the click (`openScenarioFromUi("what-if")`, so the tool count ticks) and **asks
  nothing**: a `window.prompt` was the one modal dialog left in the app and it blocked the page to
  collect a name that is editable anyway. The button is **hidden while a fork is open** (the banner owns
  it then, and a button that only explains itself is not a button). `ScenarioBanner.tsx` carries the
  dashed frame, the editable name, base → fork totals with the delta, Commit / Discard, **and the change
  list**: every `computeDelta` entry as `name · what changed · ±$`, or, when nothing has been touched
  yet, a line saying so and what to do (a fork that showed two identical totals and two buttons read as
  a no-op). `delta.ts` reports `kind` (added / removed / changed) and the `changes` that differ, so a
  rename or a setting that costs nothing is still listed; the touched resources take an accent ring on
  the canvas (`.forked`); commit and discard both `notify` what they did.
- **Left dock** (`chrome/Dock.tsx`, 248 px, collapsible to a spine): one panel, **Layers**
  (`chrome/LayersPanel.tsx`, rows from `src/engine/layers.ts`) — **one object tree**: containers by
  ownership, sections and groups nested *positionally* under every frame that holds one of their members
  (a spanning section appears under each, showing only the members held there; memberless ones sit at the
  top level), resources under their section or frame, and a trailing collapsible **Connections** group.
  Disclosure triangles fold the tree, not the canvas; the top level is an **accordion**: Connections
  starts folded. **Two groups, one open at a time, and each has a header you can click**: the stat
  line at the top (`8 resources · 4 frames`, a zero count omitted so it fits beside its chevron) is
  the objects' header, and Connections is the connections'. That symmetry is the whole accordion ·
  opening one folds the other, and nothing else in `folded` is touched. It took three goes to get there (2026-09-03), and the two wrong ones
  are worth keeping: folding only the *foldable* top-level rows was not an accordion at all on a
  drawing with no frames, because every resource is a leaf there · both lists showed at once, which
  is the thing the rule exists to prevent. Folding them all instead threw the tree away every time
  you glanced at the connections (fold Connections again on event-driven and all that was left was
  a shut "AWS Cloud"). The answer was neither: **hiding is a view**, and the missing piece was that
  the objects had no header to click, so the stat line looked exactly like one and did nothing. Click selects the object itself; hover reveals collapse-on-canvas and remove. **Rows
  drag, Figma-style**: the pointer's height over a row decides (`whereIn`) · the middle third **nests**
  it (a resource into a frame with `moveIntoContainer` or a section with `setSectionNodes`, a frame into
  a frame with `setContainerParent` where only a cycle is refused, a section under a section with
  `setSectionParent`), the top and bottom quarters draw an **insertion line** and drop it *beside* that
  row, adopting that row's own frame and section (`LayerRow.ctx`, from `engine/layers.ts`). That is how
  a row moves **out** of something: drop it beside a shallower row, or on the header line for the top
  level. Two resources beside each other also reorder (`placeNodeBeside`). No header buttons (the
  toolbar's A and S already add frames and sections). No tabs.
- **Palette** (`Palette.tsx`, floating above the toolbar, A or `/`): search, the sixteen AWS services and the six flow shapes in their own group (click adds —
  inside a selected region/cloud — or drag onto the canvas) and the container kinds, which create with the
  validator's verdict as tooltip, select the new frame and **pan to it when it lands off-screen** (a second
  AWS Cloud is placed clear of everything, to the right). With a `pendingConnection` it opens at that point
  as "Connect from …": the picked service lands beside the source, in its container, already connected.
- **Right dock** (300 px): the **Inspector** (`Inspector.tsx`) in named, independently collapsible sections
  (state remembered in `localStorage`): node → Position · Settings (schema, `group !== 'security'`) ·
  **Security** (schema, `group: 'security'`, drives the badge and CDK) · Cost · Findings ·
  **an empty section is not a section** (2026-09-03, the user: "why is it showing security settings
  costs?" on a decision diamond): each is shown only when it would hold something, so a flow shape
  gets Position and nothing else. The test is what the section would hold, not the family, so it is
  right for any service with nothing in one · and the header's `$/mo` needs a **priced** node
  (`cost.lines.length`), not a total of zero; container →
  Identity · Frame · Contents; section/group → Appearance · Members · Frame; edge → **Connection** (type
  chips = `kind`, volume, label) · **Styling** (`EdgeStylePicker`, anchor sides, bends).
  Three tabs: **Inspector**, **Code** and **Mermaid** (`CodePanel.tsx` / `MermaidPanel.tsx`, the dock
  widens to 360 px for either document view · §12c). Code first (2026-09-03, the user: "I want to be
  able to draw the diagram through code") · the whole drawing as JSON, **live both
  ways**. Typing redraws the canvas as soon as the text parses (300 ms debounce); invalid JSON is not an
  error state but a document half typed, so the canvas holds the last good version and the footer names
  the line. It is not a second writer: the document goes through **`applyPatch` against an empty
  drawing**, so a typed document is validated by the same code `patch_state` and `set_property` use, and
  what comes back is already migrated. Three rules keep a live editor from fighting its user · the store
  re-seeds the text only when the panel is not dirty and the box does not have focus; a write of our own
  is remembered (`ours`) so the round trip does not reformat what you are typing; and selecting on the
  canvas scrolls the document to that object. It shares the Import box's indentation
  (`textIndent.ts`), so Enter, Tab and Backspace behave the same in both.
  **The caret is part of the selection** (2026-09-03, "can it be responsive when I'm in a line?"): a
  gutter of line numbers, the caret's line lit, **the whole object it sits in banded**, "in <id>" in the
  footer, and that object **selected on the canvas** as the caret moves · so scrolling the document walks
  the drawing. **A connection counts as an object here**: edges carry ids too, so the caret lands in one,
  bands it and lights it on the canvas · the store keeps the two selections apart (`select` vs
  `selectEdge`), and the panel picks the right one instead of only knowing about resources. Which object a position is in comes from `canvas/codeRanges.ts` (`objectRanges` /
  `objectAt`, pure and tested), which reads the *text*, not a parse: the caret moves most while the
  document is mid-edit, exactly when there is nothing to parse. It is **one forward pass** with a stack of
  open braces · scanning backwards from an id cannot work, because going that way a `"` is as likely to
  close a string as to open one, so a brace inside a resource name ("worker {2}") closes the object early.
  A caret-driven selection is marked (`fromCaret`) so the scroll-to-selection does not then yank the
  document out from under the typing. Gutter, bands and textarea share one `LINE_H`/`PAD_Y` and the
  first two are translated by the textarea's own `scrollTop`, which is what keeps them aligned.
  **Escape blurs the box**: every letter in it must type a letter, so `Keyboard.tsx` skips form fields and
  the canvas hotkeys are off while it has focus · Escape is the way back to them.
- **Trace pill** (`TracePill.tsx`, top-centre): the trace tool had no feedback at all · armed, it says
  "click any resource"; traced, it names the origin, counts the resources on the path and prices them,
  with Clear and Trace another. One click traces and the tool disarms back to select. The traced edges
  animate (`.traced` in `globals.css`, `!important` because the stroke and dash are inline from the
  edge's kind and style), which is the "it runs" the mode always implied.
- **Notice chip** (`Notice.tsx`): one transient message over the canvas — a refused drop and its rule, a
  created frame, a re-parented node. No `window.alert`.
- **Bottom bar** (`chrome/BottomBar.tsx`): title-block facts (Drawing · Region · Containers · Resources ·
  Findings · Est. monthly) and the WebMCP readout — live count, last three calls (ring buffer in
  `toolRegistry.ts`'s execute wrapper), click for the tool list.
- **Floating:** toolbar (bottom-centre), zoom pill (bottom-right: −, %, +, Fit; click the % for 100%), the
  palette when open, the edge styling toolbar on a selected edge, one popover at a time, the notice chip
  while it shows. React Flow's attribution sits bottom-left.
- Canvas: radial stage lift; React Flow `<Background>` dots (26 px, `#2A3441`) that pan and zoom; ⇧G toggles.
- **Blank space inside a frame selects that frame, and clicking again walks outward** (2026-09-03,
  the user: "clicking on blank space inside a section/container doesn't select it? … shouldn't I be
  able to cycle through easily?"). `onPaneClick` used to clear the selection, so a frame could only
  be selected by its header band · and since the resize grip only appears once a frame is selected
  or its header hovered, an empty VPC was a box you could not get hold of. Now `framesAt`
  (`engine/frames.ts`, pure and tested) lists every container **and** section whose box holds the
  point, **innermost first**, where innermost is *smallest area* rather than tree depth: containers
  nest by ownership, sections do not nest at all, and area is the only thing the two share at a
  point on the canvas · it is also what the eye reads as "on top". Clicking the same spot (within
  8 px) walks one step out each time, and one past the outermost is **nothing selected**, so the
  cycle always offers a way out and the click after that is the innermost again. Clicking anywhere
  else starts a fresh stack. On event-driven: private-a → orders-vpc → ap-southeast-1 → AWS Cloud →
  nothing → private-a.
- **A marquee has an Inspector, and a drag is not a click** (2026-09-04, the user: "I can't select
  region when I am selecting multiple resources"). Two things, one symptom · you drag a selection
  rectangle and the panel still says "select something". The marquee always filled `selectedIds` and
  left `selectedId` null on purpose ("these nine" has no primary object), but the Inspector read the
  primary alone, so a multi-selection showed the empty state · the app telling you it had not heard
  you. `MultiInspector` names what is in it, sums the cost over the resources, lists them (click one
  to narrow to it) and offers the two things you do next, Group and Remove. ⌘A lands here too.
  The other half was mine, from the frame-click cycle above: **a marquee ends with a `click` on the
  pane**, so `onPaneClick` fired on release and selected whatever frame sat under the release point,
  throwing the selection away the instant you let go. A press is recorded on
  `onPointerDownCapture` and a click that travelled more than 4 px is ignored.
- Inline editing: double-click a node label, a frame name or an edge label on the canvas. **⌘A selects
  everything** (`selectAll`: resources, containers and sections · `selectedId` goes to null because
  "everything" has no primary object) and **Delete removes the whole selection** in one undo step
  (`removeSelection` → `engine/remove.ts` `removeObjects`, pure and tested): the selected waypoint first,
  else `selectedIds` ∪ `selectedId` ∪ the selected edge. It read `selectedId` **alone** until 2026-09-03,
  so a marquee over five nodes deleted one of them and ⌘A was not bound at all (the browser selected the
  page's text instead). Deleting a frame still keeps what was inside it: contents re-parent to the nearest
  surviving ancestor, and a section keeps the members it still has. Frames and frame cards read
  `selectedIds` as well as `selectedId`, or ⌘A left every frame looking untouched. ⌘G groups the
  selection, ⇧⌘G ungroups. Escape backs out (label edit → pending connection → export → templates → palette → selection/
  trace → select tool).
- `HowTo` banner is dismissible; `BillDrop` accepts a CSV anywhere on the canvas.

**Cursors say what a press will do** (`globals.css`): arrow at rest on the canvas, crosshair while a
marquee is dragged (`.marquee`) or the Section tool is armed (`.drawing`), grab / grabbing on anything that
moves, crosshair on connection handles and while connecting. `nodeDragThreshold={4}` keeps a quick click a
select and a held drag a move; ⇧/⌘-click adds to the selection, marquee selects many.

**Gears open one anchored popover** (`Popovers.tsx`, `store.popover`): the **View** gear on the toolbar
(Layers: sections / security badges / cost figures / request-events-data edges / grid · Cards: card view
and what every card shows, `cardShow` · Cost: period, decimals, where it shows, `costDisplay`); the card
gear on a node (Security settings + this card's lines, cost, badge → `node.card`). **Frames have no
gear** and `popover.kind` is only `card | canvas`: a frame's name, CIDR, appearance and collapse live in
the Inspector, which selecting it already opens. **A popover is anchored by transform, never by the host's
size**: `top` is the anchor point and the panel grows up from it (the View gear) or down from it (a card
gear), then one `useLayoutEffect` measures it and nudges it back inside the canvas, against its
un-nudged rectangle so re-opening never compounds. Reading `ref.current.parentElement` during the first
render (when the ref is still null) fell back to a guessed 800px height and opened View far above the
toolbar. The UI slice (`cardShow`,
`costDisplay`) autosaves under `ui`. **Tooltip CSS lives in `@layer components`** so Tailwind's `absolute`
still wins on the element.

**A flowchart is shown no money** (2026-09-03, the user: "if it's a flowchart I think cost doesn't
need to be there"). `pricedOf(s)` in the store is false when the drawing has resources and **none**
of them is an AWS service, and it hides the top bar's price-list pill and monthly total and the
bottom bar's Region, Findings and Est. monthly · three pieces of chrome about money on a drawing
that has none, and a findings count no rule can ever move. An **empty** canvas still counts as
priced: that is where an AWS drawing starts, and hiding the price list before the first node would
read as a missing feature rather than an honest zero.

**Tokens** (`src/app/globals.css`; legacy aliases `--ground/--surface/--rule/--saving/--finding/--critical`
still resolve pending cleanup):

| Token | Value | Used for |
|---|---|---|
| `--bg` | `#0B0D10` | page ground; canvas radial lift to `#141922` |
| `--panel` / `--panel-2` | `#111620` / `#0D121A` | docks, bars / inputs, recessed fields |
| `--line` / `--line-2` | `#1D2531` / `#222A36` | borders / control borders |
| `--ink` / `--ink-15` / `--ink-2` / `--ink-3` / `--ink-4` | `#E8ECF2` / `#C7D0DC` / `#9AA6B7` / `#66738A` / `#4E5A6B` | text ramp |
| `--accent` / `--accent-ink` / `--accent-bg` | `#3B82F6` / `#8FB8FF` / `#1B2534` | selection, active states |
| `--good` / `--warn` / `--bad` | `#6FE3B0` / `#F0B34E` / `#F0796A` | savings & live pulse / warn ring / critical |
| `--edge` / `--edge-lab` | `#5C6B7F` / `#7C8CA0` | edge stroke / labels |
| `--glass`, `--hover`, `--hover-2` | `#111620F2`, `#161C27`, `#1A212C` | floating pills, hover fills |

Type: **Archivo** 400–700 (`--font-archivo`) for UI, **JetBrains Mono** 400–600 (`--font-mono-jb`) for every
number, code and log line. Uppercase only for 9.5 px labels at `.14em` tracking. Dark only.

## 7b. Live rooms (`src/net/`, `multiplayer` branch)

**Press Live and the URL is the invite** · Kahoot-shaped: a room id anyone can hold and nobody can
guess, in the address bar. `LivePill.tsx` in the top bar starts one, copies the link, shows who is
here, and leaves. A `?room=` in the URL joins on load. Off is the default and off means *nothing*:
no socket, no server contacted, the app is the page it always was.

- **The wire carries patches, not drawings** (`net/protocol.ts`, `engine/patch.ts` `diffSnapshots`).
  A human dragging a node and an agent calling `patch_state` put the identical shape on the wire: a
  partial document **by id**. Ids were picked over array indices for the agent, months before there
  was a room; it is also exactly what makes two people editing at once merge. Disjoint edits commute;
  the same field twice in the same instant is last-writer-wins, and a CRDT is the only thing that
  would do better (named as next, not implied as done).
- **Everything inbound is validated by `applyPatch`**, the same door `patch_state` uses · a peer on
  an old build cannot put a setting on your canvas that your build refuses.
- **Two guards keep the loop from feeding itself** (`net/room.ts`): `applying` (a remote patch being
  written must not be read back out and rebroadcast · without it two browsers ping-pong forever) and
  `mirror` (what the other side is believed to have, advanced on both send and receive, so the next
  diff is against shared truth rather than my own last frame).
- **Cursors and presence** · `{t:"cursor"}` in **canvas coordinates**, throttled to ~55 ms, drawn in
  a `ViewportPortal` (`PeerCursors.tsx`) so a cursor sits on the same resource at any zoom. Colour is
  derived from the peer id, so everyone sees the same colours. Cursors live on the room slice, never
  in the model: not undoable, not exported, not saved.
- **The relay is shared, not duplicated** (`net/relay.ts`): pure bookkeeping (rooms, presence,
  fan-out, caps) driven by both `app/api/room/route.ts` (Vercel) and `scripts/dev-room.ts` (local
  `ws`), because **`next dev` cannot serve a WebSocket upgrade** · it is a platform feature. Local:
  `npm run dev:room` then `NEXT_PUBLIC_ROOM_WS=ws://localhost:3001 npm run dev`. Gotcha: the dev
  relay does not hot-reload · restart it after changing the protocol, or you will debug a stale
  server (this cost half an hour: cursors were sent and never forwarded).
- **A room has one drawing, and the room's is the one** (fixed 2026-09-03, found by the user running
  two browsers with different drawings): a joiner **adopts** what is already there rather than
  merging. The first version left `mirror` pointing at the joiner's own canvas, so their next edit
  diffed against *their* drawing and was applied to everybody else's · event-driven and
  media-pipeline fused into one nine-resource chimera on both screens. There is no sensible union of
  two architectures, and it only showed when the two drawings differed, which is why it looked fine
  the first time it was tried. `awaiting` holds the joiner between `need` and `state`: no mirror, so
  nothing of theirs is broadcast in the meantime, and they are told their drawing was set aside
  rather than losing it silently.
- **A room is somebody's sitting.** The first one in is the **host** (`host: true` on their peer, and
  "hosting" in the pill); when they leave, everyone is told `closed` and the room ends. The id is
  **spent** after that, so a straggler reconnecting is told it is closed instead of quietly becoming
  the host of an empty room · spent ids are pruned after `ROOM_TTL_MS`. A guest leaving is just a
  `left`. Everyone keeps the drawing they were looking at; leaving takes nothing away.
- **Caps**: 8 people, 64 KB a message, names trimmed to 24, room ids `^[a-z0-9]{6,24}$`, and a room
  **expires after 8 hours** and vanishes when the last person leaves (`ROOM_TTL_MS`, injectable clock
  so it is tested without waiting). Nothing is stored, so there is nothing to expire in storage.
- **Two platform limits, named on purpose**: a connection is pinned to one function instance and two
  people are not guaranteed to share one (Fluid compute usually keeps a small room together; the fix
  is Redis pub/sub, a service and a bill), and a function's max duration cuts long sessions · the
  client reconnects with backoff and re-asks for the drawing, which is the same path a newcomer
  takes, so it is exercised on every join.

## 8. Data model (`src/engine/model.ts`)

```ts
Node      { id, service, name, settings, container?, position, card?: { lines?, cost?, badge? } }
Edge      { id, from, to, kind: 'sync'|'async'|'data' /* semantic */, volumePerMonth?, label?,
            style?: { width?, dash?, arrow?: 'none'|'end'|'start'|'both', shape?: 'curve'|'straight'|'step' } /* visual, absent = by kind */,
            waypoints?: {x,y}[], anchors?: { from?: Side, to?: Side } }
Container { id, kind, name, cidr?, parent?, collapsed, bounds? }      // structural — validated, priced
Section   { id, name, color, kind?: 'section'|'group', parentId?, bounds?, nodeIds[], collapsed, style? }  // yours — never validated
Traffic   { requestsPerMonth, avgPayloadKb }
StateSnapshot { nodes, edges, containers, sections, traffic }
Scenario  { name, base: StateSnapshot }                               // the live state IS the fork
Finding   { rule, severity, message, docUrl, nodeIds, estimatedSaving? }  // derived
Cost      { nodeId, lines: [{ sku, unit, qty, rate, monthly, sourceUrl }], monthly }  // derived
```

Store (`src/store/useStore.ts`, zustand) also holds UI state: layers, tool, docks, `palette`, `templatesOpen`,
`notice`, `drawingName`, `gridOn`, `cardsForced`, `cardShow`, `costDisplay`, `popover`, zoom, selection
(`selectedId` — a node, a container **or a section** id — / `selectedEdgeId`, mutually exclusive;
`selectedIds` for the multi-selection; `selectedWaypoint`; `labelEditingEdgeId`), `draggingId`, `frameDrag`
(`{ kind: 'container'|'section', id, dx, dy }`), `connecting`, `pendingConnection`, trace, scenario, export
panel, bill, `webmcpOutcome`. Frame moves go through `engine/frames.ts` `translateFrame` (`moveContainer`,
`moveSection`); bounds through `setContainerBounds` / `setSectionBounds` (both floored at content). Edge
actions keep semantics and style apart: `setEdge` (kind/label/volume) vs `setEdgeStyle` / `setEdgeAnchors`
/ `setWaypoints` / `removeWaypoint`. Sections: `setSectionColor`, `setSectionStyle`, `setSectionParent`,
`addGroup`, `ungroup`. `snapshotOf(s)` feeds autosave, undo (`store/history.ts`), and scenarios. Migration
(`migrateEdge`) turns the old single `route` into `waypoints` and boolean `arrow` into a mode. **Selectors must return stable values** — derive objects in `useMemo`, not in `useStore(fn)`
(returning a fresh object per call is a React #185 render loop; it bit us once).

## 9. Tool surface (39 live · 43 in a scenario)

Read tools: `readOnlyHint`. Mutations update the store before returning. `text()` caps output at 1.5K.

| Tool | Kind | Notes |
|---|---|---|
| `get_architecture` | read | nodes (id, service, name, container, monthly), edges, containers, sections, traffic, total |
| `get_node` | read | settings, cost lines, `placement` breadcrumb, findings (≤2) |
| `get_cost_breakdown` | read | by node or service |
| `get_findings` | read | severity filter, first 5 |
| `list_services` | read | one line per AWS service (`id · term · price drivers`) plus the flow shape ids; or one service's full schema. **Was over budget**: the old object-per-service shape was 1713 chars against `text()`'s 1500 cap, so the tool every agent calls first returned `output_too_large` instead of the vocabulary. A test holds the new shape under the cap |
| `get_pricing_source` | read | region, fetch date, files |
| `add_service` | write | type, name, settings?, container? (validated) |
| `connect` | write | from, to, kind, volumePerMonth? |
| `set_property` | write | structured error on invalid value |
| `rename_node` | write | |
| `set_traffic` / `remove_node` / `apply_pattern` / `set_layer` / `trace_request` | write | `set_layer` includes `sections` |
| `auto_layout` | write | arranges by role, emits `auto-*` sections |
| `add_container` | write | kind, name, cidr?, parent? → id; any nesting allowed, `no_such_container` only |
| `move_into_container` | write | nodeIds, containerId\|null → breadcrumb; any service in any frame |
| `collapse_container` / `expand_container` | write | resources + monthly |
| `get_containers` | read | flat list with `parent` pointers + `typicalParents` hint |
| `add_section` / `rename_section` / `set_section_nodes` / `remove_section` | write | no validation |
| `get_sections` | read | includes `kind` (section / group) |
| `open_scenario` | **dynamic** | forks; registers the four below under one `AbortController` |
| `scenario_apply` / `get_delta` / `commit_scenario` / `discard_scenario` | dynamic | abort on commit/discard |
| `get_bill_summary` | read, untrusted | |
| `reconstruct_from_bill` | write | |
| `export` / `get_export_chunk` | read | json / markdown / mermaid / cdk / svg; ~1.2K chunks |
| `get_state` | read | the drawing as the editable JSON document the Code panel shows · `ids` for just those objects, else the whole document, else a chunk pointer when it is too big for one message |
| `patch_state` | write | **spot editing by id** · partial objects merge in (settings one level deep), an unknown id creates, `remove` deletes, all-or-nothing. `engine/patch.ts`, the same validator the Code panel and `set_property` use. Structured errors carry `at` (`nodes[fn].settings.architecture`) and `allowed` |
| `share_link` | read | a URL that opens this drawing on the page · the document rides in the fragment (`iac/share.ts`), nothing is uploaded, no backend involved. Too long to send = say so and point at `export` json |
| `import_state` | write | the same reader the Import dialog uses (`importOverheadState`) · positions kept, never re-laid-out |
| `import_mermaid` | write | a flowchart becomes the drawing, priced (§12c). `mode` replace or merge, through the same `reconcile` the template import uses. The door an agent hands a diagram through · a flowchart is what every model already writes when asked to draw an architecture |
| `diff_cloudformation` | read | what a template would add, drop and change · nothing is applied |
| `import_cloudformation` | write | YAML or JSON → the drawing, priced. `mode` replace or merge (§12b) |
| `overhead_ping` | read | the raw brief-shape registration |

Not built: `collapse_fanout` / `expand_fanout`, `refresh_pricing`, `rename_container`, `remove_container`,
`set_edge` (the store actions exist for the last three; the UI uses them).

Files: `src/webmcp/register.ts` (raw call + `registerAllTools` + `open_scenario`), `tools.ts` (core specs),
`scenario.ts` (dynamic four, `openScenarioFromUi`, `closeScenarioFromUi`), `toolRegistry.ts` (`registerSpec`,
live list, call log, `text()`/`errorResult()`), `provider.tsx`.

## 10. Findings — every rule cites its doc (`src/engine/rules/`)

| Rule | Fires when | Cites |
|---|---|---|
| `rest_where_http_would_do` | REST API with no REST-only feature | https://aws.amazon.com/api-gateway/pricing/ |
| `standard_workflow_high_volume` | Standard > 100k executions/month, no human wait, Express cheaper | https://aws.amazon.com/step-functions/pricing/ |
| `x86_lambda` | any Lambda not on arm64 | https://aws.amazon.com/lambda/pricing/ |
| `memory_duration_tradeoff` | < 1024 MB with > 500 ms (info) | https://docs.aws.amazon.com/lambda/latest/operatorguide/computing-power.html |
| `on_demand_steady_state` | on-demand past the provisioned crossover | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/capacity-mode.html |
| `no_lifecycle_on_logs` | logs/backup bucket, no lifecycle | https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html |
| `s3_public_no_cdn` | public bucket, no CloudFront upstream | https://docs.aws.amazon.com/AmazonS3/latest/userguide/website-hosting-cloudfront-walkthrough.html |
| `async_no_dlq` | async consumer, no DLQ (critical) | https://docs.aws.amazon.com/lambda/latest/dg/invocation-async.html |
| `unbounded_fanout` | SNS → 2+ Lambdas, no reserved concurrency | https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/welcome.html |

Savings come from the same pricing table. One vitest per rule.

## 11. Pricing — from AWS, not from us

`npm run fetch-pricing` (`scripts/fetch-pricing.ts`) pulls the AWS Price List Bulk API (public JSON, no auth)
for the sixteen services, filters to the 40 SKUs the engine prices, and writes `data/pricing.<region>.json` with
`generatedAt` and a `sourceUrl` per entry. Gotchas learned: CloudFront CDN rates live only in the **global**
file (per-geography, `fromLocation`); EventBridge's offer code is `AWSEvents`; Step Functions Express usagetypes
are `StepFunctions-Request` / `StepFunctions-GB-Second`. Ship `ap-southeast-1` (default) and `us-east-1`;
region is a select in the top bar. More gotchas from the second batch of services: the KMS offer code is
lower-case `awskms` and its usagetypes carry the **full** region name (`ap-southeast-1-KMS-Keys`), which
`norm()` does not strip; Secrets Manager writes `…-Secret` in one region and `…-Secrets` in another;
Parameter Store lives inside `AWSSystemsManager` under the `PS-` prefix; CloudWatch Logs shares
`AmazonCloudWatch` with a hundred other line items, so ingest is matched on `operation: PutLogEvents` and
storage on `productFamily: Storage Snapshot`. `refresh_pricing` was not built.

## 12. Exports (`src/engine/exporters/`)

| Format | Contents |
|---|---|
| JSON | whole model incl. containers + sections + pricing snapshot id; reloads via `import_state` |
| Markdown | title = drawing name, assumptions, cost table, findings with links, Mermaid inline |
| Mermaid | `flowchart LR`, labels carry monthly cost, **containers become nested subgraphs**, and a trailing `%% overhead: {…}` comment carries what Mermaid has no syntax for (each node's service, each subgraph's kind, the sections). Same "state in a comment" carrier the CDK export uses, so the file is still a plain flowchart in anybody's renderer · and it is what makes §12c exact. **Every AWS service draws as its own icon**, through Mermaid's image node (`id@{ img: "https://…/Arch_AWS-Lambda_64.svg", label: "worker · $1.53/mo", pos: "t", w: 56, h: 56, constraint: "on" }`) · the reason to hand somebody a Mermaid document is that they read it somewhere else, and everywhere else the icons are the difference between an architecture and four grey boxes. `constraint: "on"` is load-bearing: without it the image stretches to whatever width the label needs and a Lambda comes out four times as wide as it is tall. The URLs point at the deployed app (`services/iconFiles.ts` · `ICON_BASE`), because a document exported from localhost would carry links nobody else can resolve, and the file name names the service on the way back in. A **flow shape stays a bracket** (`{}` a diamond, `[( )]` a cylinder): those shapes are what a flowchart is and every renderer already draws them. Needs Mermaid 11.3 or later; older renderers draw a plain node, which is what they drew before. `exportMermaid(snap, pricing, { cost, meta, icons, iconBase, direction })` · the Mermaid tab passes `cost: false, icons: false`, because a derived figure in an editable box reads as an input and an editor of 90-character URLs is not one you can type in |
| PNG / SVG / PDF | `canvas/exportImage.ts` · the **whole drawing**, not the current viewport: the union of every node and every stored frame rectangle becomes the picture, and `getViewportForBounds` gives the viewport element a fitting transform for the duration of the `html-to-image` capture. PNG at 1×/2×/3× with an optional transparent ground; SVG vector; **PDF is built here** (`jpegToPdf`: a JPEG wrapped in a one-page PDF · catalog, page tree, DCTDecode XObject, content stream, hand-counted xref) so there is no print dialog and no new dependency. **The sprite has to ride along**: every icon is a `<use href="#aws-…">` into the sprite injected at the app root, and `html-to-image` serialises only the captured element into an isolated document where those ids resolve to nothing · pictures came out as labels with no icons until `captureDrawing` began appending a clone of `[data-oh-sprite]` inside the captured subtree for the length of the capture. **The same problem one layer down**: an edge's colour comes from a stylesheet rule (`.react-flow__edge-path { stroke: var(--edge) }`) and a rule is not part of the element, so every line exported with **no stroke at all** · the arrowheads still drew (a marker is painted whatever the stroke is), which is why the picture read as labels and arrowheads floating in space. Width, dash and linecap were already inline on the path (`TypedEdge`) and survived; the colour is the one thing that only ever lived in CSS. `captureDrawing` freezes the computed stroke onto each path for the length of the capture and puts it back after, so the token stays in CSS where the theme lives and the picture still carries a paint · and a traced or selected edge exports in the colour you are looking at |
| CDK (TypeScript) | one stack named from the drawing, one construct per node from `defineService().cdk`, header listing every stub. **It carries the drawing** in a trailing comment block (`exporters/overheadState.ts` · `overheadStateBlock` is shared with the CloudFormation exporter so the two cannot drift, and `cdkStateComment`/`cdkStateFrom` are the comment carrier), which is what makes CDK import-able back · comments only, so `cdk synth` is unaffected. Variable names never shadow an imported namespace (a node called `logs` or `secretsmanager` used to emit a stack that failed at "cannot access before initialization" · `varNames()` in `cdk.ts` resolves it), and **`npm run synth` runs `cdk synth` on the three samples plus an `all-services` fixture holding one node of every service** |
| CloudFormation (YAML) | deployable template from `defineService().cfn`, so it cannot drift from the CDK. A `Metadata.Overhead` block carries what a template has no place for (positions, containers, sections, traffic, the settings that only drive price) and each resource carries its `nodeId`, which is what makes the round-trip exact. YAML is written by `iac/yaml.ts` (no dependency); §12b is the way back |

Three routes: download (filename = drawing name), clipboard, and `export` + `get_export_chunk`. Autosave to
`localStorage` (`overhead-state-v2`). The UI surface is `ExportPanel.tsx`, a **centred dialog** (rendered
from `App`, not inside the right dock, where it did nothing while that dock was collapsed): a named list
grouped **Picture / Document / Build / Project**, one line each saying what the file is for, the artefact
itself previewed beside it, then Download and Copy. JSON sits under **Project**, not Build: it is the
drawing, not a build artefact. `export`/`get_export_chunk` stay text-only · a picture is not a tool output.

### 12b. Import and reconciliation (`src/engine/iac/`)

CloudFormation was the first format to go both ways, and it was chosen because it is the interchange
format: CDK and SAM both synthesise to it, so reading it works for all three without parsing anybody's
TypeScript. **CDK goes both ways too, but only ours** (2026-09-03, "why can we export a CDK and not import
one?"): a generated stack carries the drawing in a comment block, so `importCdkStack` reads it back through
the *same* `fromOverheadBlock` a template goes through, positions and all. Nobody else's stack can be read
and that is not a gap to close · CDK is a program with loops and lookups and it does not say what it builds
until it is run, so the honest answer is the command that runs it. `looksLikeCdk` recognises the source,
and a stack with no block falls back to the `// ── <Service term>: <name>` label above each construct
(`fromCdkMarkers`), which is how a stack exported before the block existed still comes back · services and
names only, and the notes say so. Everything else gets code `cdk_source` and `cdk synth > template.yaml`
rather than "that is not valid JSON". Three formats now, so `detectFormat` returns `cdk` too, and **the
Import dialog re-lays-out on replace only when the document brought no geometry** (`report.source !==
"overhead"`, not the format · our template and our stack both bring positions).

- `yaml.ts` · a YAML writer and reader for the subset a template uses, short-form intrinsics included
  (`!Ref`, `!GetAtt a.b`, `!Sub`). No dependency. Round-trip tested against our own output.
- `cloudformation.ts` · `importCloudFormation(text, { region })` reads YAML **or** JSON and takes one of two
  paths. **Ours**: the `Metadata.Overhead` block rebuilds the snapshot exactly, through `migrateSnapshot`.
  **Anyone else's**: resources match services by `cfnTypes`, `Properties` become settings through
  `fromCfn()`, `AWS::EC2::VPC` / `::Subnet` become containers (a function's `VpcConfig.SubnetIds` puts it in
  one), and edges are inferred from what references what · `referencedIds` walks `Ref` / `Fn::GetAtt` /
  `Fn::Sub`, and `CONNECTORS` turns the resources that *are* a connection (`EventSourceMapping`,
  `SNS::Subscription`, `Events::Rule`, an API integration, `Lambda::Permission`) into the edge they mean.
  It also returns **`stated`**: which settings the template actually said, per node.
- `reconcile.ts` · `reconcile(current, incoming, stated)` names every difference (added / removed / changed,
  with the settings that changed and the connections added or dropped); `applyReconciliation(…, mode)`
  applies it. **`replace`** takes the template. **`merge`** takes it only where it speaks: resources the
  template lacks stay, positions and sections stay, and settings outside `stated` are never reset · a
  template says a Lambda is 512 MB and says nothing about how often it runs, and resetting that would
  quietly rewrite the estimate. `placeNewNodes` gives merged-in resources a column to the right.
- UI: `ImportPanel.tsx`, built as **the mirror of `ExportPanel.tsx`** · the same dialog, the same named
  list down the left (Samples · Diagram · Build · Project) with a line each, the same view of the artefact in the
  middle, the same action bar. Three differences, each earned: the middle box is **editable** and
  **indents itself** (`canvas/textIndent.ts` · Enter carries the line's indent and opens a level after a
  YAML key, a list dash or an open bracket; Tab / ⇧Tab is one level in or out over every line the selection
  touches, not the next control; Backspace inside the indent goes back a level · pure functions over
  `(value, selection)`, tested in `tests/text-indent.test.ts`, caret restored after the controlled write),
  because a
  document does not have to be a file to be worth reading (paste from a terminal, drop a file anywhere in
  the pane, type it, pick a file, or pick a sample · every path ends at the same text); a side pane says
  what it would do to this drawing **before** anything happens; and the two buttons are Replace and Merge.
  The **seeded architectures are sources in that list**, not a dialog of their own. What a document *is*
  comes from its content, not its extension (`detectFormat` · both formats are commonly `.json`), and the
  lit entry follows; picking an entry yourself pins it, so a mismatch is reported rather than guessed,
  while typing over a sample releases the pin. Dropping a file on the canvas opens the same dialog
  (`BillDrop` routes by extension · a `.csv` is still the bill).
- **A drawing in a link** (`engine/iac/share.ts`, 2026-09-03 · the user asking whether "visualise my
  architecture" was buildable): `https://…/#doc=<base64url of the document>` or
  `#template=<https url>` opens the app with that document **loaded into the Import dialog**, never
  applied silently · a link from somebody else is exactly what the diff-before-anything rule is for.
  `LinkImport` in `App.tsx` reads it once and clears the fragment so a refresh does not re-open it;
  a `template` link is fetched in the browser (https only, ≤512 KB, `javascript:`/`file:`/http
  refused in `parseImportLink`). The **fragment**, not the query string, so the architecture never
  reaches a server log · the query string is read only as a fallback for tools that eat fragments.
  Two encodings, and the reason for each: **`#doc=` is plain base64url of UTF-8** so *any* agent can
  build a link in one line of any language without matching our compressor, and **`#p=` is
  deflate-raw + base64url** (`pack`/`unpack`, `CompressionStream`, falls back to the plain link where
  the platform lacks it) because a real drawing is a **5,407-character link plain and 1,113 packed**,
  which is the difference between pasting it in a chat and having it mangled. `share_link` emits the
  packed one; `readImportLink` reads either. Gotcha: the query-string fallback tests *every* shape ·
  a fragment carrying only `p` fell through to an empty query string and read as "no link". A failed
  inflate rejects on **both** sides of the stream, so the write side is caught explicitly or a
  corrupt link surfaces as an unhandled rejection. This is what stands in for "visualise my
  architecture" today, and it needs no backend.
- **Why there is still no backend** (2026-09-03, the user asking about Vercel Blob with a one-day
  lifecycle): Blob has **no object expiry** · a daily cron would have to list and delete. Client
  uploads need a route (`handleUpload`), which means dropping `output: "export"`, and Vercel's own
  docs say the plain version is "open to the public" without auth in `onBeforeGenerateToken`. The
  money is not the danger (uploads are $5/M, reads $0.40/M, transfer $0.05/GB · $100 is ~20M uploads
  or 2 TB); the danger is an unauthenticated write endpoint on a public domain and the loss of a
  claim judges can verify. Compression got the link to 1 KB, which is what the storage was for.
- Not built, and named as not built in `SCRIPT.md`: a live sync. Nothing watches a repo and nothing writes
  to one.

### 12c. Mermaid, both ways (`src/engine/iac/mermaid.ts` · `src/canvas/MermaidPanel.tsx`)

The fourth format, and the only one that starts life as somebody else's picture. Two documents arrive
and both have to work.

- **Ours** comes back exactly, through the `%% overhead:` comment (§12). Round-tripped in
  `tests/mermaid.test.ts`.
- **Anybody's** is read for what it says. `parseMermaid` handles `flowchart`/`graph` in any
  direction, every bracket shape, chains (`a --> b -.-> c`), inline labels (`a -- writes --> b`),
  `A-->B` with no spaces, and subgraphs at any depth; `classDef` / `class` / `style` / `click` are
  skipped. Then: a label matched against the service vocabulary becomes that service, **priced**
  (`[Lambda worker]`, `[SQS queue]`, `[(DynamoDB orders)]`); a label that names none keeps its
  **shape** (`{}` a decision, `[( )]` a store, `(( ))` an actor, `[[ ]]` an external system, `([ ])`
  a start/end, anything else a step · §5c); a subgraph whose title names a container kind ("Orders
  VPC", "ap-southeast-1", "AWS Cloud") becomes that container and **any other subgraph becomes a
  section**, which is exactly what a section is for and what is never validated. **This is the
  point**: a diagram somebody drew as a picture arrives as a design and starts carrying a number.
- Mermaid holds **no positions**, so `report.source` is always `"foreign"` and an import is laid
  out on arrival · the Import dialog already reads that field to decide.
- **The icon travels as a URL, and names its service on the way back.**
  `services/iconFiles.ts` maps each AWS service to its `Arch_*_64.svg` in `public/icons/aws/`
  (CloudWatch and KMS were added from the AWS icon package for this · the other fourteen were
  already there). `iconUrl()` writes it, `serviceFromIconUrl()` reads it, and `defineService`'s
  sprite symbol id is untouched · that id only means anything inside a page that injected our
  sprite, which a Mermaid document by definition is not. The importer reads `@{ … }` as the flat
  key/value list it is (`readMeta`), so a document whose `%% overhead:` line has been deleted still
  comes back with its Lambdas as Lambdas.
- **The Mermaid tab is a third writer on one document.** It obeys the Code tab's two rules (nothing
  writes over you mid-edit; a write of our own is remembered so the round trip does not reformat
  what you are typing) and adds a third, because Mermaid is **lossy**: it has no syntax for a
  position, a memory size, a traffic figure or an edge's volume. So the panel never rebuilds ·
  `applyMermaid` merges the parsed document into the live one **by id**, the way `patch_state`
  does, and everything the text did not mention is left alone. Drag a node, then type here: the
  drag survives. Edges keep their identity by endpoint (a Mermaid edge has no id), which is what
  preserves a waypoint and a volume through an edit. **A service is only changed where the document
  actually named one** (`statedServices` on the import result) · otherwise "worker" would be
  demoted from a Lambda to a plain box on the first keystroke, because the label names no service
  and the shape would answer for it.
- The caret's **line** is the object here (Mermaid has no nesting to walk): it bands, it is named in
  the footer, and it selects that resource on the canvas · and selecting on the canvas scrolls the
  document to its line. The same loop the Code tab has, one line deep instead of one object deep.
- **Code and Mermaid are one editor** (`canvas/LiveEditor.tsx`): gutter, caret band, the shared
  indent behaviour (`textIndent.ts`), the caret restore after a controlled write, and Escape as the
  way back to the canvas hotkeys. Only what a document *means* lives in the panel that uses it.

## 13. Stack, repo layout, commands

Next.js 15 (App Router, `output: "export"`), React 19, TypeScript, `@xyflow/react` v12, Zustand, Tailwind 4,
papaparse, html-to-image, vitest, puppeteer-core (dev, headless checks). Vercel.

```
src/
  engine/           pure TS: model, containers, frames(boxes/hit-test/translate), migrate, layout(roles),
                    pricing, cost, findings, delta, bill, services/*.ts (defineService), rules/*.ts,
                    exporters/{json,markdown,mermaid,cdk,cloudformation,index}.ts
  engine/services/flow.ts  step · decision · terminal · actor · store · external (§5c, unpriced)
  engine/iac/       share.ts (a drawing in a link · #doc / #template, no backend) ·
                    mermaid.ts (a flowchart in, ours exactly and anyone's for what it says, +
                    applyMermaid for the live tab) ·
                    yaml.ts (writer + reader, short-form intrinsics) · cloudformation.ts (import, ours and
                    foreign) · import.ts (detectFormat + the Overhead JSON reader, shared by the dialog
                    and import_state) · reconcile.ts (diff + replace/merge · what stands in for a sync)
  webmcp/           register.ts · tools.ts · scenario.ts · toolRegistry.ts · provider.tsx
  store/            useStore.ts · history.ts (undo/redo)
  engine/layers.ts  layerRows() — the Layers tree as rows (positional nesting of sections/groups)
  engine/remove.ts   removeObjects · deleting a mixed selection (Delete), pure and one step
  engine/patch.ts    applyPatch · a partial document merged in by id (the Code panel, patch_state)
  engine/frames.ts  container + section geometry, hit-test, translateFrame / movedNodeIds / movedSectionIds
  canvas/           App.tsx (shell) · Canvas.tsx (sides + fans, multi-select, section drawing, drag → drop
                    re-parent, connect start/end) · AwsNode (4 handles, + pads, body handle, gear, badge) ·
                    FrameCard (any collapsed frame) ·
                    ContainerFrames · SectionFrames · frames/FrameChrome + frames/useFrameGesture (shared) ·
                    TypedEdge (waypoints, + mids, styling toolbar, label edit) · EdgeStylePicker ·
                    edgeGeometry.ts · edgeStyle.ts · nodeMetrics.ts · Inspector (node/container/section/edge)
                    · Popovers (view + card gears only) · Palette (floating, connect-from) ·
                    Notice · TracePill · CodePanel (the drawing as live JSON) + codeRanges.ts ·
                    MermaidPanel (the drawing as a live flowchart) · LiveEditor (the editor both
                    document tabs are made of) ·
                    fitDrawing.ts (fit the drawing, frames included) ·
                    ExportPanel (dialog) + exportImage.ts
                    (PNG/SVG/PDF of the whole drawing) · ImportPanel (its mirror: samples, formats,
                    an editable document box, the diff) · ScenarioBanner (delta + change list) ·
                    BillDrop · HowTo · Keyboard · Icon · Sprite
    chrome/         Toolbar (bottom-centre, View gear) · Dock · TopBar · BottomBar · Floats (zoom) · LayersPanel
  app/              layout.tsx (fonts, provider) · page.tsx · globals.css (tokens, shell grid)
scripts/            fetch-pricing.ts · synth-samples.ts
data/               pricing.us-east-1.json · pricing.ap-southeast-1.json
samples/            api-backend · media-pipeline · event-driven · partner-checkout ·
                    refund-approval (no AWS at all) · saas-platform (26 resources, every
                    service, 8 findings) · all six are **laid out on disk**
                    (`npm run layout-samples`) and framed like a real diagram: cloud › region
                    everywhere, CloudFront in the cloud beside the region because it is global,
                    event-driven adding vpc › private subnet
public/icons/aws/   sprite.svg (26 symbols) · Arch_*_64.svg · NOTICE.md
tests/              saas-platform (the showcase's eight findings, the catalogue, the nesting) ·
                    mermaid (both ways, the live merge, a hand-written chart) ·
                    share (a drawing in a link) · patch (merge by id, refusals) · code-ranges (which object a caret is in) ·
                    sample-layout (the samples are arranged on disk) ·
                    layout-crossings (edges crossing, counted geometrically) · remove (mixed-selection delete) · text-indent · cloudformation (incl.
                    the CDK round-trip and the label fallback) ·
                    containers · migrate(in containers) · migrate-edges · frames (incl. translateFrame with
                    sections) · layers · rules · exporters · golden-costs · edge-geometry (sides, waypoints,
                    shapes, loops) · bill · define-service (incl. security badges, list_services size) ·
                    delta · write-cdk-stacks
```

```
npm run dev            # localhost:3000 — the user reviews here first
npm run build          # static export (kills the dev cache — restart dev after)
npm test               # vitest (244)
npm run synth          # cdk synth on the three sample exports
npm run fetch-pricing  # refresh data/pricing.*.json
npm run layout-samples # re-arrange samples/*.json with the current layout engine
npx vercel deploy --prod --yes   # only when the user says deploy
```

Headless check pattern (used throughout): puppeteer-core with the installed Chrome against `localhost:3000`,
capture `pageerror` + console errors, screenshot to the scratchpad, read the PNG. Keep the script inside the
repo (`.something.mjs`, deleted after) so `puppeteer-core` resolves; do not commit it.

**vitest gotcha:** pure-TS modules under test must not import from `.tsx` files (no React transform in
vitest) — that's why `nodeMetrics.ts` exists.

## 14. Hard constraints

- HTTPS; tools registered in the top-level document, never an iframe. Imperative API only.
- `document.modelContext` with `navigator.modelContext` fallback.
- Tool outputs ≤ ~1.5K chars. No login, no paywall.
- MIT licence at repo root, visible in the About section. Commit history inside the submission window.

## 15. Build order — status

| Phase | Done when | Status |
|---|---|---|
| 0 · Prove the pipe | one tool executed from the ChatGPT desktop app and Chrome | ✅ 2026-09-02 |
| 1 · Engine | sixteen services, pricing data, cost, golden tests | ✅ |
| 2 · Canvas | icon/card nodes, floating typed edges, inspector from schema | ✅ |
| 3 · Tools | read/write tools, live readout | ✅ (39 live) |
| 4 · Findings | nine rules, rings/stripes | ✅ |
| 5 · Scenarios | fork, delta, dynamic registration | ✅ |
| 6 · Cards + containers + sections | 130% LOD, containers with validation/rollup/collapse, sections | ✅ |
| 7 · Exports | JSON/MD/Mermaid/SVG/CDK, `cdk synth` on samples, chunking | ✅ |
| 8 · Bill ingest | CSV → summary → reconstruct | ✅ (lightly signposted) |
| 9 · Polish | docked chrome, keyboard, undo/redo, rename everything, empty state | ✅ |
| **10 · Video, README, submit** | script in §16; README answers the four prompts; repo public | **open** |

**Cut if behind:** section rubber-band drawing · `rename_container`/`set_edge` tools · empty-canvas gallery ·
BillDrop signposting. **Never cut:** the deployed URL working in the ChatGPT desktop app, the scenario
tool-count tick, the findings loop, exports, the licence, the video.

## 16. Testing in the ChatGPT desktop app

ChatGPT Atlas (the standalone browser) was **discontinued Aug 2026**. WebMCP site tools now live in the
**ChatGPT desktop app's built-in browser**: open the live URL in a tab there, look for the **arrow icon in the
address bar** (grey = tools available, blue = in use), and ask e.g. *"Use this site's tools to build HTTP API →
Lambda → DynamoDB, then call get_findings."* Requires GPT-5.6 Sol or Terra (Luna has WebMCP disabled); not
the Chrome extension. Second path: Chrome with `chrome://flags/#enable-webmcp-testing` + the Model Context Tool
Inspector extension.

Demo path to verify before recording: build by sentence → `get_findings` → `open_scenario` (count 38 → 42) →
set the Lambda to arm64/1024 MB → `get_delta` → `commit_scenario` (back to 33) → `export` cdk.

## 17. Video script (< 3:00, with audio, public on YouTube)

**`SCRIPT.md` at the root is the live version of this, and `DEVPOST.md` is the submission copy.**
Re-cut 2026-09-03 around **one claim**, chosen by the user after the first draft read as three
pitches stapled together (cost, workflow pain, agent collaboration · each defensible, none
subordinate, so nothing set anything else up):

> **An agent can draw you an AWS diagram today. It cannot tell you that diagram is wrong, or what it
> will cost. Overhead does both · because what it hands the agent is not a canvas, it is a design.**

Everything is evidence for that sentence, and **anything that is not is cut** · which is why the bill
drop and the trace tool, both of which work and demo well, are out of the video and live in the FAQ
instead. The user's own point of view (documenting an architecture is three jobs in three tools that
do not know about each other · there is no native tool for it) is the **origin** of the claim, not
the claim itself: §1 "Where it came from". The protagonist is the user, with the agent beside them ·
they drag and rename by hand while the agent's calls land in the strip, never a prompt demo. Speak the work, never the features: §4's shot list is somebody finishing
a task you recognise, and the Code tab is in it because it is the clearest proof that the agent is
editing the drawing rather than driving a UI. **§4a is the hook**, which the first cut did not have ·
seven seconds on the finished drawing with the total counting up ("every architecture diagram I've
ever drawn was a picture · this one knows what it costs, and my agent drew it"), the problem
statement moved to 0:07 where there is now a reason to care, alternates to read in the booth, the
same line in text for the Devpost tagline, and the last frame held on the cold open's image. §6 is the honest IaC roadmap · CDK and CloudFormation
export, CloudFormation import both ways, CDK import for a stack we wrote, and **no live sync**. The
table below is the original outline; where they differ, `SCRIPT.md` wins.

| Time | On screen | Said |
|---|---|---|
| 0:00–0:15 | AWS Pricing Calculator, then a spreadsheet | This is how we price a build. Neither knows what the architecture looks like. |
| 0:15–0:50 | Empty canvas → one sentence → nodes land inside cloud › region, total appears → agent calls `get_findings`, fixes two | I describe it. It builds it, priced from AWS's own price list. Then it checks its own work. |
| 0:50–1:30 | Open a scenario; bottom bar ticks 38 → 42; ARM + 1024 MB; delta drawn; cost goes down | More memory, lower bill — because it runs faster. Watch the tools appear when the scenario opens: that's WebMCP's dynamic registration. |
| 1:30–1:55 | Ask it to put a Lambda in a subnet; it adds a VPC and subnet; try moving DynamoDB in — refused with the rule | Containers are real: it knows what's allowed to live where. |
| 1:55–2:20 | Drop a Cost Explorer CSV; nodes fill with real spend | Your actual bill, parsed here, never uploaded. |
| 2:20–2:50 | Export Markdown → paste into a doc; export CDK → agent writes it into a repo | Out as Markdown for the proposal. Out as CDK, and my agent puts it in the repo. |

## 18. Submission checklist

- [ ] Live URL, no login, works in the ChatGPT desktop app **and** Chrome with the flag
- [ ] **Repo public**, MIT visible in About, README with run instructions and the renamed tools
- [ ] Raw `document.modelContext.registerTool({ name, description, inputSchema, execute })` visible in `src/webmcp/register.ts`
- [ ] Pricing data with `generatedAt` + source URLs; findings with verified doc links
- [ ] `npm run synth` passes
- [ ] YouTube video public, < 3:00, with audio
- [ ] Write-up answers all four prompts and includes the "open web" line
- [ ] Commit history inside the submission window
- [ ] Submitted by **03:00 Thu 4 Sep, Manila**
