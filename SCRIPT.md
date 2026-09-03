# Shooting script — do these in order

Eight takes, recorded separately. Follow top to bottom. Prompts to paste are in `PROMPTS.md`.
Target runtime **2:50**.

> **ChatGPT builds it clean — there are no findings unless you make one.**
> Every amber ring in this video is one **you** put there by hand, before or during the take.
> Deterministic, repeatable, and a better claim anyway: the rules catch the human too.

**Before any take:** ChatGPT desktop app open · site in its in-app browser · ask it *"list the tools
this page gives you"* and confirm you get `add_service`, `get_findings`, etc. If not, stop and fix
that. Window sized so the conversation and the canvas are both readable at 1080p.

---

# TAKE 1 — Cold open · 0:00–0:15

**No flaw in this shot.** The old version said "it's flagging something I got wrong" and then never
paid it off until a minute later — a setup with no payoff. The broken-Lambda beat now lives entirely
in Take 4, set up and resolved in the same thirty seconds.

**Set up:** your `Photo sharing · serverless` design loaded, canvas zoomed to **~70%** so a node and
its label are readable at 1080p (31% is far too small). Hand resting on `DynamoDB · photo metadata`.

**Do:**
1. Paste and send: `Rename the DynamoDB table to "photo-index".`
   *(A rename is the most visible single change — the label rewrites itself on the node.)*
2. **The moment that label changes, start dragging your node.** React to it. Don't time it off Enter.
3. Let the `$157.97` sit in frame.

**Say:**
> "This is me and ChatGPT, editing the same AWS architecture at the same time."
>
> *(beat)*
>
> "Neither of us is waiting for the other one. And it already knows what the whole thing costs."

**Watch for:** the label rewriting while your cursor is mid-drag. Both visible at once.
**Shoot 6–7 times.** This is the whole thesis; everything after is evidence.

---

# TAKE 2 — The build · 0:15–0:42

**Set up:** empty canvas. Client brief from `PROMPTS.md §1` pasted into ChatGPT, unsent.

**Do:** press Enter. Keep rolling while it thinks — you cut that out later.

| When | On screen | Say |
|---|---|---|
| a | You press Enter | "I didn't give it a list of services. I gave it the client's brief." |
| b | Resources landing left to right | "It picked the API type. It picked how uploads get in. It decided the thumbnail work needed a queue. I didn't name any of that." |
| c | The total resolves | "And it prices what it built. A hundred and fifty-eight a month. A hundred and twenty of that is CloudFront — and the Lambda everyone obsesses over is three cents." |

> **Check the Lambda figure before you say it.** Click the thumbnail worker and read its cost line. If
> it's `$0.03`, say **"three cents"** — that contrast against $120 is the best number in the video. If
> it reads differently, say the real one. Never say a figure you haven't read off the screen.

**Watch for:** no crossing edges, everything inside AWS Cloud › ap-southeast-1.
**Edit:** cut from Enter straight to the first resource landing. Speed 1.5× if it dawdles.
**Over time?** Drop line (a). **Line (c) is the one that matters** — land it and pause.

---

# TAKE 3 — Both of us editing · 0:42–1:05

