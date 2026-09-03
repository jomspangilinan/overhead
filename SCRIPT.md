# Overhead · pitch, script, and the honest roadmap

Everything the submission has to say, in the order it has to say it. The video script is §4.
What is **built** is marked "today"; what is not is marked "next" and is never implied on camera.

---

## 1. The claim

> **An agent can draw you an AWS diagram today. It cannot tell you that diagram is wrong, or what it
> will cost, and it cannot sit at the table while your team argues about it. Overhead does all three ·
> because what it hands the agent is not a canvas, it is a design, and the design is a room.**

That sentence is the spine of the submission. Every section below, and every beat of the video, is
evidence for it. **If something does not support it, it is cut** · that is the only editing rule
here, and the reason the bill drop and the trace tool are not in the cut even though both work.

### Where it came from

Every time I document an architecture I do the same three jobs in three tools that do not know about
each other. I draw it in a tool that knows nothing about AWS · it has boxes, I supply the meaning. I
price it in the AWS Pricing Calculator, which knows nothing about my drawing · I re-type the design
as line items, and re-type it again when the design moves. I write the doc, which knows about
neither, so it is wrong the moment either changes and nobody can tell by looking.

There is no native thing for this. AWS ships a calculator with no topology and a console with no
drawing; everything else is a canvas with no idea what it is drawing.

Then agents arrived, and the first thing everyone did was point one at a drawing tool. Which made
the gap worse, not better: now the picture is produced faster, and it still means nothing. **An agent
drawing rectangles has automated the part that was never the hard part.** The hard part is knowing
that this API should be HTTP and not REST, that this Lambda at 512 MB and 900 ms costs more than the
same Lambda at 1024, that an async consumer with no dead-letter queue is a bug you cannot see in a
picture. So Overhead gives the agent that vocabulary instead · and then I stand at the same canvas
and work next to it.

### What "a design, not a picture" buys, concretely

A picture cannot be wrong, because it does not assert anything. A design can be wrong, which is the
entire point:

- **It has a number.** Every resource is priced from the AWS Price List Bulk API per SKU, with the
  source URL kept. Change a setting and the number moves, because the setting is what the price is a
  function of.
- **It can be reviewed.** Nine rules read the design and fire on it, each citing an AWS doc and a
  monthly saving. The agent runs them on its own work.
- **It can be argued with.** `set_property` refuses an invalid value with the allowed set;
  `move_into_container` refuses a cycle. The agent resolves its own mistake without me translating.
- **It compiles.** The export is CDK TypeScript that `cdk synth` passes, and CloudFormation that
  deploys · not XML nobody runs.
- **It survives the round trip.** A template or a stack we wrote comes back as the same drawing,
  positions and all, with a diff before anything changes.
- **It can be worked on together.** Press Live and the URL becomes a room: other people open the
  link, you see their cursors and what they have selected, and everybody's agent is in the same
  document. The room has one drawing and one host: joining takes the room's drawing rather than
  merging yours into it, and when the host leaves the room closes. Nothing is designed alone in real life, and a design that only one person can hold is
  back to being a picture somebody emails around.

---

## 2. The proof: draw versus design

This is the argument, not a footnote. A diagram MCP lets an agent **draw**; Overhead lets an agent
**design**. The difference is what the tools are made of.

| | draw.io / Lucidchart via MCP | Overhead |
|---|---|---|
| Vocabulary | shapes, arrows, coordinates, styles | services, connections, settings, containers, traffic |
| What the model has to know | your visual conventions, and where 420,180 is | AWS: what a Lambda's architecture setting does |
| Truth in the file | a picture of an architecture | the architecture · typed resources with priced settings |
| Cost | none | every resource from the AWS Price List Bulk API, per SKU, with a source URL |
| Review | none | nine findings, each citing an AWS doc and a monthly saving |
| What-if | duplicate the page, redraw | fork, edit, read the delta per resource, commit or discard |
| Output | an image, or XML nobody deploys | CDK that `cdk synth` passes, CloudFormation that deploys, plus Markdown, Mermaid, JSON, PNG, SVG, PDF |
| Back in | nothing | a template or our own stack, reconciled with a diff you approve |
| Wrong answers | a valid-looking picture | a refusal with a reason, or a finding that names the doc |

Put bluntly: **a drawing tool with an MCP server produces a picture that cannot be wrong, because it
means nothing.** Overhead's canvas has a semantic underneath it, so it can be wrong · which is
exactly why it is worth an agent's time.

