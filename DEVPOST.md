# Devpost submission · copy-paste ready

The spine is `SCRIPT.md` §1: **an agent can draw an AWS diagram today; it cannot tell you the diagram
is wrong, or what it costs.** Every field below is evidence for that. Keep them in step: if the claim
changes, this file and `SCRIPT.md` change together.

---

## Project name

```
Overhead
```

## Elevator pitch

The one to use (95 characters):

```
The AWS architecture diagram that knows what it costs, and that your agent can design with you.
```

Alternates, if the field wants it shorter or a different angle:

```
Your agent can draw an AWS diagram. Here it can design one: priced, reviewed, exported as CDK. (94 chars · leads on the draw/design line)
```
```
The diagram, the estimate and the CDK, out of one document you build with your agent. (85 chars · leads on the artefacts)
```
```
AWS architecture, priced as you draw it, with your agent working the same canvas. (81 chars · leads on the live feel)
```
```
The view from above your AWS architecture, and what it costs to run. (68 chars · the original line, no agent in it)
```

---

## Inspiration

Every time I document an architecture I do the same three jobs in three tools that do not know about
each other. I draw it in a tool that knows nothing about AWS: it has boxes, I supply the meaning. I
price it in the AWS Pricing Calculator, which knows nothing about my drawing, so I re-type the whole
design as line items and re-type it again whenever the design moves. Then I write the doc, which
knows about neither, so it is wrong the moment either one changes and nobody can tell by looking.

There is no native tool for this. AWS ships a calculator with no topology and a console with no
drawing. Everything else is a canvas with no idea what it is drawing.

Then agents arrived, and the first thing everyone did was point one at a drawing tool. That made the
gap worse, not better: now the picture arrives faster and it still means nothing. An agent drawing
rectangles has automated the part that was never the hard part. The hard part is knowing that this
API should be HTTP and not REST, that a Lambda at 512 MB and 900 ms can cost more than the same
Lambda at 1024 MB, that an async consumer with no dead-letter queue is a bug you cannot see in a
picture.

So I built the thing the agent should have been handed in the first place: not a canvas, a design.

## What it does

Overhead is a single web page where you and your agent sketch a serverless AWS architecture on the
same live canvas.

- **Every resource carries its real price.** Sixteen services, priced per SKU from the AWS Price List
  Bulk API for `us-east-1` and `ap-southeast-1`, each rate keeping its source URL. Change the setting
  that drives the cost and the number moves, because the setting is what the price is a function of.
  Nothing in the app has a hardcoded rate.
- **It reviews itself.** Nine rules read the design and fire on it, each citing an AWS doc and a
  monthly saving: a REST API where HTTP would do, an x86 Lambda, on-demand DynamoDB past the
  provisioned crossover, an async consumer with no DLQ, a public bucket with no CDN, and more. The
  agent runs them on its own work and fixes what it flagged.
- **You can argue with it.** Ask for an invalid setting and you get the allowed values back. Nest a
  frame inside itself and it refuses with a reason. A drawing tool cannot disagree with you, because
  a picture asserts nothing.
- **What-if is a fork, not a copy.** Open a scenario, change what you like, read the delta per
  resource, then commit or discard. More memory usually means a lower bill, because the function
  finishes faster, and you can watch that happen.
- **One document, three ways in.** The canvas, a live JSON Code panel in the right dock (type in it
  and the drawing redraws; drag on the canvas and the text follows; put your caret in a resource and
  it lights up), and the agent's tools. All three go through the same validator.
- **It compiles.** Export CDK TypeScript that `cdk synth` passes on, deployable CloudFormation,
  Markdown for the proposal, Mermaid, JSON, or PNG/SVG/PDF of the whole drawing. Bring a
  CloudFormation template back and the drawing rebuilds itself, priced, with a diff you approve
  first. A CDK stack we wrote comes back whole, because it carries the drawing in a comment block.
- **A drawing in a link.** Your coding agent has your repo but cannot call this page's tools. It can
  hand you a URL: the whole document rides in the fragment (compressed, about a kilobyte for a real
  drawing), or points at a raw file in your repo, and the page opens with the drawing loaded and the
  diff shown. No upload, no account, no backend, and a fragment never reaches a server.
