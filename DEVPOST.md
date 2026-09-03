# Devpost · copy-paste ready

*WebMCP is the star. Sell the ceiling, don't count inventory. Never name a competitor — rebuttals are in `SCRIPT.md`.*

---

## Project name

```
Overhead
```

## Elevator pitch

```
A web page that turns any agent into a cloud architect — and lets you draw alongside it, live.
```

---

## Inspiration

I wanted less friction between proposing a project and starting one.

So I pointed agents at the diagramming tools I had. Connecting one took permissions that weren't mine
to grant. Once it worked, it overwrote my edits — I'd move something, it would redraw from memory, my
change was gone. Slow, and piles of SVG to say very little. I ended up with a picture: no number for
the proposal, nothing to hand a repo.

The overwriting isn't a bug. It's the arrangement — the agent holds a copy, and my next move makes it
wrong.

WebMCP changes the terms: a page hands tools straight to whatever agent shows up. No API, no install,
no admin.

So there is no copy. My drag and the agent's patch are one operation on one document, addressed by id.
And that document exports as both ends of what I wanted — the proposal's numbers, and the repo's code.

## What it does

**Gives your agent somewhere to work, and you a canvas you're standing at too.**

- **39 tools from a page.** `add_service`, `connect`, `set_property`, `get_findings`, `patch_state` —
  the architect's vocabulary, never "draw a rectangle at 420,180."
- **Capability that appears with state.** Open a scenario, four more tools register under an
  `AbortController`. The count goes **39 → 43**, then back on commit.
- **Real prices.** Per SKU from the AWS Price List Bulk API, each rate keeping its source URL. No
  hardcoded rate anywhere.
- **It reviews itself.** Rules cite an AWS doc and a monthly saving. Ask the agent to check its own
  work and it fixes what it flagged.
- **It argues back.** Bad setting → allowed values. Illegal nesting → refused with the rule.
- **It compiles.** CDK that `cdk synth` passes, deployable CloudFormation, Markdown, Mermaid, JSON,
  PNG, SVG, PDF. CloudFormation comes back in, priced, diff first.
- **Paste a picture, get a design.** Any Mermaid flowchart. `[Lambda]` arrives priced; `{approved?}`
  arrives as a decision; a subgraph titled VPC becomes a VPC. It goes back out with every AWS service
  drawn as its official icon, so the document renders as an architecture in mermaid.live and not as
  grey boxes · and there is a third tab in the dock that edits the drawing *as* Mermaid, live.
- **Not only AWS.** Six flow shapes go through the same definition spine as the sixteen services, so
  a decision or a third-party system is a first-class object the agent can add. They carry no price,
  because a box labelled "billing team approves" has no SKU · a flowchart shows **$0.00** and no
  price list at all.
- **You're both editing.** Press Live and the URL is a room — your colleague and their agent, same
  document.

No login, no keys, no backend. Every tool runs in the visitor's tab.

## How we built it

- **Patches by id, not index.** An index needs the agent's view to be current. It never is. An id
  survives me dragging and renaming mid-thought. Chosen before multiplayer existed — then multiplayer
  needed only a transport.
- **One validator.** Canvas, JSON panel, agent tool and peer message all go through `applyPatch`. A
  peer can't set something your own build would refuse.
- **`defineService()` is the spine.** One definition gives the Inspector form, `set_property`
  validation, `list_services`, pricing and every export. Human and agent can't drift. A new diagram
  language is a data edit, not a fork — that's how flowcharts landed.
- **WebMCP, imperative, top-level.** `registerTool` after hydration, `AbortSignal` for removal, read
  tools hinted read-only, every mutation committed before its tool returns.

**Stack:** Next.js 15 static export, React 19, TypeScript, `@xyflow/react`, Zustand, Tailwind 4,
vitest, Vercel. Only server: a ~40-line WebSocket relay for rooms, storing nothing.

## Challenges we ran into

- **The AWS Price List isn't uniform.** CloudFront lives only in the global file. EventBridge's offer
  code is `AWSEvents`. Secrets Manager writes `-Secret` in one region, `-Secrets` in another. Each was
  found by a wrong number on the canvas.
- **Tool output caps at ~1.5K chars.** It forced summaries of what changed instead of state dumps.
  Made the tools better.
- **One grammar per drawing.** A decision diamond next to a Lambda asserts two things and means
  neither. The samples teach the split; the engine doesn't forbid it.
- **A JSON editor that doesn't fight you.** It applies as you type while the canvas writes to the same
  document, so it re-seeds only when clean and unfocused.

## Accomplishments that we're proud of

- A human and an agent edit one document at once — and the wire format proves it's one document.
- Multiplayer arrived nearly free, because the patch format was already agent-shaped.
- The agent audits its own work and fixes what it finds.
- **39 → 43** on screen: capability appearing because state changed. A screenshot can't fake it.
- `npm run synth` runs `cdk synth` on every sample. The claim on camera is checked by a command.

## What we learned

- **Design for the agent's staleness first.** Every frustration traced to the agent working from a
  copy my next move invalidated. Fix the addressing and the tools, the JSON panel and multiplayer all
  fall out.
- **Shapes are slow; meaning is fast.** Piles of SVG to say "there's a Lambda here" — or one
  `add_service` call. Less on the wire, more to reason about.
- **Semantic tools can be wrong**, which means they can be corrected, which means they can be trusted
  with the next step. Coordinates can only look right.
- **WebMCP changes who gets to offer capability.** Before, you needed a platform. Now a page will do.

## What's next for Overhead

- **More vocabularies.** Sequence diagrams, org charts, network topology, other clouds — each a
  definition file, and the agent's tools come free with it.
- **A CRDT when a room needs one.** Same-instant edits are last-writer-wins today; the ids are already
  there for Yjs.
- **Generate the wiring.** The edges already know what should be connected to what.
- **More services as their SKUs land.** Never hardcode a price.

**Plainly:** no live sync. Nothing watches a repo. Reconciliation is a file you hand over and a diff
you approve.
