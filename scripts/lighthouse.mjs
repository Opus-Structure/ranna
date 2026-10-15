/**
 * `npm run lighthouse [url...]`: Lighthouse with mobile settings (simulated slow 4G, mid-range
 * phone) against a running production build (`npm run build && npm start`). Chromium comes from
 * Playwright and Lighthouse attaches over the debugging port, which also works on Windows where
 * Lighthouse's own launcher can fail. Exits non-zero when a score is below the bar.
 */
import { chromium } from "@playwright/test";
import lighthouse from "lighthouse";

const BAR = { performance: 90, accessibility: 95, "best-practices": 90, seo: 90 };
const urls = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["http://localhost:3000/s/demo"];
const port = 9333;

const browser = await chromium.launch({ args: [`--remote-debugging-port=${port}`] });
let failed = false;
try {
  for (const url of urls) {
    const result = await lighthouse(url, {
      port,
      output: "json",
      logLevel: "error",
      formFactor: "mobile",
      onlyCategories: Object.keys(BAR),
    });
    const { categories, audits } = result.lhr;
    console.info(`\n${url}`);
    for (const [key, bar] of Object.entries(BAR)) {
      const score = Math.round((categories[key]?.score ?? 0) * 100);
      if (score < bar) failed = true;
      console.info(
        `  ${key.padEnd(15)} ${String(score).padStart(3)}  (bar ${bar})${score < bar ? "  BELOW" : ""}`,
      );
    }
    for (const id of [
      "first-contentful-paint",
      "largest-contentful-paint",
      "total-blocking-time",
      "cumulative-layout-shift",
    ]) {
      console.info(`  ${id.padEnd(26)} ${audits[id]?.displayValue ?? "?"}`);
    }
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
