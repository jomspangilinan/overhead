# Video script · under 3:00

**The line:** **a web page that turns any agent into a cloud architect — and lets you draw alongside
it, live.**

Every beat is evidence for it. A beat that only shows a feature is cut — which is why the bill drop
and the trace tool aren't in this cut, even though both work.

**WebMCP is the star, not the plumbing.** This is a WebMCP hackathon: the story is that a *page* hands
capability to whatever agent the visitor brought — no install, no API key, no backend. Say that out
loud, and show the tool list and the live count on camera.

**Never compare on camera.** What we're up against is the status quo — an agent that can draw an
architecture and has no idea what it costs — not a named product. Rebuttals are at the bottom of this
doc for the Q&A. Saying a rival's name in the video makes us the challenger.

**Why it's built this way:** judges spend
[4–10 min per entry](https://help.devpost.com/article/64-judging-public-voting) and watch the video
first. Devpost judge Jono Bacon: *"You need to get your audience of judges sharing your frustration."*
Show something working inside [~90 seconds](https://blog.jetbrains.com/ai/2026/06/how-to-win-a-hackathon-notes-from-the-judging-table/).

---

## The hook · 0:00–0:12

| Shot | Screen | Said |
|---|---|---|
**Open on the thing that actually made me build this: an agent overwriting my work.**

| Shot | Screen | Said |
|---|---|---|
| **A** · 0:00–0:07 | A diagram tool with an MCP server. The agent draws. **I move one box by hand. The agent's next call redraws the page and my change is gone.** Let it sting for a beat. | "This is what I had. I move something, it redraws from the copy it remembers, and my edit's gone." |
| **B** · 0:07–0:14 | Hard cut: same architecture here. **I drag a Lambda into a subnet while the agent's `set_property` lands in the same second — both survive.** A monthly total resolves from real rates. | "There's no copy here. It adapts to me instead of overwriting me — and it knows what the thing costs." |

**Alternates** (pick in the booth):

- *"This page turns any agent into a cloud architect. No install, no API key, no admin granting anyone anything."*
- *"I didn't want a faster way to draw. I wanted to stop redoing the drawing."*
- *"Two cursors on one architecture. One's mine. One isn't a person. Neither of us is losing work."*

Say it flat. Don't name the product — the brand's in the top bar from 0:08.

---

## What the audience has to understand by 0:30

```
   me (canvas)      ──┐
   me (JSON panel)  ──┤
   my agent         ──┼──►  applyPatch  ──►  ONE DOCUMENT  ──► priced · reviewed · compiles
   their agent      ──┘     one validator     by id
   (via a Live room)
```

One line on camera: **"Everything anyone does — me, my agent, their agent — is the same operation on
the same document."**

---

## Shot list

| Time | On screen | Said |
|---|---|---|
| **0:00–0:14** | **Cold open** (above). My edit destroyed by the agent's redraw → hard cut → both edits landing together here, total resolving. | "This is what I had. I move something, it redraws from the copy it remembers, and my edit's gone. There's no copy here — it adapts to me instead of overwriting me, and it knows what the thing costs." |
| **0:12–0:26** | Bottom bar tool list open: `add_service`, `set_property`, `get_findings`, `patch_state`. Not a shape or a coordinate in sight. | "Thirty-six tools, and none of them draw. They speak AWS — services, settings, connections. So the agent says what it means, in the words I use." |
| **0:26–0:52** | Empty canvas. I type one sentence: *"HTTP API to Lambda to DynamoDB, S3 behind CloudFront, SQS for thumbnails, five million requests a month."* Resources land in AWS Cloud › ap-southeast-1, left to right, no crossing edges. Total counts up. | "It builds. Not shapes — resources, carrying the settings that decide what they cost, priced from AWS's own list. That number isn't one I typed." |
| **0:52–1:14** | **Both hands on it.** I drag the worker into the private subnet and rename it by hand; agent's `set_property` lands mid-drag. Then: *"Check your own work."* → `get_findings` → two amber rings → arm64 + a DLQ → total drops. | "I'm not watching it work, I'm working next to it. Then I ask it to review what we both just did. Nine rules, each citing an AWS doc. It fixed two itself — a picture can't do that." |
| **1:14–1:32** | Right dock → **Code**. Same drawing as JSON. Caret into a resource → it lights on canvas. Edit `memoryMb` in text → node and total move. | "Same document, as code. I type here, the agent patches by id, neither of us guesses what the other did." |
| **1:32–1:56** | **Live.** URL gains a room id, pill green, link copied. Second window: two named cursors. **They drag while my agent is mid-answer. Both land.** | "Press Live and the URL is a room. My colleague opens it and *their* agent is in the same document as mine. Four writers, one validator. No account, nothing stored — the page just passes our changes across." |
| **1:56–2:20** | **Scenario.** Count ticks **39 → 43**. Lambda to 1024 MB: change list reads `memoryMb 512 → 1024`, per-resource delta, total goes **down**. Commit → back to 39. | "A scenario forks the whole design — more memory, lower bill, because it finishes faster. And watch the count: four tools exist only while the fork is open. Capability appearing because the state changed." |
| **2:20–2:42** | **Export** → CDK to the coding agent → written into a repo → `cdk synth` → green. Import the same stack back: drawing rebuilds, priced. | "And what we built together compiles. CDK into the repo — it synthesises. Hand it back and the drawing comes back with it." |
| **2:42–2:55** | Full canvas, both cursors still live, total and rings legible. The cold open's frame. | "One web page, and any agent that opens it is a cloud architect — working next to you, not at you." |

**Cuts if long:** the import, then the Code tab. **Never cut:** the cold open, the Live beat, the
findings loop, the count ticking.

**Hold the last frame** two beats after the last word — both cursors visible. It's the YouTube still,
and it's the cold open's image, which makes 3:00 feel closed rather than stopped.

---

## Criteria coverage

| Devpost criterion | Beat that earns it |
|---|---|
| Technological Implementation | 0:12 semantic tools · 1:56 count ticking 39 → 43 under `AbortController` |
| Ease of Use | 0:26 one sentence builds it · no login, no keys |
| Demonstration | product working by 0:26; every claim performed, not asserted |
| Potential Impact | 1:32 four writers one document · 2:20 it compiles |
| Quality of Idea | 0:00 cold open: watching vs working |
| Design | zero crossing edges, findings as rings not dialogs |

---

## If a judge pushes back

| "..." | Answer |
|---|---|
| **"Isn't this draw.io with an MCP?"** | Their tools are shapes and coordinates; the file is a picture that can't be wrong because it means nothing. Ours are services and settings — so the number moves, the finding fires, the export compiles, and the agent can be *told* it's wrong. |
| **"Isn't it just multiplayer diagramming?"** | The multiplayer is a consequence, not the feature. Patches are addressed by id because an agent's state goes stale when a human drags something — that decision predates rooms by weeks. Multiplayer needed a transport, not a redesign. |
| **"Cloudcraft does cost."** | Manually, as line-item budgeting, with no agent interface. Tools that *do* have agent interfaces — draw.io, Structurizr, IcePanel, Excalidraw — have no cost model at all. |
| **"Where does the price come from?"** | `scripts/fetch-pricing.ts` pulls the AWS Price List Bulk API and writes a dated file per region with a source URL per SKU. Nothing in the app holds a literal rate. |
| **"Can I trust the CDK?"** | `npm run synth` runs `cdk synth` on every AWS sample plus a fixture holding one node of every service · five stacks. Stubs are listed in a header comment in the file, never hidden. |
| **"Does my bill leave the browser?"** | No. The CSV is parsed in the tab. There's no backend to send it to. |
| **"Why serverless only?"** | That's where the estimate is hard and the drivers are real — requests, duration, memory, storage class. An EC2 hourly rate doesn't need a tool. |

---

## Recording checklist

- [x] **Tool count verified 2026-09-03: 39 base + 4 in a scenario.** Counted in `src/webmcp/` (37 in `tools.ts`, plus `open_scenario` and `overhead_ping`, plus 4 in `scenario.ts`) and read off the app's own bottom bar. Every doc now says **39 → 43**. Re-read the bar in the ChatGPT desktop browser before recording · what is said must match what is on screen.
- [ ] **The cold open needs two things moving at once.** Rehearse the drag so my cursor and the agent's call land in the same second. It is the whole thesis in one shot; re-record until it's clean.
- [ ] Second machine (or profile) ready and *already in the room* before the Live beat — no waiting on a join.
- [ ] `npm run synth` passing, so the CDK claim is true.
- [ ] 1600 × 1000, dark room, `ap-southeast-1`, zoom 100%, HowTo dismissed, right dock open.
- [ ] Bottom bar count legible in frame when it ticks.
- [ ] Audio recorded separately. Under 3:00.
- [ ] Uploaded **public**, not "made for kids" (judges can't open age-gated video). Upload early — processing time is unpredictable.
