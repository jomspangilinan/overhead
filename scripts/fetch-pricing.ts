// Fetches live rates from the AWS Price List Bulk API (public JSON, no auth)
// and writes data/pricing.<region>.json with one entry per canonical key the
// engine looks up. Every entry keeps the sourceUrl of the file it came from.
//
// Run: node --experimental-strip-types scripts/fetch-pricing.ts [--debug]

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = "https://pricing.us-east-1.amazonaws.com";
const INDEX_URL = `${BASE}/offers/v1.0/aws/index.json`;
const REGIONS = ["us-east-1", "ap-southeast-1"] as const;
const DEBUG = process.argv.includes("--debug");

interface PriceDimension {
  unit: string;
  beginRange?: string;
  endRange?: string;
  description?: string;
  pricePerUnit: { USD?: string };
}
interface Product {
  sku: string;
  productFamily?: string;
  attributes: Record<string, string>;
}
interface OfferFile {
  products: Record<string, Product>;
  terms: { OnDemand?: Record<string, Record<string, { priceDimensions: Record<string, PriceDimension> }>> };
}

interface Entry {
  key: string;
  rate: number;
  unit: string;
  sku: string;
  description: string;
  sourceUrl: string;
}

type Matcher = {
  key: string;
  /** offer code the key comes from */
  offer: string;
  match: (p: Product, usagetypeNorm: string) => boolean;
};

// Strip region prefixes like APS1-, USE1-, USW2-, EUC1-, plus CloudFront
// geo groups like US-, AP-, EU-, JP-, IN-, SA-, AU-, ZA-, ME-, CA-.
function norm(usagetype: string): string {
  return usagetype.replace(/^([A-Z]{2,5}\d-|US-|AP-|EU-|JP-|IN-|SA-|AU-|ZA-|ME-|CA-)/, "");
}

const OFFER_CODES: Record<string, string[]> = {
  lambda: ["AWSLambda"],
  apigateway: ["AmazonApiGateway"],
  dynamodb: ["AmazonDynamoDB"],
  s3: ["AmazonS3"],
  cloudfront: ["AmazonCloudFront"],
  sqs: ["AWSQueueService"],
  sns: ["AmazonSNS"],
  eventbridge: ["AWSEvents"],
  stepfunctions: ["AmazonStates"],
  cognito: ["AmazonCognito"],
};

function matchersFor(region: string): Matcher[] {
  // CloudFront is priced per geography, not per API region.
  const cfGeo = region === "us-east-1" ? "United States" : "Asia Pacific";
  return [
    {
      key: "lambda.requests",
      offer: "lambda",
      match: (p, u) => p.attributes.group === "AWS-Lambda-Requests" && u.includes("Request"),
    },
    {
      key: "lambda.gbSecond.x86_64",
      offer: "lambda",
      match: (p, u) => p.attributes.group === "AWS-Lambda-Duration" && u.includes("GB-Second"),
    },
    {
      key: "lambda.gbSecond.arm64",
      offer: "lambda",
      match: (p, u) => p.attributes.group === "AWS-Lambda-Duration-ARM" && u.includes("GB-Second"),
    },
    {
      key: "apigateway.httpRequests",
      offer: "apigateway",
      match: (_p, u) => u.startsWith("ApiGatewayHttpApi") || u.startsWith("ApiGatewayHttpRequest"),
    },
    {
      key: "apigateway.restRequests",
      offer: "apigateway",
      match: (_p, u) => u === "ApiGatewayRequest",
    },
    {
      key: "dynamodb.onDemandRead",
      offer: "dynamodb",
      match: (_p, u) => u === "ReadRequestUnits",
    },
    {
      key: "dynamodb.onDemandWrite",
      offer: "dynamodb",
      match: (_p, u) => u === "WriteRequestUnits",
    },
    {
      key: "dynamodb.storageGbMonth",
      offer: "dynamodb",
      match: (_p, u) => u.includes("TimedStorage-ByteHrs"),
    },
    {
      key: "dynamodb.rcuHour",
      offer: "dynamodb",
      match: (_p, u) => u === "ReadCapacityUnit-Hrs",
    },
    {
      key: "dynamodb.wcuHour",
      offer: "dynamodb",
      match: (_p, u) => u === "WriteCapacityUnit-Hrs",
    },
    {
      key: "s3.storageGbMonth",
      offer: "s3",
      match: (p, u) =>
        u === "TimedStorage-ByteHrs" && p.attributes.volumeType === "Standard",
    },
    {
      key: "s3.putRequests",
      offer: "s3",
      match: (_p, u) => u === "Requests-Tier1",
    },
    {
      key: "s3.getRequests",
      offer: "s3",
      match: (_p, u) => u === "Requests-Tier2",
    },
    {
      key: "cloudfront.dataOutGb",
      offer: "cloudfront",
      match: (p, u) =>
        u === "DataTransfer-Out-Bytes" &&
        (p.attributes.location ?? p.attributes.fromLocation ?? "") === cfGeo,
    },
    {
      key: "cloudfront.httpsRequests",
      offer: "cloudfront",
      match: (p, u) =>
        u === "Requests-Tier2-HTTPS" && (p.attributes.location ?? "") === cfGeo,
    },
    {
      key: "sqs.requests",
      offer: "sqs",
      match: (p, u) =>
        u.startsWith("Requests-RBP") ||
        (u.includes("Requests") && !u.includes("FIFO") && (p.attributes.queueType ?? "Standard") === "Standard"),
    },
    {
      key: "sqs.fifoRequests",
      offer: "sqs",
      match: (_p, u) => u.includes("Requests") && u.includes("FIFO"),
    },
    {
      key: "sns.requests",
      offer: "sns",
      match: (p, u) => u === "Requests-Tier1" && (p.productFamily ?? "").includes("Request"),
    },
    {
      key: "eventbridge.customEvents",
      offer: "eventbridge",
      match: (_p, u) => u.includes("Event-64K-Chunks") && !u.includes("Partner") && !u.includes("CrossAccount"),
    },
    {
      key: "stepfunctions.stateTransitions",
      offer: "stepfunctions",
      match: (_p, u) => u === "StateTransition",
    },
    {
      key: "stepfunctions.expressRequests",
      offer: "stepfunctions",
      match: (_p, u) => u === "StepFunctions-Request",
    },
    {
      key: "stepfunctions.expressGbSecond",
      offer: "stepfunctions",
      match: (_p, u) => u === "StepFunctions-GB-Second",
    },
    {
      key: "cognito.maus",
      offer: "cognito",
      match: (_p, u) => u.includes("MonthlyActiveUsers") || u.includes("MAU"),
    },
  ];
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json() as Promise<T>;
}

