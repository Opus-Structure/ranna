import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** Public pages in every language, checked against WCAG 2.2 A/AA rules by axe. */
const pages = [
  "/",
  "/fr",
  "/en",
  "/en/legal/terms",
  "/legal/privacy",
  "/en/login",
  "/fr/signup",
  "/en/s/demo",
  "/s/demo",
];

for (const path of pages) {
  test(`no WCAG A/AA violations on ${path}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path, { waitUntil: "networkidle" });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      // The Next.js dev-mode indicator is not part of the app.
      .exclude("nextjs-portal")
      .analyze();
    const summary = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      targets: v.nodes.slice(0, 4).map((n) => n.target.join(" ")),
    }));
    expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
  });
}
