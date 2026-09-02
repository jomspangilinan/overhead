# Overhead · pitch, script, and the honest roadmap

Everything the submission has to say, in the order it has to say it. The video script is §4.
What is **built** is marked "today"; what is not is marked "next" and is never implied on camera.

---

## 1. The line

**Overhead is the view from above your AWS architecture, and what it costs to run.**

Sketch a serverless AWS architecture on a live canvas, with your agent working the same canvas you
are. Every resource carries its real price from the AWS Price List. Fork the design, compare the
delta, fix what the findings flag, then export it as CDK, Markdown, Mermaid, PNG, SVG, PDF, or a
JSON state file that reloads.

---

## 2. Why this is a WebMCP app and not a website with an API

The challenge's framing: *WebMCP lets a website expose structured tools an agent can use directly,
so it does not have to guess its way through the UI.*

Overhead is built so that the agent and the person are working the **same document**, not two copies
of it:

- **33 tools live, 37 with a scenario open.** They are semantic (`add_service`, `connect`,
  `set_property`, `get_findings`, `open_scenario`, `move_into_container`, `export`), never drawing
  primitives. The agent never says "draw a rectangle at 420, 180".
- **Dynamic registration is visible.** `open_scenario` registers four more tools under one
  `AbortController`; the bottom bar's count ticks 33 → 37 and back on commit or discard. That is a
  capability appearing because the app's state changed, which is the part of WebMCP a screenshot
  cannot fake.
- **Every mutation commits to the store before the tool returns**, so the canvas the person is
  looking at is never behind the agent's answer.
- **The errors are structured and resolvable**: unknown container, unknown node, a frame nested
  inside itself. The agent can fix its own mistake without a human translating.
- **Hints are honest**: read tools carry `readOnlyHint`, anything returning parsed bill content
  carries `untrustedContentHint`.
- **No backend, no login, no key.** The page is the server. The tools ship with the page.

The open-web point, for the write-up:

> Before WebMCP, only platforms big enough to ship an API and run an official MCP server could offer
> capability to an agent. Now any web page can offer it to whatever agent the visitor brought. No
> platform's permission, no partnership, no backend.

---

## 3. Why this beats a draw.io or Lucidchart MCP

A diagram MCP lets an agent **draw**. Overhead lets an agent **design**. The difference is what the
tools are made of.

| | draw.io / Lucidchart via MCP | Overhead |
|---|---|---|
| Vocabulary | shapes, arrows, coordinates, styles | services, connections, settings, containers, traffic |
| What the model has to know | your visual conventions, and where 420,180 is | AWS: what a Lambda's architecture setting does |
| Truth in the file | a picture of an architecture | the architecture · nodes with typed settings, priced |
| Cost | none | every resource priced from the AWS Price List Bulk API, per SKU, with a source URL |
| Review | none | nine findings, each citing an AWS doc and a monthly saving |
| What-if | duplicate the page, redraw | fork, edit, read the delta per resource, commit or discard |
| Output | an image, or XML nobody deploys | CDK TypeScript that `cdk synth` passes on, plus Markdown, Mermaid, JSON, PNG, SVG, PDF |
| Wrong answers | a valid-looking picture | a refusal with a reason, or a finding that names the doc |

Put bluntly: a drawing tool with an MCP server produces **a picture that cannot be wrong, because it
means nothing**. Overhead's canvas has a semantic underneath it, so it can be wrong, which is exactly
why it is worth an agent's time: the number moves, the finding fires, the export compiles.

---

## 4. Video script · under 3:00, audio, public on YouTube

Record at 1600 × 1000, dark room, `ap-southeast-1`, canvas empty at the start (dismiss the HowTo
banner). Speak in short sentences over each action, do not read the UI aloud.