---

## 3. Why that needs WebMCP, and not an API

The challenge's framing: *WebMCP lets a website expose structured tools an agent can use directly, so
it does not have to guess its way through the UI.* Here that is not a delivery mechanism, it is the
claim's mechanism · the design has to be **live, shared and in front of both of us**, or it is just a
file format.

- **38 tools live, 42 with a scenario open**, and they are semantic (`add_service`, `connect`,
  `set_property`, `get_findings`, `open_scenario`, `move_into_container`, `export`). The agent never
  says "draw a rectangle at 420, 180" · it says what it means, in the words I use.
- **We edit one document, and both of us can see it.** The right dock's **Code** tab is the drawing
  as JSON, live in both directions · type in it and the canvas redraws, drag on the canvas and the
  text follows, put the caret in a resource and it lights on the diagram. `get_state` and
  `patch_state` are the agent's half, addressed by id, through the same validator. This is what
  "working next to it" actually means, and it is visible on camera.
- **Dynamic registration is visible.** `open_scenario` registers four more tools under one
  `AbortController`; the bottom bar ticks 38 → 42 and back on commit or discard. A capability
  appearing because the state changed is the part of WebMCP a screenshot cannot fake.
- **Every mutation commits before the tool returns**, so the canvas I am looking at is never behind
  the agent's answer.
- **Hints are honest**: read tools carry `readOnlyHint`, parsed bill content carries
  `untrustedContentHint`.
- **No backend for the product, and one wire for company.** The app is a page: no account, no
  database, no server that owns your drawing, and every tool runs in your tab. Pressing **Live** adds
  exactly one thing · a WebSocket relay (`app/api/room/route.ts`, ~40 lines) that forwards messages
  between the browsers in a room. It has no storage, holds nothing after the last person leaves, and
  a room stops accepting anyone after eight hours. Say it precisely on camera: *the drawing is never
  stored on a server; while a room is open its changes pass through one.* Without a room id in the
  URL, nothing in the app ever contacts it.
- **The room moves patches, not drawings, and they are the agent's patches.** A person dragging a
  resource and an agent calling `patch_state` put the identical thing on the wire: a partial document
  addressed **by id**. That was chosen long before there was a room, because an agent's copy of the
  state goes stale the moment a human moves something · and it is exactly the property that lets two
  people edit at once without clobbering each other. Everything arriving from the room is validated
  by `applyPatch`, the same door the agent's tool goes through, so a peer cannot put a setting on
  your canvas that your build would refuse.

The open-web point, for the write-up:

> Before WebMCP, only platforms big enough to ship an API and run an official MCP server could offer
> capability to an agent. Now any web page can offer it to whatever agent the visitor brought. No
> platform's permission, no partnership, no backend.

---

## 4. Video script · under 3:00, audio, public on YouTube

Record at 1600 × 1000, dark room, `ap-southeast-1`. Speak in short sentences over each action, do not
read the UI aloud.

**Two rules, both from §1.**

1. **Every beat is evidence for one sentence:** an agent can draw, this one designs. A beat that only
   shows a feature is cut, however good the feature is.
2. **I am the protagonist, the agent works beside me.** I drag, rename and place things with my own
   hands while its calls land in the strip. Not a prompt demo · a person and an agent on one canvas.
   Never say "watch it go"; say what we are each doing.

### 4a. The hook · first eight seconds

A judge on entry seventeen of forty decides in three seconds, so the video does not open on my
workflow pain · it opens on the gap the claim lives in. Two shots, no cursor tour:

**Shot A (0:00–0:04):** a drawing tool with an MCP server, agent-drawn AWS rectangles. Neat. Silent.
**Shot B (0:04–0:08):** hard cut to Overhead, the same architecture, a monthly total resolving in the
top bar and an amber finding ring on one node.

> **"An agent can draw you an AWS diagram today.**
> **It can't tell you the diagram is wrong, or what it costs. This one does both."**

Say it flat. Do not say "introducing", do not name the product · the brand is in the top bar from
0:08 and a name means nothing until the viewer wants one.

**Alternates, if that read does not land in the booth.** Same two shots:

- *"That diagram is a picture. This one is a design · it costs five hundred and eleven dollars a
  month, and it just told me two things are wrong with it."*
- *"Both of these were drawn by an agent. Only one of them knows what it's looking at."*

**The same claim in text**, for the Devpost tagline and the README's first line:

> **An agent can draw an AWS diagram. This one can tell you it's wrong · and what it costs.**