- **You are not designing alone.** Press **Live** and the URL becomes a room: send the link, and other
  people (and their agents) are in the same document, with cursors, presence and every change
  arriving as it happens. The room has one drawing (join and you take the room's, you never merge two
  architectures into one), the person who started it hosts it, and when they leave it closes for
  everyone. A room takes up to eight people, expires after eight hours, and stores nothing anywhere.
- **Your bill, never uploaded.** Drop a Cost Explorer CSV on the canvas and real spend lands on real
  resources. It is parsed in the tab. There is no backend to send it to.

No login and no keys. The app itself is a page: no account, no database, no server that owns your
drawing, and every tool runs in your tab. Collaboration adds one thing and only when you ask for it ·
a WebSocket relay that forwards messages between the browsers in a room and keeps nothing. The
drawing is never stored on a server; while a room is open, its changes pass through one.

## How we built it

**The engine is pure TypeScript and knows nothing about React or the DOM.** Model, pricing, cost,
findings, containment, layout, exporters, importers: all of it is testable in isolation, and cost,
findings and deltas are derived selectors, never stored. That constraint is what let the same code
back the UI, the tools and the tests.

**One definition per service is the spine.** `defineService()` declares a service's settings schema,
which of them drive price, which are security, its price function, its CDK, and its CloudFormation in
both directions. From that single definition come the Inspector form, the card, the security badge,
`set_property`'s validation, `list_services` for the agent, pricing, the CDK export, the
CloudFormation export and the CloudFormation import. One vocabulary for the human and the agent, and
`defineService()` refuses a service that can write a template it cannot read back.

**The room is the same document, over a wire.** A person dragging a resource and an agent calling
`patch_state` put the identical thing on the wire: a partial document addressed by id. That decision
predates the room by weeks · ids were chosen over array indices because an agent's copy of the state
goes stale the moment a human moves something. It turned out to be exactly what makes two people
editing at once merge instead of clobber, so multiplayer needed a transport and no redesign.
Everything arriving from a room is validated by the same `applyPatch` an agent's tool goes through.

**WebMCP, imperatively, in the top-level document.** A single `'use client'` provider registers
`document.modelContext.registerTool(...)` after hydration, with `navigator.modelContext` as a
fallback. 38 tools live, 42 while a scenario is open: the extra four are registered under one
`AbortController` when `open_scenario` runs and aborted on commit or discard, and the tool count in
the bottom bar ticks live. Every mutation commits to the store before its tool returns, so the canvas
is never behind the agent's answer.

**Prices come from AWS, not from us.** A script pulls the Price List Bulk API, filters to the forty
SKUs the engine prices, and writes a dated file per region.

**The canvas** is React Flow with a lot of custom geometry: floating four-sided edges computed from
each node's visual shape rather than handle coordinates, container frames painted through a viewport
portal, a layered auto-layout whose columns are dependency depth and whose rows are ordered to
minimise crossing edges.

**Stack:** Next.js 15 static export, React 19, TypeScript, `@xyflow/react`, Zustand, Tailwind 4,
vitest (208 tests), deployed on Vercel.

## Challenges we ran into

- **Getting the tools to execute at all.** WebMCP is new enough that the first milestone was proving
  the pipe: `document.modelContext`, imperative API only, top-level document, after hydration.
  Removal is by `AbortSignal`, not an unregister call, which turns out to be exactly the right shape
  for "these four tools exist only while a scenario is open".
- **Tool output is capped at about 1.5K characters.** That is a real design constraint, not a
  formatting one. It forced chunked exports, filtered reads, and summaries that say what changed
  rather than dumping the state, which made the tools better.
- **The AWS Price List is not uniform.** CloudFront's rates live only in the global file, keyed by
  geography. EventBridge's offer code is `AWSEvents`. KMS is lower-case `awskms` and its usage types
  carry the full region name. Secrets Manager writes `-Secret` in one region and `-Secrets` in
  another. CloudWatch Logs shares a file with a hundred other line items, so ingestion has to be
  matched on the operation. Every one of those was found by a wrong number on the canvas.
- **Frames that could not be touched.** Container frames are painted through React Flow's viewport
  portal, which inherits `pointer-events: none`, so for a while they simply ignored every click. The
  fix was opting the handles back in explicitly and getting the stacking order right, since a node's
  artwork was painted over its own connection handles.
