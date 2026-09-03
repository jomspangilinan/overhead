# Demo video · under 3:00

**The line:** *a web-native canvas powered by WebMCP that turns any agent into a cloud architect.
Design alongside it live while it calculates real-time infrastructure costs.*

**Built against Devpost's stated rules:** working product inside 15 seconds · best material first · already
logged in · no live typing · no dead air · jump cuts · short clips.

**Where this is filmed: inside the ChatGPT desktop app.** That is the client that consumes WebMCP, so
the whole demo lives there — the site open in ChatGPT's in-app browser, the conversation beside it. The
"agent" on camera is ChatGPT calling our site's tools. Frame so both are visible in one shot: we need to
see the request go in and the canvas move, without a cut. If site tools do not appear for a take, stop
and fix it before rolling — nothing in this video works without them.

**Dry-run result (3 Sep), use these numbers:** the brief produced presigned S3 uploads, EventBridge →
SQS → Lambda thumbnails, private S3 behind CloudFront OAC, no VPC. **$157.97/mo** in ap-southeast-1 —
of which **CloudFront is $120.44 (76%)**, Cognito $20, S3 $14.37, and everything else $3.16. That
split is the best line in the video: the CDN is three quarters of the bill and the Lambda is a
rounding error. Say it.

**It built it clean — no findings.** So the findings beat is now *you* breaking something on camera,
not the agent having erred. That is deterministic, and it makes a better point: the rules apply to the
human too.

**An agent has no cursor.** Cursors belong to people. The agent is visible as tool calls landing, the
count in the bottom bar, and the canvas changing without my hand on it. Never narrate a cursor as
though it were the agent — anyone who has used the app will catch it.

**Never compare on camera.** No competitor's name, no competitor's screen. Our opening seconds belong to
our product working, not to someone else failing. The "it overwrote my edits" story is *narration over our
own footage*, never a shot of another tool.

---

## First 15 seconds — the product, already working

No logo card. No title. No "hi, I'm —". Frame one is the canvas, mid-motion.

| Time | Screen | Said |
|---|---|---|
| **0:00–0:07** | Canvas already populated. **My cursor drags a Lambda into a subnet while the agent's `set_property` lands in the strip in the same second.** Both survive. | "This is me and ChatGPT, editing the same AWS architecture at the same time." |
| **0:07–0:15** | The monthly total resolves in the top bar. An amber finding ring appears on a node. | "It already knows what this costs. And it's just flagged something wrong with it." |

That is the whole pitch, performed, before a judge can bounce. Everything after is evidence.

**Alternates for 0:00** (pick in the booth):

- *"That's my cursor. Those are ChatGPT's edits. One document, and neither of us is waiting."*
- *"I'm not prompting and waiting. We're both working on this right now."*
- *"Two of us are editing this. One of us isn't a person."*

---

## Shot list

| Time | Screen | Said | Edit |
|---|---|---|---|
| **0:00–0:15** | Cold open, above. | see above | — |
| **0:15–0:42** | Cut to an empty canvas with the prompt **already typed into ChatGPT**, unsent. Hit enter. Resources land inside AWS Cloud › ap-southeast-1, left to right, no crossing edges. Total counts up. | "I give it the client's requirements, not a list of services — so it picks the API type, the upload path, whether the thumbnail work needs a queue. And it prices what it chose. A hundred and twenty of that hundred and fifty-eight is CloudFront. The Lambda everyone worries about is three dollars." | **Never film typing.** Paste the prompt before you roll. Speed the landing 1.5× if it dawdles. |
| **0:42–1:05** | I drag the worker into the private subnet and rename it by hand; the agent's call lands mid-drag. Neither edit is lost. | "I'm not watching it work, I'm working next to it. Most tools hand the agent a copy of your file — so the moment you move something, its copy is wrong and the next thing it writes wins. There's no copy here." | The one place the origin story is told. Over **our** footage. |
| **1:05–1:32** | **I break it, by hand.** Open the thumbnail Lambda in the Inspector, switch it to **x86**. An amber ring appears the moment I do. Then ask ChatGPT: *"check the design and fix what you find."* → `get_findings` → it puts it back to arm64, citing the AWS doc. | "The rules apply to me too. I change one setting by hand, and the page flags it before I let go of the mouse. Then I ask ChatGPT to check the design — nine rules, each citing an AWS doc — and it puts my mistake back." | **Deterministic — do not rely on the agent building something flawed.** Jump-cut its thinking time. |
| **1:32–1:58** | **Scenario.** Tool count ticks **39 → 43**. Lambda to 1024 MB: change list reads `memoryMb 512 → 1024`, per-resource delta, total goes **down**. Commit → back to 39. | "A scenario forks the whole design — more memory, lower bill, because it finishes faster. And watch the count: four tools that exist only while this fork is open. The page hands the agent new capability because its state changed." | **The WebMCP money shot.** Count must be legible. Hold two beats on the tick. |
| **1:58–2:18** | **Live.** URL gains a room id, pill green, link copied. A second ChatGPT window, **already joined**, on the other machine — **two named cursors, both human**. My colleague drags a node while my ChatGPT's call lands and theirs lands after it. Three edits, nothing lost. | "Press Live and the URL is a room. My colleague opens it in their own ChatGPT, and now there are two of us and two agents on one document. The cursors are the people. The agents show up as calls." | Second machine **pre-joined, site tools already working there**. Never film a join or a load. |
| **2:18–2:38** | **Export** → ChatGPT takes the CDK straight out of the tool result → into a repo → `cdk synth` → green. | "And what we built together compiles. ChatGPT takes the CDK out of the page and into the repo — and it synthesises." | Speed the synth 4×, or cut straight to green. Nobody watches a build. |
| **2:38–2:50** | Full canvas, both human cursors present, a tool call still landing, total and rings legible. The cold open's frame. | "One web page. Any agent that opens it is a cloud architect — working next to you, not at you." | Hold two beats after the last word. It's the YouTube still. |