| Time | On screen | Said |
|---|---|---|
| 0:00 – 0:12 | AWS Pricing Calculator in one tab, a spreadsheet in the other. Close both. | "This is how we price a build today. Neither of these knows what the architecture looks like." |
| 0:12 – 0:22 | Overhead, empty canvas, in the ChatGPT desktop app's browser. The address-bar arrow icon goes grey. Bottom bar reads the live tool count. | "This is one web page. No backend, no login. It offers thirty-three tools to whatever agent you brought." |
| 0:22 – 0:55 | Type one sentence: *"HTTP API to Lambda to DynamoDB, S3 uploads behind CloudFront, SQS for thumbnails, about five million requests a month."* Nodes land inside AWS Cloud › ap-southeast-1. The monthly total in the top bar counts up. | "I describe it. It builds it, and prices every resource from AWS's own price list, not from a number we typed in." |
| 0:55 – 1:12 | Ask: *"Now check your own work."* Agent calls `get_findings`; two rings appear; it switches the Lambda to arm64 and adds a DLQ. Total drops. | "Then it audits what it just built. Nine rules, each citing an AWS doc. It fixed two of them itself." |
| 1:12 – 1:40 | Click **Scenario**. Banner appears, the change list says nothing has changed yet, bottom bar ticks **33 → 37**. Set the thumbnail Lambda to 1024 MB. The node takes a ring, the change list shows `memoryMb 512 → 1024` and the per-resource delta; the total goes **down**. Click **Commit**. Count ticks back to 33. | "A scenario is a fork of the whole design. More memory, lower bill, because it finishes faster. And watch the tool count: four tools exist only while this fork is open. That is WebMCP's dynamic registration, live." |
| 1:40 – 2:00 | Toolbar **T**, click the API. The path downstream lights and the edges run; the pill reads the hop count and what that path costs. | "Trace one request. This is what this path costs a month, on its own." |
| 2:00 – 2:15 | Drag a Cost Explorer CSV onto the canvas. Real spend lands on the resources. | "Your actual bill, parsed in the tab. It never leaves the browser." |
| 2:15 – 2:45 | **Export**: PNG preview of the whole drawing, then Markdown, then CDK. Paste the Markdown into a doc; hand the CDK to the coding agent, which writes it into a repo and runs `cdk synth`. | "Out as a picture for the deck. Out as Markdown for the proposal. Out as CDK, and it synthesises." |
| 2:45 – 2:55 | Back on the canvas, whole design, total in the corner. | "An architecture, a price, and a review. On one page, with your agent, in three minutes." |

**Cuts if long:** the bill drop (0:12) and the trace (0:15). **Never cut:** the tool count ticking on
`open_scenario`, the findings loop, the CDK export.

---

## 5. The four write-up prompts

**What it does.** Sketch a serverless AWS architecture with your agent on a live canvas, priced from
the AWS Price List per SKU, reviewed by nine rules that each cite an AWS doc, forkable into what-if
scenarios with a per-resource delta, and exportable as CDK, Markdown, Mermaid, JSON, PNG, SVG or PDF.

**How WebMCP is used.** 33 semantic tools in seven families, registered imperatively on
`document.modelContext` in the top-level document after hydration; four more registered dynamically
under an `AbortController` for the life of a scenario, with the live count on screen. Read tools are
hinted read-only, bill content is hinted untrusted, every mutation commits before the tool returns,
and errors are structured so an agent can resolve them itself.

**Who it is for.** Consultancies pricing a build before the proposal goes out. Teams triaging a bill
that jumped. Engineers learning AWS, because nothing teaches architecture faster than watching a
number move.

**What is next.** The infrastructure-as-code round trip, and more services. See §6, which is the
truth about both.

---

## 6. Roadmap · what is true today, and what is not

**Today.**
- Ten services: Lambda, API Gateway, DynamoDB, S3, CloudFront, SQS, SNS, EventBridge, Step
  Functions, Cognito. Serverless first, on purpose: those are the services whose cost is a function
  of traffic, which is the thing nobody can estimate in a spreadsheet.
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

**Not built. Say so plainly if asked.**
- **No live sync.** Nothing watches a repo and nothing writes to one. Reconciliation is a file you
  hand over and a diff you approve, not a daemon.
- **No Terraform, no SAM directly** · though a SAM template is CloudFormation, and Terraform with a
  plan could be mapped onto the same table.
- **No CDK app import.** The template is the interchange format, deliberately: reading a synthesised
  template works for CDK, SAM and CloudFormation alike without parsing anybody's TypeScript.

**Next, in the order it is worth doing.**
1. **Resource identity that survives a repo** · today a foreign template matches back by service and
   name. Stamping the logical id into the node would make a second import an update even after a
   rename.
2. **The wiring, generated** · the CloudFormation export names its stubs honestly (permissions,
   event sources, targets are not generated). The edges on the canvas already know what should be
   wired to what.
3. **"Visualise my architecture"** · this is the real destination. A coding agent has your repo; the
   page has the tools. The agent reads the stack, calls `add_service` and `connect` on the open page,
   and the diagram appears priced, without an export step or a file to move. Today an agent can do a
   crude version of this already, by building the JSON and calling `import_state` · the tools accept
   it. Step 1 above is what makes it exact.
5. **More services**, once each has a real SKU in the price list: NAT Gateway, ALB, RDS, ECS Fargate.
   The rule does not bend: **never hardcode a price**. A service arrives when its rate arrives.

---

## 7. Recording checklist

- [ ] `npm run dev`, seeded canvas cleared, HowTo dismissed, right dock open, zoom 100%
- [ ] ChatGPT desktop app browser on the deployed URL, address-bar arrow icon visible
- [ ] Bottom bar tool count legible in the frame (it has to be readable when it ticks 33 → 37)
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

**"Why serverless only?"** Because that is where the estimate is hard and the drivers are real:
requests, duration, memory, storage class. An EC2 hourly rate does not need a tool.