| Time | On screen | Said |
|---|---|---|
| 0:00 – 0:08 | **Cold open.** §4a: agent-drawn rectangles in a drawing tool, hard cut to the same architecture here · total resolving, one finding ring. | "An agent can draw you an AWS diagram today. It can't tell you the diagram is wrong, or what it costs. This one does both." |
| 0:08 – 0:22 | The drawing tool's MCP call in view: a shape, a position, a style. Then Overhead's bottom bar: the tool list open, `add_service`, `set_property`, `get_findings`. | "The difference is what the agent is handed. Over there, shapes and coordinates. Here, thirty-eight tools that speak AWS · services, settings, connections. One page, no backend, no login." |
| 0:22 – 0:52 | Empty canvas. One sentence: *"HTTP API to Lambda to DynamoDB, S3 uploads behind CloudFront, SQS for thumbnails, about five million requests a month."* Resources land inside AWS Cloud › ap-southeast-1, laid out left to right, arrows not crossing. The total counts up. | "I describe it, it builds it. Not shapes · resources, carrying the settings that decide what they cost, priced from AWS's own price list. That number is not one I typed." |
| 0:52 – 1:16 | **Both of us working.** I drag the worker into the private subnet and rename it by hand; the strip shows the agent's `set_property` land in the same seconds. Then I ask: *"Check your own work."* `get_findings`, two rings; it moves the Lambda to arm64, adds a DLQ; the total drops. | "And I'm not watching it work · I'm working next to it. I move this into the subnet, it changes that. Then I ask it to review what we both just did. Nine rules, each citing an AWS doc. It fixed two itself · that's the part a picture can't do." |
| 1:16 – 1:34 | Right dock → **Code**. The drawing as JSON. Caret into a resource · it lights on the canvas. Change `memoryMb` in the text · the node and the total move. | "This is the same document, as code. I type in it, the agent patches it by id, and neither of us is guessing what the other did." |
| 1:34 – 1:52 | **Live**. The URL gains a room id, the pill goes green, the link is copied. A second window opens it: two cursors on one canvas, each with a name. The other person drags the worker into the subnet while my agent is still answering · both land. | "And this is not a drawing I own. Press Live and the URL is a room · my colleague opens the link, and their agent is in the same document as mine. No account, nothing stored on a server: the page just passes our changes to each other." |
| 1:52 – 2:18 | **Scenario**. Bottom bar ticks **38 → 42**. Thumbnail Lambda to 1024 MB: the node rings, the change list reads `memoryMb 512 → 1024` with the per-resource delta, the total goes **down**. **Commit**; count back to 38. | "A scenario forks the whole design · more memory, lower bill, because it finishes faster. And watch the count: four tools exist only while this fork is open. The page hands the agent new capability because its state changed." |
| 2:18 – 2:42 | **Export**: PNG of the whole drawing, Markdown into the doc, then CDK handed to the coding agent, which writes it into a repo and runs `cdk synth` · green. Then **Import** the same stack back: the drawing rebuilds itself, priced. | "And because it's a design, it compiles. Picture for the deck, Markdown for the proposal, CDK for the repo · and it synthesises. Hand it back and the drawing comes back with it." |
| 2:42 – 2:55 | Back on the canvas, whole design, total and findings legible · the cold open's frame. | "An agent that draws gives you a picture. This one gives us something we can price, review and deploy · with everyone who has to sign off standing at the same canvas." |

**Cuts if long:** the import, then the Code tab (the Live beat shows the shared document too). **Never cut:** the hook's two shots, the
findings loop, the tool count ticking on `open_scenario`, the CDK synth.

**Not in this cut, on purpose:** the bill drop and the trace tool. Both work, both demo well, and
neither is evidence for the claim · they are answers in §8 if a judge asks.

**The last frame is a hook too.** Hold the finished drawing, total and rings legible, for a beat after
the last word · it is the frame YouTube freezes on, and it is the cold open's image, which is what
makes three minutes feel closed rather than stopped.

---

## 5. The four write-up prompts

**What it does.** An agent can draw an AWS diagram today; it cannot tell you the diagram is wrong or
what it costs, because a drawing tool hands it shapes. Overhead hands it a design: sketch a
serverless AWS architecture on a live canvas, every resource priced from the AWS Price List per SKU,
reviewed by nine rules that each cite an AWS doc, forkable into what-if scenarios with a per-resource
delta, exportable as CDK, CloudFormation, Markdown, Mermaid, JSON, PNG, SVG or PDF, and importable
back from a CloudFormation template or a stack it wrote, with a diff before anything changes. You and
your agent work the same document, at the same time.

