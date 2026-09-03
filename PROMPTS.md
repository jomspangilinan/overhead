# Prompts to paste into ChatGPT — in shoot order

Keep this open beside the shoot. **Paste, don't type** — the only keystroke on camera is Enter.
Have the next prompt already in the box before you start each take.

If ChatGPT answers in prose instead of calling tools, it hasn't picked up the page. Say
*"use the tools on this page"* once, off-camera, then re-run the take.

---

## 0 · Warm-up — off camera, every session

```
List the tools this page gives you.
```

Should come back with `add_service`, `connect`, `set_property`, `get_findings`… If it doesn't,
stop and fix registration. Nothing else in the shoot works.

---

## 1 · The build — shot at 0:15

**Give it the client's requirements, not a list of services.** If you name the services, it's
transcribing. If you give it the brief, it has to *choose* — API type, architecture, whether the
thumbnail work needs a queue — which is the entire claim of the video. It also loads the gun for the
findings beat: whatever it gets wrong at 0:15, it catches at 1:05.

Already pasted, unsent, before you roll.

```
A client wants a photo-sharing backend. Users upload images, we generate thumbnails in the background, and serve them worldwide with low latency. Around 5 million requests a month. Keep it serverless, ap-southeast-1, and they care about cost. Design it on the canvas and tell me what it lands at.
```

**Watch for:** resources landing left to right inside AWS Cloud › ap-southeast-1, no crossing edges,
total counting up.

**What it actually did on 3 Sep:** presigned S3 uploads, EventBridge → SQS → Lambda thumbnails,
private S3 behind CloudFront OAC, no VPC or NAT. **$157.97/mo**, with CloudFront at **$120.44 (76%)**,
Cognito $20, S3 $14.37, everything else $3.16. Zero findings — it built it clean, which is why the
1:05 beat is now you breaking something rather than it having erred.

**Safe fallback**, if a brief gives you a different shape every take and you need determinism:

```
Build this on the canvas: an HTTP API in front of a Lambda that writes to DynamoDB, S3 uploads behind CloudFront, and an SQS queue feeding a thumbnail Lambda. About 5 million requests a month, ap-southeast-1.
```

Do 2–3 takes with the brief first. If it produces something sensible even once, use it — a judge can
tell the difference between a tool being told what to draw and an agent making a call.

---

## 2 · Self-audit — shot at 1:05

**The 3 Sep dry run built it clean — zero findings.** So don't rely on the agent making a mistake.
**Break it yourself, on camera, first:** open the thumbnail Lambda in the Inspector and switch it to
**x86**. The amber ring fires immediately (`x86_lambda`). Then:

```
Check the design and fix what you find.
```

**Watch for:** it calls `get_findings`, puts the Lambda back to arm64, cites the AWS doc, total drops.

This is better than waiting for the agent to slip: it's repeatable, it's visible, and it shows the
rules catching a *human* — which is the more interesting claim.

**Other flaws you can introduce by hand, if you want two rings instead of one:**

| Break this | Rule that fires |
|---|---|
| Thumbnail Lambda → x86 | `x86_lambda` |
| Delete the DLQ off the thumbnail queue | `async_no_dlq` |
| Swap the HTTP API for a REST API | `rest_where_http_would_do` |
| DynamoDB → provisioned at low throughput | `on_demand_steady_state` |

---

**Optional extra beat, if the brief version lands well:** before the findings, ask it to justify a
choice. It's five seconds and it's the most "architect, not draw tool" moment available to you.

```
Why did you pick that API type?
```

---

## 3 · Scenario — shot at 1:32 · the WebMCP money shot

```
Open a scenario called "arm64 + more memory". Set the thumbnail Lambda to 1024 MB on arm64, then show me the delta against the base design.
```

**Watch for:** the pill ticking **39 → 43** as the scenario opens. Keep it legible in frame.

Then, after the delta is on screen:

```
Commit it.
```

**Watch for:** the count going back to **39**.

---

## 4 · Live room — shot at 1:58

You press Live yourself; the second machine is already joined. Then, to prove both agents are in the
same document, from **your** ChatGPT:

```
Rename the thumbnail Lambda to "thumbnailer" and set its timeout to 10 seconds.
```

…while your colleague drags a node by hand, and their ChatGPT runs:

```
Add a DLQ to the thumbnail queue.
```

**Watch for:** three edits landing, nothing lost, both cursors visible.

---

## 5 · Export — shot at 2:18

```
Export this as CDK and give me the TypeScript.
```

Then in your coding agent / terminal:

```
cdk synth
```

**Watch for:** green. Speed it 4× in the edit, or cut straight to the result.

---

## Fallback prompts, if a take misbehaves

| Problem | Say this |
|---|---|
| It describes instead of doing | `Use the tools on this page to do it, don't just describe it.` |
| It built the wrong shape | `Clear the canvas and start again.` |
| It won't open a scenario | `Call open_scenario with the name "arm64 + more memory".` |
| It fixed nothing after findings | `Apply the arm64 finding and add the missing DLQ.` |
| You need the count on screen | `What tools do you have right now?` — reads the live set aloud |

---

## Agent latency — you never film the wait

ChatGPT takes as long as it takes. That is an editing problem, not a shooting problem.

- **Every shot except the cold open:** press Enter, keep rolling, let it think. In the edit, cut
  straight from your Enter to the first thing moving on the canvas. Or shoot it as two clips — one of
  you pressing Enter, one of the canvas filling — and butt them together. The wait never existed.
- **Never leave a spinner on screen.** If a beat has more than a second of nothing happening, that
  second does not survive the cut.

## The cold open — sync to the response, not to Enter

Shot 1 at 0:00 has no prompt of its own. It is you dragging while a call lands, and both have to be
visible in the same second.

Do **not** try to time it off your Enter — you cannot predict the latency. Instead:

1. Send a small edit off-camera-ish: `Set the API to an HTTP API and rename it "checkout-api"`.
2. Rest your hand on the node you are about to drag.
3. **The moment the first change lands, start dragging.** You are reacting to it, not guessing.

Alternative if that feels twitchy: just keep moving things continuously for the whole window — nudge a
node, drag it back, nudge it again — so wherever the call lands, your hand is already in motion. Then
pick the take where the overlap reads cleanly.

Shoot this one six or seven times. It is fifteen seconds of work and it is the entire thesis of the
video; everything after it is evidence for a claim this shot has to make first.