async function offerRegionUrl(
  offerCodes: string[],
  region: string,
  index: { offers: Record<string, { currentRegionIndexUrl?: string; currentVersionUrl: string }> },
): Promise<{ url: string; code: string } | null> {
  for (const code of offerCodes) {
    const offer = index.offers[code];
    if (!offer) continue;
    // CloudFront's CDN pricing (per geography) only lives in the global file;
    // its per-region files carry just OriginShield and Lambda@Edge.
    const globalOnly = code === "AmazonCloudFront";
    if (!globalOnly && offer.currentRegionIndexUrl) {
      try {
        const ri = await getJson<{ regions: Record<string, { currentVersionUrl: string }> }>(
          BASE + offer.currentRegionIndexUrl,
        );
        const r = ri.regions[region];
        if (r) return { url: BASE + r.currentVersionUrl, code };
      } catch {
        // fall through to the global file
      }
    }
    return { url: BASE + offer.currentVersionUrl, code };
  }
  return null;
}

/** Smallest-beginRange dimension with a non-zero USD rate. */
function bestDimension(dims: Record<string, PriceDimension>): PriceDimension | null {
  const usable = Object.values(dims)
    .filter((d) => Number(d.pricePerUnit.USD ?? "0") > 0)
    .sort((a, b) => Number(a.beginRange ?? "0") - Number(b.beginRange ?? "0"));
  return usable[0] ?? null;
}

async function buildRegion(
  region: string,
  index: { offers: Record<string, { currentRegionIndexUrl?: string; currentVersionUrl: string }> },
): Promise<void> {
  const matchers = matchersFor(region);
  const byOffer = new Map<string, Matcher[]>();
  for (const m of matchers) {
    byOffer.set(m.offer, [...(byOffer.get(m.offer) ?? []), m]);
  }

  const entries: Record<string, Entry> = {};
  const misses: string[] = [];

  for (const [offerKey, offerMatchers] of byOffer) {
    const resolved = await offerRegionUrl(OFFER_CODES[offerKey], region, index);
    if (!resolved) {
      misses.push(...offerMatchers.map((m) => `${m.key} (offer not found)`));
      continue;
    }
    process.stderr.write(`  ${offerKey}: ${resolved.url.split("/offers/")[1]}\n`);
    const file = await getJson<OfferFile>(resolved.url);
    const onDemand = file.terms.OnDemand ?? {};

    for (const m of offerMatchers) {
      let found: Entry | null = null;
      for (const p of Object.values(file.products)) {
        const usagetype = p.attributes.usagetype ?? "";
        if (!m.match(p, norm(usagetype))) continue;
        const terms = onDemand[p.sku];
        if (!terms) continue;
        const dims = Object.values(terms)[0]?.priceDimensions;
        if (!dims) continue;
        const dim = bestDimension(dims);
        if (!dim) continue;
        found = {
          key: m.key,
          rate: Number(dim.pricePerUnit.USD),
          unit: dim.unit,
          sku: p.sku,
          description: dim.description ?? usagetype,
          sourceUrl: resolved.url,
        };
        break;
      }
      if (found) {
        entries[m.key] = found;
      } else {
        misses.push(m.key);
        if (DEBUG) {
          const types = new Set<string>();
          for (const p of Object.values(file.products)) {
            types.add(`${p.productFamily ?? "?"} :: ${p.attributes.usagetype ?? "?"}`);
          }
          process.stderr.write(
            `  MISS ${m.key} — distinct product/usagetypes:\n    ${[...types].sort().slice(0, 200).join("\n    ")}\n`,
          );
        }
      }
    }
  }

  const out = {
    region,
    generatedAt: new Date().toISOString(),
    source: INDEX_URL,
    entries,
  };
  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  const path = join(process.cwd(), "data", `pricing.${region}.json`);
  writeFileSync(path, JSON.stringify(out, null, 2));
  process.stderr.write(
    `${path}: ${Object.keys(entries).length} entries${misses.length ? `, MISSING: ${misses.join(", ")}` : ""}\n`,
  );
  if (misses.length) process.exitCode = 1;
}

const index = await getJson<{
  offers: Record<string, { currentRegionIndexUrl?: string; currentVersionUrl: string }>;
}>(INDEX_URL);

for (const region of REGIONS) {
  process.stderr.write(`Region ${region}:\n`);
  await buildRegion(region, index);
}