**How WebMCP is used.** 38 semantic tools in nine families, registered imperatively on
`document.modelContext` in the top-level document after hydration; four more registered dynamically
under an `AbortController` for the life of a scenario, with the live count on screen. The vocabulary
is the one the person uses · services, settings, connections, containers, traffic · never drawing
primitives, and `get_state` / `patch_state` let the agent edit the exact document the Code panel shows
a human, by id, through the same validator. Read tools are hinted read-only, bill content is hinted
untrusted, every mutation commits before the tool returns, and errors are structured so an agent can
resolve them itself.

**Who it is for.** Anybody who has to hand over an architecture and a number in the same week.
Consultancies pricing a build before the proposal goes out. Teams triaging a bill that jumped.
Engineers learning AWS, because nothing teaches architecture faster than watching a number move.

**What is next.** More services as their SKUs land, and turning the reconciliation into something
that watches a repo rather than a file you hand over. §6 is the truth about both.

---

## 6. Roadmap · what is true today, and what is not

**Today.**
- Sixteen services: Lambda, API Gateway, DynamoDB, S3, CloudFront, SQS, SNS, EventBridge, Step
  Functions, Cognito, Kinesis Data Streams, Data Firehose, KMS, Secrets Manager, Parameter Store,
  CloudWatch Logs. Serverless first, on purpose: those are the services whose cost is a function
  of traffic, which is the thing nobody can estimate in a spreadsheet. The last four are the
  plumbing that never makes it onto a diagram and always makes it onto the bill · **encryption is
  not free** ($1 per customer managed key version per month, plus every request), a secret is $0.40
  a month where a standard parameter is nothing, and CloudWatch Logs ingestion at $0.50 to $0.70 a
  GB regularly costs more than the Lambda that wrote the log.
- Pricing for `us-east-1` and `ap-southeast-1`, generated from the AWS Price List Bulk API, each SKU
  keeping its source URL.
- **CDK TypeScript export**, one stack, one construct per resource, `cdk synth` passing on all three
  samples.
- **CloudFormation, both directions.** Export writes deployable YAML; `import_cloudformation` (and
  the Import button, and dropping a template on the canvas) turns YAML or JSON back into a priced
  drawing. Our own template round-trips exactly, because the exporter also writes a
  `Metadata.Overhead` block holding the things a template has no place for: positions, containers,
  sections, traffic, and the settings that only drive price. Somebody else's template is read
  structurally: resources match services by CloudFormation type, `Properties` become settings
  through the same per-service definitions that write them, VPCs and subnets become containers, and
  the connections are inferred from what references what (`Ref`, `Fn::GetAtt`, `Fn::Sub`, and the
  connector resources · an `EventSourceMapping` *is* the queue-to-function arrow). YAML is read
  without a dependency, short-form `!Ref` / `!GetAtt` included.
- **Reconciliation**, which is what stands in for a sync. `diff_cloudformation` names every
  difference between a template and the drawing · added, removed, and which settings changed · and
  the import dialog shows the same list before anything happens. **Replace** takes the template.
  **Merge** takes it only where it speaks: resources the template lacks stay, positions and sections
  stay, and the settings CloudFormation has no home for (traffic, durations, storage) are never
  reset to a default.
- **JSON state** exports and imports, through the UI and through the `export` / `import_state` tools.
- **A drawing in a link.** `https://…/#doc=<base64url of the document>` opens the app with that
  document loaded into the Import dialog; `#p=` is the same thing deflated (a real drawing is a 1 KB
  link instead of 5 KB), and `#template=<https url>` fetches a raw file from where it already lives.
  Nothing is uploaded and there is no backend to upload to · a fragment is never sent to a server,
  and the page is a static export. `#doc=` stays plain on purpose: a coding agent that has your repo
  cannot call this page's tools, but it can build that URL in one line of any language.
  `share_link` does the same from inside the page.
- **CDK back in, for a stack we wrote.** The generated stack carries the drawing in a comment block ·
  the same block the template carries in `Metadata.Overhead`, read by the same code · so a stack
  exported from here comes back whole, positions and all. A stack exported before that block existed
  still comes back as its resources, read from the label above each construct. Anybody else's CDK
  does not, and that is not a gap to close: CDK is a program with loops and lookups that does not say
  what it builds until it is run. The dialog says so and gives you the command that runs it
  (`cdk synth > template.yaml`), which is the same reason the template is the interchange format.