**Do:**
1. Paste and send: `Set the thumbnail worker to 1024 MB with a 30 second timeout.`
   *(Two `set_property` calls, so there's a visible sequence rather than one blink.)*
2. **While it's working**, by hand: drag `S3 · private thumbnails` somewhere new and rename
   `CloudFront` to `cdn`.
3. Both your edits and both of its edits survive. Nothing is overwritten.

**Say:**
> "I'm not watching it work, I'm working next to it. Most tools hand the agent a copy of your file — so the moment you move something, its copy is wrong and the next thing it writes wins. There's no copy here."

**Watch for:** your rename and its change both persisting. The origin story is told here, over your own
footage — never over someone else's product.

---

# TAKE 4 — It catches me · 1:05–1:32

**Do:**
1. Open the thumbnail Lambda in the Inspector.
2. Switch **arm64 → x86**. The ring appears as you do it.
3. Paste: `Check the design and fix what you find.`
4. It calls `get_findings`, puts it back to arm64, cites the AWS doc, total drops.

**Say:**
> "The rules apply to me too. I change one setting by hand, and the page flags it before I let go of the mouse. Then I ask ChatGPT to check the design — nine rules, each citing an AWS doc — and it puts my mistake back."

**Flaws you can introduce by hand, and what fires:**

| Break | Rule |
|---|---|
| Thumbnail Lambda → x86 | `x86_lambda` |
| Delete the DLQ | `async_no_dlq` |
| HTTP API → REST API | `rest_where_http_would_do` |
| DynamoDB → provisioned, low throughput | `on_demand_steady_state` |

**Edit:** jump-cut its thinking time. No spinner on screen.

---

# TAKE 5 — The scenario · 1:32–1:58 · **the WebMCP shot**

Most important beat for the judging criteria. The tool-count pill must be legible.

**Do:**
1. Paste: `Open a scenario called "arm64 + more memory". Set the thumbnail Lambda to 1024 MB on arm64, then show me the delta against the base design.`
2. **Hold on the pill as it ticks 39 → 43.** Two beats.
3. Let the delta and the lower total land.
4. Paste: `Commit it.`
5. **Hold as it goes back to 39.**

**Say:**
> "A scenario forks the whole design — more memory, lower bill, because it finishes faster. And watch the count: four tools that exist only while this fork is open. The page hands the agent new capability because its state changed."

**Watch for:** the count readable both times it moves. If it isn't, the take is wasted.

---

# TAKE 6 — The room · 1:58–2:18

**Set up:** second machine **already joined**, its ChatGPT already working. Never film a join.

**Do:**
1. Press **Live**. URL gains a room id, pill goes green.
2. Your ChatGPT: `Rename the thumbnail Lambda to "thumbnailer" and set its timeout to 10 seconds.`
3. Colleague drags a node **by hand** at the same time.
4. Their ChatGPT: `Add a DLQ to the thumbnail queue.`
5. All three land, nothing lost.

**Say:**
> "Press Live and the URL is a room. My colleague opens it in their own ChatGPT, and now there are two of us and two agents on one document. The cursors are the people. The agents show up as calls."

**Cut this first if you're over time.**

---

# TAKE 7 — It compiles · 2:18–2:38

**Do:**
1. Paste: `Export this as CDK and give me the TypeScript.`
2. ChatGPT lifts the CDK out of the tool result into a repo.
3. `cdk synth` → green.

**Say:**
> "And what we built together compiles. ChatGPT takes the CDK out of the page and into the repo — and it synthesises."

**Edit:** speed the synth 4×, or cut straight to green.

---

# TAKE 8 — Close · 2:38–2:50

**Set up:** full canvas, total legible, a tool call still landing if you can time it.

**Say:**
> "One web page. Any agent that opens it is a cloud architect — working next to you, not at you."

**Do:** hold two beats after the last word — this frame is the YouTube still. Then cut to the **End
card** from the brand kit.

---

# Assembly

1. Takes 1–8 in order.
2. Cut-away cards: **CardPrice** after Take 2, **CardTools** after Take 5, **CardCompiles** after
   Take 7. ~2s each.
3. **End card** after Take 8.
4. Narration recorded separately against the picture. Don't talk and drive at once.
5. Under 3:00. Upload **public**, not "made for kids", custom thumbnail. Upload early.

**Over time, cut in this order:** Take 6 → the repo half of Take 7 → the cut-away cards.
**Never cut:** Take 1, Take 4, the count ticking in Take 5.

---

# Standing rules

- **There are no findings unless you make one.** Every ring is hand-placed.
- **Never film:** typing, page loads, room joins, builds, an agent thinking.
- **Latency is an editing problem.** Press Enter, keep rolling, cut the wait afterwards.
- **An agent has no cursor.** Cursors are people; the agent shows up as calls landing and the count
  changing.
- **No competitor on screen, ever.**
- **Tool count is 39 → 43.** Re-read the live pill on the day before you say it.

---

# If a judge asks

| "…" | Answer |
|---|---|
| **"Isn't this a diagram tool with an MCP?"** | Their tools are shapes and coordinates, and the file is a picture that can't be wrong because it means nothing. Ours are services and settings — so the number moves, the finding fires, the export compiles, and the agent can be told it's wrong. |
| **"Isn't multiplayer a nice-to-have?"** | It's a consequence. Patches are addressed by id because an agent's view goes stale when a human drags something — that predates rooms by weeks. Multiplayer needed a transport, not a redesign. |
| **"Other tools do cost."** | Manually, as line-item budgeting, and none of them hand an agent tools. The ones that do expose agent tools have no cost model at all. |
| **"Where does the price come from?"** | `scripts/fetch-pricing.ts` pulls the AWS Price List Bulk API and writes a dated file per region with a source URL per SKU. Nothing in the app holds a literal rate. |
| **"Can I trust the CDK?"** | `npm run synth` runs `cdk synth` on all three samples. Stubs are listed in a header comment in the file. |
| **"Does my bill leave the browser?"** | No. The CSV is parsed in the tab. The one server route is a WebSocket relay for rooms, which never sees a bill and keeps nothing. |
| **"Why serverless only?"** | That's where the estimate is hard and the drivers are real — requests, duration, memory, storage class. An EC2 hourly rate doesn't need a tool. |
