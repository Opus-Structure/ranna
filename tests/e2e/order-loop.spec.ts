import { config } from "dotenv";
import { expect, test, type Page } from "@playwright/test";

config({ path: ".env.local", quiet: true });

/**
 * The whole product in one pass, as two people: a customer orders from the demo café on a
 * phone, the owner moves it on the order board, the customer's page rings, the customer says
 * they're coming, and the board shows it. Needs `npm run seed` (demo shop + owner credentials).
 */
test.describe.configure({ mode: "serial" });

const email = process.env.SEED_DEMO_EMAIL || "demo@ranna.local";
const password = process.env.SEED_DEMO_PASSWORD;

test.skip(!password, "SEED_DEMO_PASSWORD is not set (run npm run seed with it in .env.local)");

async function placeOrder(page: Page, name: string) {
  await page.goto("/en/s/demo");
  await page.getByRole("button", { name: /Black coffee/ }).click();
  await page.getByRole("button", { name: /^Add/ }).click();
  await page.getByRole("button", { name: /Review order/ }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: /Place order/ }).click();
  await page.waitForURL(/\/en\/o\/[A-Za-z0-9_-]{22}$/);
  return Number(await page.locator(".order-number").first().innerText());
}

async function logIn(page: Page) {
  await page.goto("/en/login?next=/dashboard/orders");
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  // The sign-in method radios are also labelled Password / Email link.
  await page.locator("input[type=password]").fill(password!);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/en\/dashboard\/orders/);
}

test("a customer orders, the counter taps Ready, the phone rings, the customer comes", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const name = `E2E ${Date.now().toString().slice(-6)}`;

  const customer = await (
    await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  ).newPage();
  const number = await placeOrder(customer, name);
  expect(number).toBeGreaterThanOrEqual(101);
  await expect(customer.getByRole("heading", { name: "The shop has your order" })).toBeVisible();

  const staff = await (
    await browser.newContext({ viewport: { width: 1440, height: 900 } })
  ).newPage();
  await logIn(staff);
  const card = staff.locator("article").filter({ hasText: name });
  await expect(card).toBeVisible();

  // Move it to Ready (the demo café's autopilot may already have started it: take either path).
  const start = card.getByRole("button", { name: "Start preparing" });
  if (await start.isVisible()) await start.click();
  await card.getByRole("button", { name: "Ready", exact: true }).click();
  await expect(staff.getByText(`${number} is ready.`)).toBeVisible();

  // The customer's page takes over live, without a reload.
  const alert = customer.getByRole("alertdialog", { name: "Your order is ready" });
  await expect(alert).toBeVisible({ timeout: 20_000 });
  await expect(alert.getByText(String(number))).toBeVisible();
  await alert.getByRole("button", { name: "Got it, I’m coming" }).click();
  await expect(alert).toBeHidden();
  await expect(customer.getByText("The shop knows you’re on your way.")).toBeVisible();

  // The board learns the customer is coming.
  await expect(card.getByText("Customer is on the way")).toBeVisible({ timeout: 25_000 });
  await card.getByRole("button", { name: "Collected" }).click();
  await expect(staff.locator("article").filter({ hasText: name })).toHaveCount(0);
});

test("an unknown order link says so", async ({ page }) => {
  await page.goto("/en/o/AAAAAAAAAAAAAAAAAAAAAA");
  await expect(page.getByRole("heading", { name: "Order not found" })).toBeVisible();
});

test("the landing's start form carries the shop name into sign-up", async ({ page }) => {
  await page.goto("/en");
  await page.getByLabel("Your shop’s name").first().fill("Café Test");
  await page
    .getByRole("button", { name: /Create my shop/ })
    .first()
    .click();
  await page.waitForURL(/\/en\/signup\?shop=/);
  await expect(page.getByLabel(/shop name/i)).toHaveValue("Café Test");
});