- **The drawing as a live document.** The Code tab in the right dock is the JSON, editable, applied
  as you type; the caret picks out the resource or connection it is inside and lights it on the
  canvas. `get_state` and `patch_state` are the agent's half of it · partial objects merged **by id**
  (an agent's array index goes stale the second a human drags something), settings merged one level
  deep, all-or-nothing, with the failing field named in the error.
- **Auto-layout that does not tangle.** Columns are dependency depth, rows are ordered to minimise
  crossings (placeholder vertices for edges that skip a column, median sweeps in both directions),
  and a container is a box in that flow rather than a shelf underneath it, so a VPC sits in the
  column after the thing that feeds it. The three samples lay out with zero crossing edges, and a
  test counts them geometrically so that stays true.

**Not built. Say so plainly if asked.**
- **No live sync.** Nothing watches a repo and nothing writes to one. Reconciliation is a file you
  hand over and a diff you approve, not a daemon.
- **No Terraform, no SAM directly** · though a SAM template is CloudFormation, and Terraform with a
  plan could be mapped onto the same table.
- **No CDK app import for somebody else's app.** Ours round-trips through the block it carries; a
  foreign stack has to be synthesised first. The template is the interchange format deliberately:
  reading a synthesised template works for CDK, SAM and CloudFormation alike without parsing
  anybody's TypeScript, and a program cannot be read without running it.

**Next, in the order it is worth doing.**
1. **Resource identity that survives a repo** · today a foreign template matches back by service and
   name. Stamping the logical id into the node would make a second import an update even after a
   rename.
2. **The wiring, generated** · the CloudFormation export names its stubs honestly (permissions,
   event sources, targets are not generated). The edges on the canvas already know what should be
   wired to what.
3. **"Visualise my architecture", the rest of the way.** The file hand-over is already gone (see
   "a drawing in a link" above): a coding agent that has your repo can synthesise a template and hand
   you a URL, and the page opens with the drawing loaded, priced, diff first. What is left is the
   other direction · the agent watching the repo rather than you clicking a link it wrote, and the
   identity work in step 1 that makes the second visit an update instead of a new drawing.
4. **More services**, once each has a real SKU in the price list: NAT Gateway, ALB, RDS, ECS Fargate.
   The rule does not bend: **never hardcode a price**. A service arrives when its rate arrives.

---

## 7. Recording checklist

- [ ] `npm run dev`, seeded canvas cleared, HowTo dismissed, right dock open, zoom 100%
- [ ] ChatGPT desktop app browser on the deployed URL, address-bar arrow icon visible
- [ ] Bottom bar tool count legible in the frame (it has to be readable when it ticks 38 → 42)
- [ ] Right dock on the **Code** tab for the 1:14 shot, canvas still visible beside it
- [ ] **Cold open recorded separately**: load event-driven, let the total settle, then re-record the
      count-up by switching region so the number animates · it is the first three seconds and it has
      to be clean, with the drawing fitted and nothing else moving in frame
- [ ] Last frame held on the same image as the cold open, total legible (it is the YouTube still)
- [ ] `npm run synth` passing, so the CDK claim on camera is true
- [ ] Audio recorded separately, under 3:00 total, uploaded public

---

## 8. Answers to the questions people ask in the first minute

**"Is this just a diagram tool?"** No. The diagram is the view. The model underneath is typed
resources with priced settings, containment, and a review pass.

**"Where does the price come from?"** `scripts/fetch-pricing.ts` pulls the AWS Price List Bulk API,
filters to the SKUs the engine prices, and writes a dated file per region with a source URL per
entry. Nothing in the app has a literal rate in it.

**"Can I trust the CDK?"** `npm run synth` runs `cdk synth` on all three sample exports in CI-shaped
form. Stubs are listed in a header comment in the file itself, never hidden.

**"Does my bill leave the browser?"** No. The CSV is parsed in the tab. There is no backend to send
it to.

**"Why not just use draw.io with an MCP server?"** Because then the agent is drawing, not designing.
A drawing tool's tools are shapes and coordinates; the file it produces is a picture that cannot be
wrong, because it does not mean anything. Here the tools are services and settings, so the number
moves, the finding fires, and the export compiles · and the agent can be told it is wrong.

**"Why serverless only?"** Because that is where the estimate is hard and the drivers are real:
requests, duration, memory, storage class. An EC2 hourly rate does not need a tool.
