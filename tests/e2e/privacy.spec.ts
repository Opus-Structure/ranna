import { expect, test } from "@playwright/test";

/**
 * What a visitor's browser does without being asked: no third-party requests (analytics, fonts,
 * embeds), no cookie beyond the language one, and no consent banner to dismiss because nothing
 * optional is set. Shop photos may come from the file-storage origin.
 */
const pages = ["/en", "/fr/pricing", "/ar/login", "/en/legal/cookies", "/en/s/demo"];
const assetsOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_ASSETS_URL ?? "").origin;
  } catch {
    return null;
  }
})();

for (const path of pages) {
  test(`${path} loads nothing from third parties and sets only the language cookie`, async ({
    page,
    context,
    baseURL,
  }) => {
    const origin = new URL(baseURL ?? "http://localhost:3000").origin;
    const foreign: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (!/^https?:$/.test(url.protocol)) return;
      if (url.origin !== origin && url.origin !== assetsOrigin) foreign.push(request.url());
    });
    await page.goto(path, { waitUntil: "networkidle" });
    expect(foreign, "requests to other origins").toEqual([]);
    expect(
      (await context.cookies()).map((c) => c.name),
      "cookies set for an anonymous visitor",
    ).toEqual(expect.arrayContaining([]));
    for (const cookie of await context.cookies()) expect(cookie.name).toBe("NEXT_LOCALE");
    await expect(page.getByRole("dialog", { name: /cookie/i })).toHaveCount(0);
    expect(await page.locator("iframe, embed, object").count()).toBe(0);
  });
}

test("the four legal documents are reachable from the footer", async ({ page }) => {
  await page.goto("/en", { waitUntil: "networkidle" });
  const footer = page.getByRole("contentinfo");
  for (const name of ["Terms", "Privacy", "Cookies", "Refunds"]) {
    await expect(footer.getByRole("link", { name })).toBeVisible();
  }
});

test("the shop page links the privacy, cookie and refund policies", async ({ page }) => {
  await page.goto("/en/s/demo", { waitUntil: "networkidle" });
  const legal = page.getByRole("navigation", { name: "Legal" });
  for (const name of ["Privacy", "Cookies", "Refunds"]) {
    await expect(legal.getByRole("link", { name })).toBeVisible();
  }
});