**Cut if long:** the Live beat, then the export's repo half. **Never cut:** the first 15 seconds, the
findings loop, the tool count ticking.

---

## Production rules

| Rule | How it applies here |
|---|---|
| **Working in 15s** | Frame one is the canvas mid-edit. No logo, no title card, no narration before the product moves. |
| **Already logged in** | Nothing to do — there's no login. Say it once, late ("no account, nothing installed"), not as a feature tour. |
| **No live typing** | Every prompt is pasted before the take. The only keystroke on camera is Enter. |
| **No load times or dead air** | Never film a page load, a room join, a build, or an agent thinking. Cut to the result. |
| **Speed up slow parts** | Layout landing 1.5×. `cdk synth` 4× or straight to green. Findings resolution 2×. |
| **Short clips** | Record each row of the shot list as its own take, so one bad beat costs one retake, not the whole video. |
| **Audio required** | Record narration separately against the cut. Don't try to speak and drive at once. |

---

## Recording checklist

- [ ] **Tool count is 39 → 43**, confirmed from the live pill and now consistent across the
      README, DEVPOST.md and this script. Re-read the bottom bar on the day in case it moved.
- [ ] **ChatGPT desktop app open, site loaded in its in-app browser, site tools confirmed working.**
      Do one throwaway tool call before every session — if tools are not registered, nothing else matters.
- [ ] Window laid out so the conversation and the canvas are both legible in one frame at 1080p.
- [ ] `npm run synth` passing, so the CDK claim is true.
- [ ] Prompt pasted into the box, unsent, before the 0:15 take.
- [ ] Second browser profile **already in the room** before the Live take.
- [ ] 1600 × 1000, dark room, `ap-southeast-1`, zoom 100%, HowTo dismissed, right dock open.
- [ ] Bottom bar count legible in frame when it ticks.
- [ ] Rehearse the opening drag until your cursor and the agent's call land in the same second — it is
      the whole thesis in one shot and it has to be clean.
- [ ] Narration recorded separately, under 3:00.
- [ ] Uploaded **public**, not "made for kids". Upload early; processing time is unpredictable.

---

## If a judge pushes back

| "…" | Answer |
|---|---|
| **"Isn't this a diagram tool with an MCP?"** | A drawing tool's tools are shapes and coordinates, and the file it makes is a picture that can't be wrong because it doesn't mean anything. Ours are services and settings — so the number moves, the finding fires, the export compiles, and the agent can be told it's wrong. |
| **"Isn't multiplayer just a nice-to-have?"** | It's a consequence, not a feature. Patches are addressed by id because an agent's view goes stale when a human drags something — that predates rooms by weeks. Multiplayer needed a transport, not a redesign. |
| **"Other tools do cost."** | Manually, as line-item budgeting, and none of them hand an agent tools. The ones that do expose agent tools have no cost model at all. |
| **"Where does the price come from?"** | `scripts/fetch-pricing.ts` pulls the AWS Price List Bulk API and writes a dated file per region with a source URL per SKU. Nothing in the app holds a literal rate. |
| **"Can I trust the CDK?"** | `npm run synth` runs `cdk synth` on all three samples. Stubs are listed in a header comment in the file itself, never hidden. |
| **"Does my bill leave the browser?"** | No. The CSV is parsed in the tab, and nothing is stored anywhere · the one server route is a WebSocket relay for live rooms, which never sees a bill and keeps nothing. |
| **"Why serverless only?"** | That's where the estimate is hard and the drivers are real — requests, duration, memory, storage class. An EC2 hourly rate doesn't need a tool. |
