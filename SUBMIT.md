# Submission sequence

Deadline **Thu 4 Sep, 03:00 Manila**. Everything below is ordered by what blocks what, not by how
long it takes. The video is first because it is the only step that can fail in ways you cannot fix at
23:00.

---

## 0 · Before anything (15 min)

| Do | Why |
|---|---|
| Open the deployed URL in the **ChatGPT desktop app**, ask it to call one tool | If site tools do not register, nothing else in this list matters. Find out now. |
| Read the pill, confirm it still says **39 tools live · +4 in a scenario** | It is spoken on camera and written in three files. |
| `npm run synth` | The CDK claim is made on camera. Make it true first. |
| Second machine / profile: ChatGPT app open, site tools working, ready to join a room | The Live beat needs it. Do not discover this mid-shoot. |

**If site tools do not work in ChatGPT:** fall back to Chrome with `chrome://flags/#enable-webmcp-testing`.
Same demo, same story, judges use both. Do not lose an hour fighting it.

---

## 1 · Record (2–3 h, do this while you still have energy)

Shot list is `SCRIPT.md`. Record **each row as its own clip** so a bad take costs one retake.

1. Cold open — the drag + ChatGPT's call landing in the same second. Rehearse until it's clean. This is
   the whole thesis and it is the one shot worth ten takes.
2. Then rows 2–8 in order.
3. Narration **separately**, against the picture. Do not talk and drive at once.

Never film: typing, page loads, room joins, builds, an agent thinking.

---

## 2 · Export the images (20 min, can run while clips render)

From the brand-kit canvas, Export PNG per artboard:

| Page | Artboard | Goes where |
|---|---|---|
| Brand & gallery | Devpost thumbnail (3:2) | Devpost **project image** — the gallery grid |
| Brand & gallery | Product shot — laptop | Devpost gallery image 2 |
| Brand & gallery | Gallery — how it works | Devpost gallery image 3 |
| Video assets | YouTube thumbnail | YouTube custom thumbnail |
| Video assets | 3 cut-away cards | Into the edit, ~2s each |
| Video assets | End card | Last frame, hold 2s |
| Brand & gallery | Logo on dark → mark only | Repo, favicon |

---

## 3 · Edit + upload (2 h — upload EARLY)

- Cut to the shot list. Jump-cut pauses, speed the layout 1.5×, the synth 4×.
- Drop the three cut-away cards after the beats they explain.
- End card holds the last frame.
- **Under 3:00.** Audio required.
- Upload **public**, not "made for kids". Custom thumbnail. Processing time is unpredictable — get it
  uploading before you write anything else.

---

## 4 · Fill the write-up (45 min, while the video processes)

Source is `DEVPOST.md`, copy-paste ready. Three things only you can do:

1. **The three `[YOU]` gaps in Inspiration** — the tool that overwrote your edits, roughly when, what
   you were building. This is the single highest-value edit in the whole submission; Devpost's own
   guidance says judges can tell when a description is unedited AI output.
2. **Read Inspiration aloud.** Anything that doesn't sound like you, retype from scratch.
3. **The name.** If "Overhead" came out of the planning docs rather than your head, spend ten minutes
   on it now — everything else here is editable after submission, the name is not.

---

## 5 · Submit (30 min buffer, target 02:30)

- [ ] Project name, elevator pitch
- [ ] All seven description sections from `DEVPOST.md`
- [ ] Thumbnail + 2 gallery images uploaded
- [ ] YouTube URL (public, playable in an incognito window — check this)
- [ ] Repo URL, public, MIT licence visible
- [ ] Live URL — open it in a fresh incognito window and confirm no login wall
- [ ] Built-with tags: WebMCP, Next.js, React, TypeScript, AWS
- [ ] Hit submit at **02:30**, not 02:58

---

## If you run out of time

Cut in this order:

1. The Live beat (video and write-up both) — it is the most fragile shot and the least load-bearing claim.
2. The export/repo half of the CDK beat — keep `cdk synth` green, drop the repo hand-off.
3. The cut-away cards — nice, not necessary.

**Never cut:** the first 15 seconds, the findings loop, the tool count ticking 39 → 43, the live URL
working without a login.
