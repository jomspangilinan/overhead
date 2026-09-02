# Overhead

**The view from above your AWS architecture — and what it costs to run.**

An entry for the [WebMCP Challenge](https://webmcp.devpost.com/). Sketch a
serverless AWS architecture *with your agent* on a live canvas: every node
carries its real price from the AWS Price List, findings flag what's wrong
(with the AWS doc to prove it), scenarios fork the design and draw the
delta, and the whole thing exports as CDK, Markdown, Mermaid, SVG, or a
reloadable JSON state.

**Live:** https://overhead-ecru.vercel.app · no login, no backend — everything runs in the tab.

## Try it

1. Open the live URL in the **ChatGPT desktop app's built-in browser**
   (site tools work out of the box) — or in **Chrome** with
   `chrome://flags/#enable-webmcp-testing` enabled.
2. Check the tool pill (bottom right): it should read **“35 tools live”**.
3. Tell the agent:

   > HTTP API → Lambda → DynamoDB, S3 uploads behind CloudFront, SQS for
   > thumbnails, ~5M requests a month. Then call get_findings and fix what
   > you flagged.

4. Fork it: *“What if the thumbnail Lambda runs on ARM at 1024 MB?”* —
   watch the tool count tick up by four while the scenario is open.
5. Drop a Cost Explorer CSV on the canvas — parsed locally, never uploaded
   — and let the agent reconstruct the bill as a diagram.

## Why this fits WebMCP

Before WebMCP, only platforms big enough to ship an API and an official
MCP server could expose capability to agents. Now any web page can, to
whatever agent the visitor brought — no platform's permission, no
partnership, no backend. Overhead leans into exactly that: 35 semantic
tools in eight families (read, write, findings, scenarios, bill, export,
import, reconcile) — not draw-primitives. A draw.io MCP lets an agent *draw* an AWS diagram;
Overhead lets an agent *design* an AWS architecture — the diagram is just
the view.

- Raw `document.modelContext.registerTool({ name, description, inputSchema, execute })`
  in [`src/webmcp/register.ts`](src/webmcp/register.ts), with
  `navigator.modelContext` fallback.
- **Dynamic registration**: `open_scenario` registers four scenario tools
  under one `AbortController`; commit/discard aborts them. The visible
  tool panel makes it observable.
- Read tools carry `readOnlyHint`; parsed-bill output carries
  `untrustedContentHint`. Mutations land in the store **before** the tool
  returns, so the agent's next read sees reality. Structured errors give
  the agent a recovery path. Outputs stay under ~1.5K chars — bigger
  payloads stream through `get_export_chunk`.

## What people + agents can now do together

The human drags, zooms, overrules; the agent builds, prices, audits and
re-prices around them. Cost stops being a spreadsheet argument: the bill
becomes a diagram both of you can point at.

## How it's implemented

- **Next.js 15** static export, **React Flow** canvas, **Zustand** store.
  No API routes, no auth.
- `src/engine/**` is pure TypeScript: one `defineService()` per AWS
  service derives the inspector form, tool schemas, card lines, pricing
  function, CDK props and CloudFormation (written *and* read back) from a
  single definition.
- Pricing comes from the **AWS Price List Bulk API** at build time
  (`scripts/fetch-pricing.ts`) — every SKU line keeps its `sourceUrl`;
  nothing is hardcoded.
- Findings are unit-tested rules citing AWS docs, with savings computed
  from the same pricing table.
- The CDK exporter's output passes `cdk synth` on the three bundled
  samples plus a fixture holding one node of every service
  (`npm run synth`).
- **CloudFormation goes both ways.** Export writes deployable YAML;
  Import reads YAML or JSON — ours round-trips exactly, anyone else's is
  read structurally (types become services, `Properties` become priced
  settings, VPCs and subnets become containers, and `Ref` / `Fn::GetAtt`
  become the arrows). When the drawing is not empty you get a diff first,
  then Replace or Merge.

## Develop

```bash
npm install
npm run dev          # local dev
npm test             # vitest: rules, exporters, golden costs
npm run synth        # cdk synth on the three sample exports
npm run fetch-pricing  # refresh data/pricing.<region>.json from AWS
```

## Licence

MIT — see [LICENSE](LICENSE). The official AWS Architecture Icons in
`public/icons/aws/` are © Amazon Web Services and excluded from the MIT
licence; see [public/icons/aws/NOTICE.md](public/icons/aws/NOTICE.md).