- **A live JSON editor that does not fight its user.** The Code panel applies as you type, but the
  canvas is also writing to the same document. It only re-seeds the text when the panel is not dirty
  and does not have focus, and it remembers its own writes so the round trip never reformats what you
  are typing mid-keystroke.
- **Auto-layout that actually reduces crossings.** The first version ordered rows with a single
  forward pass and parked child frames in a row underneath, which is what made the event-driven
  sample look tangled: the edge into the VPC had to leave the bottom of the region and cut back
  across two other edges. Two plausible fixes measured no better before the real one landed: rank a
  child frame as a box in the same flow, so the VPC takes the column after the thing that feeds it. A
  test now counts crossings geometrically on the real output, and the samples are at zero.
- **Pictures that came out with no icons.** The exporter serialises the canvas into an isolated
  document, where every `<use href="#aws-...">` resolved to nothing. The sprite has to ride along
  inside the captured subtree.

## Accomplishments that we're proud of

- **The agent audits its own work.** Ask it to build an architecture and then ask it to check what it
  built, and it calls `get_findings`, gets back rules citing AWS docs, and fixes them. That loop is
  only possible because the tools are semantic.
- **Dynamic registration you can see happen.** The tool count ticking 38 → 42 when a scenario opens,
  and back on commit, is WebMCP doing something a screenshot cannot fake: capability appearing
  because the page's state changed.
- **The CDK export synthesises.** `npm run synth` runs `cdk synth` on all three samples plus a
  fixture holding one node of every service, in CI shape. The claim on camera is checked by a
  command.
- **CloudFormation goes both ways, and so does our own CDK.** A template we wrote comes back as the
  same drawing, positions and containers and traffic intact, because the exporter also writes the
  things a template has no place for. Somebody else's template comes back structurally, with the
  connections inferred from what references what.
- **Never a hardcoded price.** Every rate on screen traces to a SKU in a dated file with a source URL.
- **One document, three writers.** Canvas, code panel and agent all edit the same object through one
  validator, so a mistake in the JSON gets the same error an agent gets from `set_property`.

## What we learned

- **Semantic tools beat drawing primitives, and it is not close.** Hand a model shapes and
  coordinates and it produces something that looks right and means nothing. Hand it services and
  settings and it can be wrong, which means it can be corrected, which means it can be trusted with
  the next step.
- **Structured errors are a feature for the agent, not a nicety.** "Unknown setting, here are the
  valid ones" is the difference between an agent recovering by itself and a human translating.
- **Constraints improve the surface.** The output cap forced summaries instead of state dumps. No
  backend forced everything into the page, which is what makes it work for a visitor with no account.
- **WebMCP changes who gets to offer capability.** Before it, only a platform big enough to ship an
  API and run an official MCP server could serve agents. Now any page can, to whatever agent the
  visitor brought: no partnership, no platform's permission, no server.
- **Measure the thing you are claiming.** "Fewer crossings" and "the CDK works" are both testable, and
  both were wrong at some point in ways that looked fine on screen.

## What's next for Overhead

1. **A CRDT, when a room needs one.** Today two people editing the same field in the same instant is
   last-writer-wins, which is honest and enough for a working session. Yjs over the same patches
   would make it exact, and the ids are already there.
2. **Resource identity that survives a repo.** Today a foreign template matches back by service and
   name. Stamping the logical id onto the node makes the second import an update, even after a
   rename.
3. **Generate the wiring.** The CloudFormation export names its stubs honestly: permissions, event
   sources and targets are not generated yet. The edges on the canvas already know what should be
   wired to what.
4. **"Visualise my architecture", the rest of the way.** The file hand-over is already gone: a coding
   agent with your repo can synthesise a template and hand you a link, and the page opens with the
   drawing loaded, priced, with a diff before anything changes. What is left is the other direction,
   the agent watching the repo rather than you clicking a link it wrote.
5. **More services, as their SKUs land:** NAT Gateway, ALB, RDS, ECS Fargate. The rule does not bend:
   never hardcode a price. A service arrives when its rate arrives.

Not on the list, and stated plainly: there is no live sync. Nothing watches a repo and nothing writes
to one. Reconciliation is a file you hand over and a diff you approve.
