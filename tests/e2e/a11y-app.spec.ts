import AxeBuilder from "@axe-core/playwright";
import { config } from "dotenv";
import { expect, test, type Page } from "@playwright/test";

config({ path: ".env.local", quiet: true });

/**
 * WCAG A/AA axe passes on the live-service surfaces the public-page spec cannot reach: the
 * customer's ticket (waiting and ringing), the staff order board in light and dark, and the
 * call-out screen. Needs `npm run seed` (demo shop + owner credentials).
 */
test.describe.configure({ mode: "serial" });

const email = process.env.SEED_DEMO_EMAIL || "demo@ranna.local";
const password = process.env.SEED_DEMO_PASSWORD;

test.skip(!password, "SEED_DEMO_PASSWORD is not set (run npm run seed with it in .env.local)");

const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(tags).exclude("nextjs-portal").analyze();
  const summary = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    targets: v.nodes.slice(0, 4).map((n) => n.target.join(" ")),
  }));
  expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
}

/** Retries the click: on a cold dev server the first one can land before React hydrates. */
async function addBlackCoffee(page: Page) {
  await expect(async () => {
    await page.getByRole("button", { name: /Black coffee/ }).click();
    await expect(page.getByRole("button", { name: /^Add/ })).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000 });
  await page.getByRole("button", { name: /^Add/ }).click();
}

async function logIn(page: Page, next: string) {
  await page.goto(`/en/login?next=${next}`);
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.locator("input[type=password]").fill(password!);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(new RegExp(next));
}

test("customer ticket has no violations while waiting", async ({ browser }) => {
  const page = await (
    await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  ).newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/s/demo", { waitUntil: "networkidle" });
  await addBlackCoffee(page);
  await page.getByRole("button", { name: /Review order/ }).click();
  await page.getByLabel("Your name").fill(`A11y ${Date.now().toString().slice(-6)}`);
  await page.getByRole("button", { name: /Place order/ }).click();
  await page.waitForURL(/\/en\/o\/[A-Za-z0-9_-]{22}$/);
  await expect(page.locator(".order-number").first()).toBeVisible();
  await expectNoViolations(page);
});

for (const scheme of ["light", "dark"] as const) {
  test(`order board has no violations in ${scheme} mode`, async ({ browser }) => {
    const page = await (
      await browser.newContext({ viewport: { width: 1024, height: 768 }, colorScheme: scheme })
    ).newPage();
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: scheme });
    await logIn(page, "/dashboard/orders");
    if (scheme === "dark")
      await page.evaluate(() => document.documentElement.classList.add("dark"));
    await expect(page.getByRole("main")).toBeVisible();
    await expectNoViolations(page);
  });
}

test("call-out screen has no violations", async ({ browser }) => {
  const page = await (
    await browser.newContext({ viewport: { width: 1280, height: 720 } })
  ).newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await logIn(page, "/dashboard/orders");
  await page.goto("/en/screen");
  await expect(page.locator("body")).toBeVisible();
  await expectNoViolations(page);
});

test("ringing alert has no violations, and the board's touch targets are 44px", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const name = `Ring ${Date.now().toString().slice(-6)}`;
  const customer = await (
    await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  ).newPage();
  await customer.emulateMedia({ reducedMotion: "reduce" });
  await customer.goto("/en/s/demo", { waitUntil: "networkidle" });
  await addBlackCoffee(customer);
  await customer.getByRole("button", { name: /Review order/ }).click();
  await customer.getByLabel("Your name").fill(name);
  await customer.getByRole("button", { name: /Place order/ }).click();
  await customer.waitForURL(/\/en\/o\/[A-Za-z0-9_-]{22}$/);

  // A tablet with touch: `pointer: coarse` matches, so the 44px button sizes apply.
  const staff = await (
    await browser.newContext({
      viewport: { width: 1180, height: 820 },
      hasTouch: true,
      isMobile: true,
    })
  ).newPage();
  await logIn(staff, "/dashboard/orders");
  const card = staff.locator("article").filter({ hasText: name });
  // The board is live, but a reload covers a missed first push on a cold dev server.
  await expect(async () => {
    await staff.reload({ waitUntil: "networkidle" });
    await expect(card).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });

  const small = await staff.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("main button, main a[href], main [role=button]")]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ el, r }) => {
        if (r.width === 0 || r.height === 0) return false;
        // Switches draw a 48x28 track with a 44px+ hit area (pseudo-element); the track itself
        // only has to clear the 24px WCAG 2.5.8 minimum.
        if (el.matches("[role=switch]")) return r.height < 24 || r.width < 24;
        return r.height < 44 || r.width < 44;
      })
      // Inline text links inside sentences are exempt (WCAG 2.5.8 inline exception).
      .filter(({ el }) => !el.closest("p, li") || el.matches("button"))
      .map(
        ({ el, r }) =>
          `${el.tagName} "${(el.textContent || el.ariaLabel || "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`,
      ),
  );
  expect(small, small.join("\n")).toEqual([]);

  const start = card.getByRole("button", { name: "Start preparing" });
  const ready = card.getByRole("button", { name: "Ready", exact: true });
  await expect(start.or(ready)).toBeVisible();
  if (await start.isVisible()) await start.click();
  await ready.click();

  const alert = customer.getByRole("alertdialog", { name: "Your order is ready" });
  await expect(alert).toBeVisible({ timeout: 20_000 });
  await expectNoViolations(customer);
});
