# Overhead — the whole thing in one document

> **The view from above your AWS architecture — and what it costs to run.**
> Entry for the WebMCP Challenge (Devpost). Deadline **3 Sep 2026, 1:00 PM PDT** = **Thu 4 Sep, 04:00 Manila**;
> submit by 03:00.
>
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
- 35 tools live, 39 while a scenario is open (§9).
- Tests: 142 across 15 vitest files.

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
- No backend, no auth, no API routes. Static export.
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

**v1 (shipped):** sixteen services — Lambda, API Gateway, DynamoDB, S3, CloudFront, SQS, SNS, EventBridge,
Step Functions, Cognito, Kinesis Data Streams, Data Firehose, KMS, Secrets Manager, Parameter Store,
CloudWatch Logs. The last six answer "what does the plumbing cost": **encryption is not free** (a customer
managed key is $1 per key version per month before it is used, and every request is billed), a secret is
$0.40 a month against a standard parameter's nothing, and CloudWatch Logs ingestion routinely beats the
Lambda that wrote the log. Driver-based pricing. Scenario forking with delta. Findings with doc links and savings.
Exports. Live tool readout. Containers (cloud/region/VPC/subnets) and sections.

**Deferred:** `external` / `account` / `az` / `asg` container kinds (the validator tables are the only thing to
extend), NAT/ALB/RDS/ECS, enterprise findings, Terraform, fan-out collapse, `refresh_pricing`.

**Out of scope:** auth, backend, live AWS account connection, EC2 hourly pricing, multi-region.

## 4. Judging criteria and how we meet them

