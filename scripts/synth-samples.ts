// Generates the CDK stack for each sample architecture into
// cdk-out-test/ and runs `cdk synth` on all three — the CI gate that the
// CDK exporter emits deployable TypeScript.
//
// Run: node --experimental-strip-types scripts/synth-samples.ts

import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Extension-less TS imports need the compile step vitest/next provide, so
// this script re-implements nothing: it imports through a tsx-free path by
// letting `npx vitest run` cover the exporter logic and only smoke-tests
// synth here through pre-generated files written by tests. To keep it
// standalone, we inline the generation via a small vitest-produced module
// boundary: read the exporter output the test wrote, or regenerate through
// the compiled next server bundle. Simplest robust path: spawn vitest with
// an env flag that writes the three stacks.

const root = process.cwd();
const outDir = join(root, "cdk-out-test");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, "bin"), { recursive: true });

execSync("npx vitest run tests/write-cdk-stacks.test.ts", {
  stdio: "inherit",
  env: { ...process.env, WRITE_CDK_STACKS: outDir },
});

// all-services holds one node of every service · the gate that a newly
// added service ships CDK that actually compiles.
const samples = ["api-backend", "media-pipeline", "event-driven", "all-services"];

writeFileSync(
  join(outDir, "package.json"),
  JSON.stringify(
    {
      name: "overhead-synth-check",
      private: true,
      version: "0.0.0",
    },
    null,
    2,
  ),
);
writeFileSync(
  join(outDir, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        moduleResolution: "node",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        typeRoots: [join(root, "node_modules", "@types")],
        paths: {
          "aws-cdk-lib": [join(root, "node_modules", "aws-cdk-lib")],
          "aws-cdk-lib/*": [join(root, "node_modules", "aws-cdk-lib", "*")],
          constructs: [join(root, "node_modules", "constructs")],
        },
      },
    },
    null,
    2,
  ),
);

for (const name of samples) {
  const stackFile = join(outDir, `${name}.ts`);
  readFileSync(stackFile, "utf8"); // asserts the test wrote it
  const appFile = join(outDir, "bin", `${name}-app.ts`);
  const className = "OverheadStack";
  writeFileSync(
    appFile,
    `import * as cdk from "aws-cdk-lib";
import { ${className} } from "../${name}";
const app = new cdk.App();
new ${className}(app, "${name}");
`,
  );
  process.stderr.write(`cdk synth ${name}...\n`);
  execSync(
    `npx cdk synth --app "npx tsx ${appFile}" -o ${join(outDir, "cdk.out", name)} --no-version-reporting --no-path-metadata --no-asset-metadata`,
    { stdio: ["ignore", "ignore", "inherit"], cwd: root },
  );
  process.stderr.write(`  ok\n`);
}

process.stderr.write(`All ${samples.length} stacks synthesize.\n`);
