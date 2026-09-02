# Overhead — build plan

> The view from above your AWS architecture — and what it costs to run.
> Entry for the WebMCP Challenge (Devpost). Deadline **3 Sep 2026, 1:00 PM PDT** = **Thu 4 Sep, 04:00 Manila**.
> Interactive version of this plan (diagrams, layer toggles, request trace, VPC collapse):
> https://claude.ai/code/artifact/a02ba1aa-3893-4fdd-af39-8bf7058c82f3

This document is the spec. When it and the artifact disagree, the artifact is the visual reference and this file is the behavioural one.

---

## 1. What it is

Sketch a **serverless AWS architecture with your agent on a live canvas**. Every node carries its real AWS price from the AWS Price List. Fork the design, compare the delta, fix what the findings flag, then export as CDK, Markdown, Mermaid, SVG, or a JSON state file that reloads.

Three moves on one canvas:

1. **Sketch** — *"HTTP API → Lambda → DynamoDB, S3 uploads behind CloudFront, SQS for thumbnails, ~5M req/month."* Nodes land one by one; a running monthly figure appears; the agent calls `get_findings` on its own work and fixes what it flagged.
2. **Tune** — *"What if the thumbnail Lambda runs on ARM at 1024 MB?"* A scenario opens, the scenario tools appear, the delta is drawn. Cost goes **down** because duration halves. You drag CloudFront off; a finding fires; you decide.
3. **Ground** — drop a Cost Explorer CSV. Parsed in the tab, never uploaded. Real spend lands on real nodes.

**One-line positioning:** a draw.io MCP lets an agent *draw* an AWS diagram. Overhead lets an agent *design* an AWS architecture — the diagram is just the view.

**The "open web" line for the write-up:** before WebMCP, only platforms big enough to ship an API and an official MCP server could expose capability to agents. Now any web page can, to whatever agent the visitor brought — no platform's permission, no partnership, no backend.

## 2. Who it's for