| Criterion | Argument |
|---|---|
| **WebMCP Leverage** (tiebreak #1) | 35 semantic tools in eight families, not draw primitives. Dynamic registration via `AbortController` — four tools exist only while a scenario is open, and the bottom bar's count ticks. Correct `readOnlyHint` / `untrustedContentHint`. Structured errors the agent must resolve (unknown container, a frame nested in itself, invalid setting). UI state commits before a tool returns. Raw `registerTool` present exactly as the brief prints it. |
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
  every frame lays out its own resources as a grid whose **columns are dependency depth** (`ranks()`:
  longest path over the edges inside that frame, with the back edges of a cycle dropped by DFS
  colouring) and whose rows are ordered by a one-pass barycentre over the columns already placed;
  child frames sit in a row beneath. A frame's size is what that needs plus `FRAME_PAD`/`FRAME_HEAD`,
  and its parent packs it the same way up to the canvas. Every container's `bounds` is re-fitted.
  **Columns used to come from the service's role**, which drew the media-pipeline chain
  (cdn → assets → queue → worker) as cdn, worker, queue, assets with every arrow running backwards ·
  roles are now only `ServiceDef.role` and a `placeInRole` hint for a single new node, never the
  layout. Sections are emitted **per column of resources outside every frame, and only when the
  column holds two or more** (`auto-*` ids, replaced on re-run, user sections untouched): a dashed box
  around one icon says nothing, and a four-node chain used to come back wearing four of them.
  **Widths and gaps are measured, not constant** (2026-09-03): a column is as wide as the widest thing
  drawn in it, which is often the resource *name* and not the node, and the gap between two columns is
  opened by the widest edge label that has to sit in it (`textWidth`, base `COL_GAP` 44 / `ROW_GAP` 40).
  The column pitch still reserves the **card** width, because cards appear on their own at 130% zoom and
  a layout tuned to the icon would overlap the moment you zoomed in.
  Auto-layout also **says what it did** ("Arranged 13 resources in 5 columns by dependency · 1 section"),
  including when it removes `auto-` sections a previous run left behind: a four-node chain has no column
  worth a section, so re-running looked like it was deleting them for no reason.
  `tests/layout.test.ts` checks containment, no sibling overlap, edge-driven columns, the ignored back
  edge, row order, the section rule, and the two measured-spacing rules.

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
   monthly cost. Constant 200×100 hit-box in both modes (`src/canvas/nodeMetrics.ts`).
4. **Three edge kinds, three encodings, nothing else.** `sync` solid + arrowhead · `async` dashed `7 5` +
   arrowhead · `data` dotted `2 5`, no head. Permissions, logging, encryption are **node properties** (security
   badges), never edges.
5. **Edges are floating and four-sided** (`edgeGeometry.ts`, pure TS): anchors come from node position +
   visual shape (`shapeOf`: icon rim ±34 around centre y 39 · card ±100 × ±38), never from handle
   coordinates; the node's handles and "+" pads are placed from the same `shapeOf`/`anchorPoint`.
   `pickSides` chooses exit/entry sides by geometry (the axis with the larger clear gap wins, so a target
   below is left from the bottom and entered from the top); `bracket` only when shapes overlap;
   `edge.anchors` pins a side per end. **Sides are picked in `Canvas.tsx`** so fans (`fan`) are keyed per
   node *and* side. A path runs through `[p0, ...waypoints, p3]` as a curve (cubic segments, end tangents
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
8. **Hover isolates.** A node's edges brighten, the rest dims to 16%. It works on the graph **as drawn**:
   `hoverSeeds` turns a hovered collapsed-frame card into every member hidden inside it (so its edges
   light), and `litKeys` maps the lit model ids onto what is rendered (a hidden member → the card that
   stands in for it). Without that the card you were pointing at was the one thing that dimmed, and the
   frame around it looked active instead. The card's border goes to the accent on hover and while
   selected, which needs the frame colour to ride on the wrapper as `--frame-color`: an inline
   `border-color` beats every stylesheet rule.
9. **Trace, don't number.** `trace_request` (or the T tool + a click) lights the path from a node.
10. **Settings never sit on the diagram.** The Inspector shows the schema form; the card shows the three that
    decide price.
11. **Findings are rings and stripes.** Icon mode: amber/red ring. Card mode: stripe on the left edge.

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
  select · monthly total (23 px mono — the one loud number) · Templates · Scenario · **Import** · Export.
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
  starts folded, opening it folds every other top-level row, opening any top-level object folds
  Connections. Click selects the object itself; hover reveals collapse-on-canvas and remove. **Rows
  drag, Figma-style**: the pointer's height over a row decides (`whereIn`) · the middle third **nests**
  it (a resource into a frame with `moveIntoContainer` or a section with `setSectionNodes`, a frame into
  a frame with `setContainerParent` where only a cycle is refused, a section under a section with
  `setSectionParent`), the top and bottom quarters draw an **insertion line** and drop it *beside* that
  row, adopting that row's own frame and section (`LayerRow.ctx`, from `engine/layers.ts`). That is how
  a row moves **out** of something: drop it beside a shallower row, or on the header line for the top
  level. Two resources beside each other also reorder (`placeNodeBeside`). No header buttons (the
  toolbar's A and S already add frames and sections). No tabs.
- **Palette** (`Palette.tsx`, floating above the toolbar, A or `/`): search, the sixteen services (click adds —
  inside a selected region/cloud — or drag onto the canvas) and the container kinds, which create with the
  validator's verdict as tooltip, select the new frame and **pan to it when it lands off-screen** (a second
  AWS Cloud is placed clear of everything, to the right). With a `pendingConnection` it opens at that point
  as "Connect from …": the picked service lands beside the source, in its container, already connected.
- **Templates** (`Templates.tsx`): a modal dialog from the rail with the three samples.
- **Right dock** (300 px): the **Inspector** (`Inspector.tsx`) in named, independently collapsible sections
  (state remembered in `localStorage`): node → Position · Settings (schema, `group !== 'security'`) ·
  **Security** (schema, `group: 'security'`, drives the badge and CDK) · Cost · Findings; container →
  Identity · Frame · Contents; section/group → Appearance · Members · Frame; edge → **Connection** (type
  chips = `kind`, volume, label) · **Styling** (`EdgeStylePicker`, anchor sides, bends).
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
- Inline editing: double-click a node label, a frame name or an edge label on the canvas. Delete/Backspace
  removes the selected waypoint, else edge, else container/section/node. ⌘G groups the selection, ⇧⌘G
  ungroups. Escape backs out (label edit → pending connection → export → templates → palette → selection/
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

## 9. Tool surface (35 live · 39 in a scenario)

Read tools: `readOnlyHint`. Mutations update the store before returning. `text()` caps output at 1.5K.

| Tool | Kind | Notes |
|---|---|---|
| `get_architecture` | read | nodes (id, service, name, container, monthly), edges, containers, sections, traffic, total |
| `get_node` | read | settings, cost lines, `placement` breadcrumb, findings (≤2) |
| `get_cost_breakdown` | read | by node or service |
| `get_findings` | read | severity filter, first 5 |
| `list_services` | read | ids, terms, roles, drivers; or one service's schema |
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
| `import_state` | write | migrated through `migrateSnapshot` |
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
| Mermaid | `flowchart LR`, labels carry monthly cost |
| PNG / SVG / PDF | `canvas/exportImage.ts` · the **whole drawing**, not the current viewport: the union of every node and every stored frame rectangle becomes the picture, and `getViewportForBounds` gives the viewport element a fitting transform for the duration of the `html-to-image` capture. PNG at 1×/2×/3× with an optional transparent ground; SVG vector; **PDF is built here** (`jpegToPdf`: a JPEG wrapped in a one-page PDF · catalog, page tree, DCTDecode XObject, content stream, hand-counted xref) so there is no print dialog and no new dependency. **The sprite has to ride along**: every icon is a `<use href="#aws-…">` into the sprite injected at the app root, and `html-to-image` serialises only the captured element into an isolated document where those ids resolve to nothing · pictures came out as labels with no icons until `captureDrawing` began appending a clone of `[data-oh-sprite]` inside the captured subtree for the length of the capture |
| CDK (TypeScript) | one stack named from the drawing, one construct per node from `defineService().cdk`, header listing every stub. Variable names never shadow an imported namespace (a node called `logs` or `secretsmanager` used to emit a stack that failed at "cannot access before initialization" · `varNames()` in `cdk.ts` resolves it), and **`npm run synth` runs `cdk synth` on the three samples plus an `all-services` fixture holding one node of every service** |
| CloudFormation (YAML) | deployable template from `defineService().cfn`, so it cannot drift from the CDK. A `Metadata.Overhead` block carries what a template has no place for (positions, containers, sections, traffic, the settings that only drive price) and each resource carries its `nodeId`, which is what makes the round-trip exact. YAML is written by `iac/yaml.ts` (no dependency); §12b is the way back |

Three routes: download (filename = drawing name), clipboard, and `export` + `get_export_chunk`. Autosave to
`localStorage` (`overhead-state-v2`). The UI surface is `ExportPanel.tsx`, a **centred dialog** (rendered
from `App`, not inside the right dock, where it did nothing while that dock was collapsed): a named list
grouped **Picture / Document / Build / Project**, one line each saying what the file is for, the artefact
itself previewed beside it, then Download and Copy. JSON sits under **Project**, not Build: it is the
drawing, not a build artefact. `export`/`get_export_chunk` stay text-only · a picture is not a tool output.

### 12b. Import and reconciliation (`src/engine/iac/`)

CloudFormation is the only format that goes both ways, and it was chosen because it is the interchange
format: CDK and SAM both synthesise to it, so reading it works for all three without parsing anybody's
TypeScript.

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
- UI: **Import** in the top bar, or drop a `.yaml` / `.yml` / `.json` / `.template` on the canvas
  (`BillDrop` routes by extension · a `.csv` is still the bill). `ImportPanel.tsx` shows the resources, the
  estimate, and the full diff **before** anything happens, then Replace or Merge.
- Not built, and named as not built in `SCRIPT.md`: a live sync. Nothing watches a repo and nothing writes
  to one.

## 13. Stack, repo layout, commands

Next.js 15 (App Router, `output: "export"`), React 19, TypeScript, `@xyflow/react` v12, Zustand, Tailwind 4,
papaparse, html-to-image, vitest, puppeteer-core (dev, headless checks). Vercel.

```
src/
  engine/           pure TS: model, containers, frames(boxes/hit-test/translate), migrate, layout(roles),
                    pricing, cost, findings, delta, bill, services/*.ts (defineService), rules/*.ts,
                    exporters/{json,markdown,mermaid,cdk,cloudformation,index}.ts
  engine/iac/       yaml.ts (writer + reader, short-form intrinsics) · cloudformation.ts (import, ours and
                    foreign) · reconcile.ts (diff + replace/merge · what stands in for a sync)
  webmcp/           register.ts · tools.ts · scenario.ts · toolRegistry.ts · provider.tsx
  store/            useStore.ts · history.ts (undo/redo)
  engine/layers.ts  layerRows() — the Layers tree as rows (positional nesting of sections/groups)
  engine/frames.ts  container + section geometry, hit-test, translateFrame / movedNodeIds / movedSectionIds
  canvas/           App.tsx (shell) · Canvas.tsx (sides + fans, multi-select, section drawing, drag → drop
                    re-parent, connect start/end) · AwsNode (4 handles, + pads, body handle, gear, badge) ·
                    FrameCard (any collapsed frame) ·
                    ContainerFrames · SectionFrames · frames/FrameChrome + frames/useFrameGesture (shared) ·
                    TypedEdge (waypoints, + mids, styling toolbar, label edit) · EdgeStylePicker ·
                    edgeGeometry.ts · edgeStyle.ts · nodeMetrics.ts · Inspector (node/container/section/edge)
                    · Popovers (view + card gears only) · Palette (floating, connect-from) ·
                    Templates (dialog) · Notice · TracePill · ExportPanel (dialog) + exportImage.ts
                    (PNG/SVG/PDF of the whole drawing) · ScenarioBanner (delta + change list) ·
                    BillDrop · HowTo · Keyboard · Icon · Sprite
    chrome/         Toolbar (bottom-centre, View gear) · Dock · TopBar · BottomBar · Floats (zoom) · LayersPanel
  app/              layout.tsx (fonts, provider) · page.tsx · globals.css (tokens, shell grid)
scripts/            fetch-pricing.ts · synth-samples.ts
data/               pricing.us-east-1.json · pricing.ap-southeast-1.json
samples/            api-backend · media-pipeline · event-driven (seeded; has cloud›region›vpc›subnet)
public/icons/aws/   sprite.svg (26 symbols) · Arch_*_64.svg · NOTICE.md
tests/              containers · migrate(in containers) · migrate-edges · frames (incl. translateFrame with
                    sections) · layers · rules · exporters · golden-costs · edge-geometry (sides, waypoints,
                    shapes, loops) · bill · define-service (incl. security badges, list_services size) ·
                    delta · write-cdk-stacks
```

```
npm run dev            # localhost:3000 — the user reviews here first
npm run build          # static export (kills the dev cache — restart dev after)
npm test               # vitest (142)
npm run synth          # cdk synth on the three sample exports
npm run fetch-pricing  # refresh data/pricing.*.json
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
| 3 · Tools | read/write tools, live readout | ✅ (35 live) |
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

Demo path to verify before recording: build by sentence → `get_findings` → `open_scenario` (count 35 → 39) →
set the Lambda to arm64/1024 MB → `get_delta` → `commit_scenario` (back to 33) → `export` cdk.

## 17. Video script (< 3:00, with audio, public on YouTube)

**`SCRIPT.md` at the root is the live version of this** (2026-09-03): the shot list re-cut for the
current chrome, the positioning against a draw.io / Lucidchart MCP, the four write-up answers, and
§6 there is the honest IaC roadmap · CDK export exists, **CloudFormation export, IaC import and any
kind of sync do not**, and `import_cloudformation` is named as the next thing worth building because
a synthesised template is already the typed resource graph the price model wants. The table below is
the original outline; where they differ, `SCRIPT.md` wins.

| Time | On screen | Said |
|---|---|---|
| 0:00–0:15 | AWS Pricing Calculator, then a spreadsheet | This is how we price a build. Neither knows what the architecture looks like. |
| 0:15–0:50 | Empty canvas → one sentence → nodes land inside cloud › region, total appears → agent calls `get_findings`, fixes two | I describe it. It builds it, priced from AWS's own price list. Then it checks its own work. |
| 0:50–1:30 | Open a scenario; bottom bar ticks 35 → 39; ARM + 1024 MB; delta drawn; cost goes down | More memory, lower bill — because it runs faster. Watch the tools appear when the scenario opens: that's WebMCP's dynamic registration. |
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
