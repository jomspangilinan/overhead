Paste everything below the line into Claude Code, from inside an empty folder that will become the repo.

---

We're building **Overhead** — a WebMCP Challenge entry: an AWS architecture canvas where an agent designs serverless architectures with live pricing from the AWS Price List, scenario forking, findings with doc links, groups that collapse, and exports (JSON, Markdown, Mermaid, SVG, CDK). Next.js 15 + React Flow + Zustand on Vercel. No backend, no auth. Deadline is Thu 4 Sep, 04:00 Manila; submit by 03:00.

Read these in order before doing anything:

1. `OVERHEAD-PLAN.md` — the spec. Sections 5 (diagram language), 7 (tool surface), 13 (build order with acceptance criteria) matter most.
2. `CLAUDE.md` — project conventions. Non-negotiables at the top.
3. Fetch the interactive reference with WebFetch: https://claude.ai/code/artifact/a02ba1aa-3893-4fdd-af39-8bf7058c82f3 — it has the before/after diagrams, the layer toggles, the icon→card zoom behaviour, the request trace, and the VPC collapse. Use it as the visual target. If the fetch fails, the plan is sufficient.
4. `reference/diagram-module.js` — vanilla-SVG implementation of the node cards, bezier edge routing, layers, hover isolation, trace and group collapse. Port its geometry into React Flow custom nodes and edges; don't ship it.
5. `reference/overhead-mock.html` — an interactive mock of the whole app screen (palette, canvas, inspector, tool panel, scenario). Open it in a browser; this is the UI target. Also live at https://claude.ai/code/artifact/7808097f-952d-4a9d-aada-0287f9609627
6. `reference/aws-icon-sprite.svg` — 22 official AWS icons already as `<symbol>`s. The full package is at `~/Downloads/Icon-package_07312026.5846e92413caa21490223536cc97f1269e44fa92/` — copy the 64 px `Arch_*` service SVGs and the 32 px group icons you need into `public/icons/aws/` with a `NOTICE.md`.

Then start **Phase 0 only**: init the repo with an MIT licence, scaffold Next.js 15 (App Router, static export, TypeScript, Tailwind), add a `'use client'` provider that registers one trivial tool via a raw `document.modelContext.registerTool({...})` in `src/webmcp/register.ts`, deploy to Vercel, and stop. I'll confirm the tool appears in the ChatGPT desktop browser's Site tools before we go further — nothing else is built until that passes.

Use TaskCreate to track the phases from §13 with their acceptance criteria. Commit small and often. Ask me before adding any dependency not listed in §11.