- **Consultancies quoting a build** — need a defensible monthly figure and a client-readable diagram before the proposal goes out. (Demo persona: a solo cloud consultant pricing a client's serverless backend.)
- **Teams triaging a bill** — the invoice jumped; which node; cheapest fix.
- **Engineers learning AWS** — nothing teaches architecture faster than watching a number move.

## 3. Scope

### v1 — ship this

- Ten services: **Lambda, API Gateway, DynamoDB, S3, CloudFront, SQS, SNS, EventBridge, Step Functions, Cognito**.
- Driver-based pricing: requests, duration, memory, storage, MAUs.
- Scenario forking with side-by-side delta.
- Findings with AWS doc links and estimated savings.
- Exports: JSON state, Markdown (+ Mermaid inline), Mermaid, SVG/PNG, CDK (TypeScript).
- Live tool panel (`getTools()` + `toolchange`).
- Groups: AWS Cloud frame; logical groups; group subtotal; collapse/expand.

### v1.5 — only if v1 lands early

- VPC / subnet / AZ frames (official group icons and colours), NAT Gateway, ALB, RDS, ECS Fargate, VPC endpoints.
- Enterprise findings: RDS in a public subnet, SG open on 22, single-AZ with an HA claim, NAT egress trap.
- Terraform export.

### Out of scope

Auth, backend, live AWS account connection, EC2 hourly pricing, multi-region.

## 4. Judging criteria and how we meet them

| Criterion | Argument |
|---|---|
| **WebMCP Leverage** (tiebreak #1) | 30+ semantic tools in six families, not draw primitives. Dynamic registration via `AbortController` (scenario tools exist only while a fork is open). Correct `readOnlyHint` / `untrustedContentHint`. Structured errors the agent must resolve. UI state commits *before* a tool returns. A visible tool panel that shows tools appearing and disappearing. Raw `document.modelContext.registerTool` present in the repo exactly as the brief prints it. |
| **Execution** | One screen, no login, no backend, no API keys. Seeded sample architecture so a judge sees value in ten seconds. Undo/redo, keyboard, empty states, real exports that `cdk synth`. |
| **Potential Impact** | Everyone with an AWS account. The gap between "what we'll build" and "what it'll cost" is served today only by the Pricing Calculator (no topology) or a spreadsheet. The bill is the one artifact you can't paste into a chat window. |
| **Creativity & Ambition** | Architecture + live cost + agent on one canvas; bill → diagram reconstruction; the live tool panel; a diagram language that removes arrow spaghetti. |

Stage One is pass/fail on "applies the required APIs" — the brief literally prints `document.modelContext.registerTool({ name, description, inputSchema, execute })`. Make sure `src/webmcp/register.ts` contains a raw call in that shape.

## 5. Diagram language

The problem with AWS diagrams: in every existing tool **a line is just a line**. Nothing in the file knows whether an arrow is an HTTP call or an IAM permission, so they all look alike, the author draws all of them, and the reader drowns. Overhead has a model under the picture, so it enforces a language.

### Rules

1. **Keep the icons.** Nodes are the AWS standard: official Architecture Icon at 56 px, resource name beneath. An AWS engineer reads a Lambda by shape before reading a word.
2. **One look, then deep dive.** Default view = icons, names, lanes, typed edges. Nothing else. Detail, cost and security are layers you turn on, or the gear you press.
3. **The card houses the icon.** Zoom past 125% (or press *Cards*, or turn on *Cost*) and each icon moves *inside* a 200×76 card: service term (as AWS names it), resource name, the 2–3 settings that decide price, security badge, monthly cost (monospace, right-aligned). Zoom out and it folds back to the icon. Nothing ever hangs loose outside the icon.
4. **Three edge kinds, three encodings, nothing else.** `sync` = solid + arrowhead. `async` = dashed (7 5) + arrowhead. `data` = dotted (2 5), no arrowhead. Permissions, logging, encryption are **node properties**, never edges. Inline legend always visible.
5. **Edges are curves.** Cubic bezier from source right-mid to target left-mid, control points at 50% of Δx. Same-column edges bracket out one side (reach 60). Long hops over intermediate nodes arch low over them (lift 34). No elbows, no 90° corners.
6. **Layers, default to one.** `request` · `events` · `data` · `security` · `cost`. Opens on request + events + data.
7. **Lanes, not arrowheads.** Auto-layout by role, left to right: **Ingress → Handlers → Messaging → Workers → Data**. Workers are their own lane so event flows never go backward.
8. **Volume on edges.** Label = req/month or GB/month; stroke width follows volume on a log scale (1.2 → 3.5 px).
9. **Fan-out collapses.** SNS → N identical consumers = one stacked icon, one edge with `×N`.
10. **Hover isolates.** A node's edges brighten, the rest dims to 18%. Click pins.
11. **Trace, don't number.** `trace_request` lights one request's path step by step with a step readout. The agent can drive it.
12. **Groups are nodes.** AWS Cloud, VPC, subnets use the official group frames and colours (`#242F3E`, `#8C4FFF`, `#7AA116` public, `#00A4A6` private) with the group icon in the top-left corner. A group carries a subtotal and **collapses into one card** (icon, name, `N subnets · M resources`, subtotal) with edges re-routed to it.
13. **Settings never sit on the diagram.** A gear (on hover) opens the inspector with the console's own fields. The card shows the three that decide price; the inspector shows all.
14. **Findings are rings and stripes.** Icon mode: amber/red ring around the icon. Card mode: stripe on the card's left edge. Click for the doc link.

`reference/diagram-module.js` is a working vanilla-SVG implementation of rules 3–12 (node cards, bezier routing, layers, hover, trace, groups, collapse). Port its geometry to React Flow custom nodes/edges; don't ship it as-is.

### The spine: one schema per service

```ts
// src/engine/services/lambda.ts
export const lambda = defineService({
  term: 'AWS Lambda',
  icon: 'aws-lambda',
  lane: 'handlers',            // default lane; overridable per node
  settings: {
    architecture:  { type: 'enum', values: ['x86_64', 'arm64'], default: 'arm64', label: 'Architecture' },
    memoryMb:      { type: 'number', min: 128, max: 10240, default: 512, label: 'Memory (MB)' },
    timeoutSec:    { type: 'number', min: 1, max: 900, default: 3, label: 'Timeout (s)' },
    avgDurationMs: { type: 'number', min: 1, default: 200, label: 'Avg duration (ms)', driver: true },
    reservedConcurrency: { type: 'number', min: 0, optional: true, label: 'Reserved concurrency' },
  },
  cardLines: ['architecture', 'memoryMb', 'avgDurationMs'],
  price: (s, traffic, pricing) => { /* GB-s + requests from the price list */ },
  cdk: (s, name) => { /* construct props */ },
});
```

From this one definition derive: the inspector form, the `set_property` input schema, `list_services` output, the card's three lines, the pricing function's inputs, and the CDK props. **One vocabulary for the human and the agent. No hand-syncing.**

## 6. Data model

```ts
Node      { id, service, name, settings, lane?, group?, position }
Edge      { id, from, to, kind: 'sync'|'async'|'data', volumePerMonth?, label? }
Group     { id, kind: 'cloud'|'vpc'|'subnet'|'az'|'logical', name, cidr?, parent?, collapsed }
Traffic   { requestsPerMonth, avgPayloadKb }
Scenario  { id, name, base: StateSnapshot, fork: StateSnapshot }
Finding   { rule, severity: 'info'|'warn'|'critical', message, docUrl, nodeIds, estimatedSaving }  // derived
Cost      { nodeId, lines: [{ sku, unit, qty, rate, monthly, sourceUrl }], monthly }              // derived
```

Cost and findings are **derived selectors**, recomputed on every mutation, never stored.

## 7. Tool surface (32 tools, six families)

Read tools: `readOnlyHint: true`. Anything returning parsed bill content: `untrustedContentHint: true`. Every mutation updates the canvas **before** returning. Tool outputs stay under ~1.5K chars — use `get_export_chunk` for anything bigger.

| Tool | Kind | Input → returns |
|---|---|---|
| `get_architecture` | read | — → nodes, edges, groups, properties, monthly total |
| `get_node` | read | id → full settings (console terms), cost lines, findings |
| `get_cost_breakdown` | read | groupBy: node\|service\|group → sorted cost lines with SKU provenance |
| `get_findings` | read | severity? → `{ rule, severity, message, docUrl, nodeIds, estimatedSaving }[]` |
| `list_services` | read | — → supported types with settings schemas and pricing drivers |
| `get_pricing_source` | read | — → region, fetchedAt, source URLs |
| `add_service` | write | type, name, settings?, group? → node id |
| `connect` | write | from, to, kind, volumePerMonth? → edge id |
| `set_property` | write | id, key, value → new node cost; **structured error** on invalid value |
| `set_traffic` | write | requestsPerMonth, avgPayloadKb → recalculated total |
| `remove_node` | write | id → orphaned edges cleaned |
| `apply_pattern` | write | `arm64` \| `http_api` \| `express_workflows` \| `provisioned_capacity` \| `cdn_in_front` \| `dlq_everywhere` → nodes changed |
| `auto_layout` | write | — → positions by lane |
| `set_layer` | write | request \| events \| data \| security \| cost, on/off → visible layer set |
| `trace_request` | write | fromNodeId → highlighted path + step list |
| `collapse_fanout` / `expand_fanout` | write | nodeId → fan-out folded to one edge with count, or unfolded |
| `add_group` / `move_into_group` | write | kind, name, cidr?, parent? → group id; nodeIds → re-parented |
| `collapse_group` / `expand_group` | write | groupId → one card with count + subtotal, edges re-routed |
| `open_scenario` | **dynamic** | name → forks state; **registers the four below** |
| `scenario_apply` | dynamic | any write above, applied to the fork only |
| `get_delta` | dynamic | — → per-node and total difference, base vs fork |
| `commit_scenario` | dynamic | — → fork becomes base; scenario tools abort |
| `discard_scenario` | dynamic | — → fork dropped; scenario tools abort |
| `get_bill_summary` | read (untrusted) | — → services and spend found in the dropped CSV |
| `reconstruct_from_bill` | write | — → nodes created from bill line items, real spend attached |
| `export` | read | format: json\|markdown\|mermaid\|cdk\|svg → summary + opens export panel |
| `get_export_chunk` | read | format, index → one ~1.2K slice |
| `import_state` | write | json → replaces the canvas |
| `refresh_pricing` | bonus | only if the AWS bulk endpoints send CORS headers |

### Registration

```ts
// src/webmcp/register.ts — raw, exactly as the brief prints it
const mc = document.modelContext || navigator.modelContext; // navigator.* is deprecated since Chrome 150

const scenario = new AbortController();
await mc.registerTool({
  name: 'get_delta',
  description: 'Cost and topology difference between the base design and the open scenario.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true },
  execute: async () => ({ content: [{ type: 'text', text: JSON.stringify(engine.delta()) }] })
}, { signal: scenario.signal });
// commit_scenario / discard_scenario call scenario.abort()
```

Rules: register in a `'use client'` provider mounted at the root, after hydration, in the **top-level document** (ChatGPT's browser ignores iframe tools). Imperative API only. Abort via `AbortSignal`, never `unregisterTool`. Keep tool names ≤ 30 chars, descriptions ≤ 500, param descriptions ≤ 150.

### The tool panel

A strip in the UI driven by `getTools()` and the `toolchange` event: *"18 tools live · 4 more while a scenario is open."* This makes dynamic registration visible on video and teaches the judge the spec while they use the product.

## 8. Findings — every rule cites its doc

Verify every URL during the build. Each rule lives in `src/engine/rules/<rule>.ts`, unit-tested, returning `estimatedSaving` computed from the same pricing table.

| Rule | Fires when | Cites |
|---|---|---|
| `rest_where_http_would_do` | REST API with no feature that needs it (no usage plans, request validation, WAF) | https://aws.amazon.com/api-gateway/pricing/ |
| `standard_workflow_high_volume` | Step Functions Standard, >100k executions/month, no human-wait step | https://aws.amazon.com/step-functions/pricing/ |
| `x86_lambda` | any Lambda not on arm64 | https://aws.amazon.com/lambda/pricing/ |
| `memory_duration_tradeoff` | Lambda < 1024 MB with duration > 500 ms — surface the crossover | https://docs.aws.amazon.com/lambda/latest/operatorguide/computing-power.html |
| `on_demand_steady_state` | DynamoDB on-demand with steady throughput past the provisioned crossover | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/capacity-mode.html |
| `no_lifecycle_on_logs` | S3 bucket tagged logs/backup with no lifecycle rule | https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html |
| `s3_public_no_cdn` | S3 serving public assets with no CloudFront upstream | https://docs.aws.amazon.com/AmazonS3/latest/userguide/website-hosting-cloudfront-walkthrough.html |
| `async_no_dlq` | async Lambda or SQS consumer with no DLQ / destination | https://docs.aws.amazon.com/lambda/latest/dg/invocation-async.html |
| `unbounded_fanout` | SNS → N Lambdas with no concurrency limit | https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/welcome.html |
| `nat_egress` (v1.5) | NAT Gateway with > 100 GB/month processed | https://aws.amazon.com/vpc/pricing/ |

## 9. Pricing — from AWS, not from us

AWS publishes the Price List Bulk API as public JSON, **no auth**. Use per-region files.

```
https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/index.json
https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSLambda/current/region_index.json
https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSLambda/current/ap-southeast-1/index.json
```

`scripts/fetch-pricing.ts` runs at build: pulls the ten services, filters to the SKUs the engine prices, writes `data/pricing.<region>.json` with `generatedAt` and a `sourceUrl` per SKU. UI shows *"AWS Price List · ap-southeast-1 · fetched <date>"* with a link; `get_pricing_source` returns the same. Ship `ap-southeast-1` and `us-east-1`; region is a switch.

Test in five minutes whether those endpoints send CORS headers. If yes, add `refresh_pricing`. If no, nothing is lost.

## 10. Exports

| Format | Contents | How |
|---|---|---|
| JSON state | whole model incl. scenarios + pricing snapshot id; reloads exactly via `import_state` | `JSON.stringify(store)` |
| Markdown | title, assumptions, cost table by node, findings with links, Mermaid block inline | string template |
| Mermaid | `flowchart LR`, node labels carry monthly figure | string template |
| SVG / PNG | the canvas as drawn | `html-to-image` on the React Flow viewport |
| CDK (TypeScript) | one stack, ten constructs, header listing every assumption and stub | templates per construct; **`cdk synth` in CI on the three samples** |
| Terraform | v1.5 | later |

Three delivery routes for every format: download, clipboard, and the tool result (so the visitor's agent can take CDK straight into their repo). Autosave to `localStorage`.

## 11. Stack and repo layout

- **Next.js 15**, App Router, static export. No API routes, no server, no auth.
- **TypeScript** end to end; `src/engine` is plain TS with no React in it.
- **@xyflow/react** (React Flow, MIT) — nodes, edges, drag, parent containers for groups.
- **Zustand** store; cost and findings are derived selectors.
- **Tailwind**; tokens as CSS variables so both themes hold.
- **papaparse** (bill CSV), **html-to-image** (SVG/PNG), **vitest**.
- **Vercel**.

```
src/
  engine/           pure TS: model, pricing, rules, delta, exporters
    model.ts
    pricing.ts
    services/*.ts   defineService() — one per AWS service (the spine)
    rules/*.ts
    exporters/{json,markdown,mermaid,cdk}.ts
  webmcp/
    register.ts     raw document.modelContext.registerTool
    provider.tsx    'use client', mounts at root
    panel.tsx       live tool list via getTools + toolchange
  canvas/           React Flow nodes (icon / card), edges (bezier, typed), groups, inspector
  app/
scripts/fetch-pricing.ts
data/pricing.*.json
public/icons/aws/   official Architecture Icons + NOTICE.md
samples/*.json      three seeded architectures
tests/
```

### Icons

Use the **official AWS Architecture Icons** (July 2026 package). Copy the 64 px service SVGs and the 32 px group icons into `public/icons/aws/` and build them into one SVG sprite (`<symbol id="aws-lambda" viewBox="0 0 80 80">…`), referenced with `<use href="#aws-lambda">`. Strip `id` attributes inside each symbol so they don't collide. Add `public/icons/aws/NOTICE.md`: © Amazon Web Services, used under AWS's Architecture Icons terms, **excluded from the repo's MIT licence** (same approach as mingrammer/diagrams and draw.io).

Source on this machine: `~/Downloads/Icon-package_07312026.5846e92413caa21490223536cc97f1269e44fa92/`
`reference/aws-icon-sprite.svg` already contains the 22 symbols the mock uses.

### Design tokens

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--ground` | `#f2f3f5` | `#0f1114` | page/canvas; canvas gets a 1 px grid at 6% ink |
| `--surface` | `#ffffff` | `#171a1f` | cards, inspector, panels |
| `--surface-2` | `#e8eaee` | `#20242a` | inputs, code, table headers |
| `--ink` | `#15181d` | `#eceef2` | text, edges, every number |
| `--ink-2` | `#464c56` | `#b1b7c1` | secondary text |
| `--ink-3` | `#737a86` | `#828997` | labels, captions |
| `--rule` | `#d5d8de` | `#2a2f37` | hairlines |
| `--accent` | `#2450d6` | `#8ea8ff` | selection, focus, scenario overlay, tool-panel count |
| `--saving` | `#1a6b47` | `#6fcf9a` | negative delta |
| `--finding` | `#b57a00` | `#e2b45a` | warning ring/stripe |
| `--critical` | `#a8281c` | `#f08b7f` | critical ring/stripe, positive delta |

Type: **Archivo** (headings, tool panel), **IBM Plex Sans** (UI), **IBM Plex Mono** (every number, every export). Tabular figures where digits align.

## 12. Hard constraints

- HTTPS; tools registered in the **top-level document**, never an iframe.
- Imperative API only; declarative `<form toolname>` is unsupported in ChatGPT's browser.
- `document.modelContext` with `navigator.modelContext` fallback.
- Tool outputs ≤ ~1.5K chars.
- No login, no paywall. Judges must reach everything.
- MIT licence at repo root, visible in the About section.
- Commit history inside the submission window.

## 13. Build order (with acceptance criteria)

| Phase | Hours | Done when |
|---|---|---|
| **0 · Prove the pipe** | 2 | Repo + MIT licence + Next.js deployed to Vercel; **one trivial tool registered and executed from the ChatGPT desktop browser's Site tools**, and from Chrome with `chrome://flags/#enable-webmcp-testing`. Nothing else starts until this passes. |
| **1 · Engine, no UI** | 3 | `defineService()` for ten services; pricing script run; `data/pricing.*.json` committed; cost function; three sample architectures with golden costs in vitest. |
| **2 · Canvas** | 3 | React Flow with icon-mode nodes (official icons), bezier typed edges, lanes, hover isolation, inspector generated from the settings schema. Load a sample; drag works; running total shows. |
| **3 · Tools, read + write** | 3 | All read/write tools registered; each tested from the ChatGPT browser as added; tool panel live. |
| **4 · Findings** | 2 | Rules with doc links + savings; rings/stripes on canvas; `get_findings` returns structure the agent acts on. |
| **5 · Scenarios** | 2 | Fork, dashed overlay, delta, dynamic registration via `AbortController`; panel count changes. |
| **6 · Cards + zoom + groups** | 2 | Card mode at ≥125% zoom or on demand; AWS Cloud group frame; logical groups; collapse/expand. |
| **7 · Exports** | 3 | JSON round-trip → Markdown + Mermaid → SVG → CDK with `cdk synth` on samples; chunked tool delivery. |
| **8 · Bill ingest** | 2 | Drop CSV → parse locally → reconstruct nodes → real spend attached. **Cut first if behind.** |
| **9 · Polish** | 2 | Empty states, "how to try this" banner, both themes, keyboard, undo. No new features past here. |
| **10 · Video, README, submit** | 3 | Script in §14; record twice, keep the second; README answers the four prompts; submit with 1 h buffer. |
| v1.5 | — | Networking only if 0–10 are done. |

**Cut order if behind:** bill ingest → Terraform → Cognito/Step Functions → auto-layout.
**Never cut:** the deployed URL working in the ChatGPT browser, scenario forking, the findings loop, the tool panel, the video, the licence.

## 14. Video script (< 3:00, with audio, public on YouTube)

| Time | On screen | Said |
|---|---|---|
| 0:00–0:15 | AWS Pricing Calculator, then a spreadsheet | This is how we price a build. Neither knows what the architecture looks like. |
| 0:15–0:50 | Empty canvas → one sentence → nodes land, total appears → agent calls `get_findings`, fixes two | I describe it. It builds it, priced from AWS's own price list. Then it checks its own work. |
| 0:50–1:30 | Open a scenario; tool panel ticks 18 → 22; ARM + 1024 MB; delta drawn; cost goes down | More memory, lower bill — because it runs faster. Watch the tools appear when the scenario opens: that's WebMCP's dynamic registration. |
| 1:30–1:55 | Drag CloudFront off; finding fires; keep it anyway | I know this client. I overrule it. It re-prices around me. |
| 1:55–2:20 | Drop a Cost Explorer CSV; nodes fill with real spend | Your actual bill, parsed here, never uploaded. Now we're tuning the thing you have. |
| 2:20–2:50 | Export Markdown → paste into a doc; export CDK → agent writes it into a repo | Out as Markdown for the proposal. Out as CDK, and my agent puts it in the repo. |

## 15. Submission checklist

- [ ] Live URL, no login, works in ChatGPT desktop browser **and** Chrome with `#enable-webmcp-testing`
- [ ] Public repo, MIT licence visible in About, README with run instructions
- [ ] Raw `document.modelContext.registerTool({ name, description, inputSchema, execute })` visible in `src/webmcp/register.ts`
- [ ] Pricing data with `generatedAt` + source URLs; findings with verified doc links
- [ ] `cdk synth` passes on the three sample exports
- [ ] YouTube video public, < 3:00, with audio
- [ ] Write-up answers all four prompts (fit for WebMCP; better UX; what people + agents can now do together; how implemented) and includes the "open web" line
- [ ] Commit history inside the submission window
- [ ] Submitted by **03:00 Thu 4 Sep, Manila**
