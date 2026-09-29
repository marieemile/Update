import { runPipeline } from "./pipeline.js";

const ingestOnly = process.argv.includes("--ingest-only");

runPipeline({ ingestOnly })
  .then((result) => {
    if (ingestOnly) {
      for (const it of result.items.slice(0, 15)) console.log(`  ${it.source}: ${it.title}`);
      console.log(`  ... (${result.items.length} total)`);
    }
  })
  .catch((err) => {
    console.error(`\nFailed: ${err.message}`);
    if (/api[_ ]?key|auth/i.test(err.message)) {
      console.error("Set ANTHROPIC_API_KEY (export ANTHROPIC_API_KEY=sk-ant-...) and try again.");
    }
    process.exit(1);
  });
