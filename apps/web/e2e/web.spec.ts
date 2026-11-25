import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { findBannedPhrases } from "@rungs/skill/lint";
import { ADDR, ROUTES, expectNoSidewaysScroll, mockApi } from "./mock";

const LINE_STATES = Object.entries(ADDR)
  .filter(([k]) => k !== "evil")
  .map(([k, a]) => [k, `/line/${a}`] as const);
const ALL_PATHS = [...new Set([...ROUTES, ...LINE_STATES.map(([, p]) => p)])];

test.describe("T-W01 no sideways scroll", () => {
  for (const path of ALL_PATHS) {
    test(path, async ({ page }) => {
      await mockApi(page);
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expectNoSidewaysScroll(page);
    });
  }
});

test.describe("T-W02 /line renders each state", () => {
  const expectations: Record<string, RegExp> = {
    noId: /does not hold an Agent ID/,
    noLine: /Open your line/,
    open: /Borrow/,
    current: /You owe 2\.02 USDT by/,
    late: /This loan is late/,
    defaultable: /can be written off at any moment/,
    writtenOff: /was written off\. Paying 5\.10 USDT unfreezes the line at rung 0/,
    cured: /1 of 2 on-time repayments/,
    top: /Top rung reached/,
    down: /Showing nothing rather than guessing/,
  };
  for (const [state, path] of LINE_STATES) {
    test(state, async ({ page }) => {
      await mockApi(page);
      await page.goto(path);
      await expect(page.getByRole("main")).toContainText(expectations[state]!);
    });
  }
  test("top rung shows the vouched part and the ladder at rung 6", async ({ page }) => {
    await mockApi(page);
    await page.goto(`/line/${ADDR.top}`);
    await expect(page.getByText("+ 10 USDT vouched")).toBeVisible();
    await expect(page.getByRole("list", { name: "The ladder: rung 6 of 6" })).toBeVisible();
    await expect(page.getByTestId("limit")).toHaveText("60 USDT");
  });
});

test("T-W03 the draw card shows amount, fee, total, due date and the late rule before any command", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto(`/line/${ADDR.open}`);
  const card = page.locator("section", { has: page.getByRole("heading", { name: "Borrow" }) });
  const terms = card.getByTestId("draw-terms");
  await expect(terms).toContainText("2 USDT");
  await expect(terms).toContainText("0.02 USDT");
  await expect(terms).toContainText("2.02 USDT");
  await expect(card.getByTestId("late-rule")).toContainText("Late adds 0.02 USDT");
  await expect(card.locator("pre").first()).toBeVisible();
  const order = await card.evaluate((el) => {
    const t = el.querySelector("[data-testid=draw-terms]")!;
    const l = el.querySelector("[data-testid=late-rule]")!;
    const pre = el.querySelector("pre")!;
    const before = (a: Element, b: Element) =>
      !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    return before(t, pre) && before(l, pre);
  });
  expect(order).toBe(true);
  // the stepper stays inside the limit
  await card.getByRole("button", { name: "Borrow 1 USDT more" }).click();
  await expect(terms).toContainText("2.02 USDT");
  await card.getByRole("button", { name: "Borrow 1 USDT less" }).click();
  await expect(terms).toContainText("1.01 USDT");
});

test("T-W04 copy buttons copy exactly the command the API returned", async ({ page }) => {
  const api = await mockApi(page);
  await page.goto(`/line/${ADDR.open}`);
  const card = page.locator("section", { has: page.getByRole("heading", { name: "Borrow" }) });
  const cli = card.getByRole("button", { name: /Copy: Or preview it yourself/ });
  await expect(cli).toBeVisible();
  await expect.poll(() => api.calls.some((c) => c.path.includes("/actions/draw?amount=2"))).toBe(true);
  await cli.click();
  await expect(cli).toContainText("Copied");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const want = `baw contract-call preview --binanceChainId 56 --from ${ADDR.open} --to 0x1111111111111111111111111111111111111111 --value 0 --inputData 0x${Buffer.from("draw-2").toString("hex")} --json`;
  expect(copied).toBe(want);
  // the agent prompt is copied as shown, with the amount
  const prompt = card.getByRole("button", { name: /Copy: Paste into your AI agent/ });
  await prompt.click();
  const p = await page.evaluate(() => navigator.clipboard.readText());
  expect(p).toContain("actions/draw?amount=2");
  expect(p).toMatch(/Show me the preview and wait for my yes before each step\.$/);
});

test.describe("T-W05 page mode follows /v1/public/site", () => {
  test("blocked", async ({ page }) => {
    await mockApi(page, {
      "GET /v1/public/site": {
        blocked: true,
        reason: "Rungs is not available in your region.",
        mode: "live",
        notice: null,
      },
    });
    await page.goto("/");
    await expect(page.getByRole("main")).toContainText("not available in your region");
    await expect(page.getByRole("heading", { name: /Your name can borrow/ })).toHaveCount(0);
  });
  test("paused", async ({ page }) => {
    await mockApi(page, {
      "GET /v1/public/site": {
        blocked: false,
        reason: null,
        mode: "paused",
        notice: "New loans are paused.",
      },
    });
    await page.goto("/");
    await expect(page.getByRole("status")).toContainText("New loans are paused.");
  });
  test("coming soon gates only the front door", async ({ page }) => {
    const api = await mockApi(page, {
      "GET /v1/public/site": { blocked: false, reason: null, mode: "comingSoon", notice: null },
    });
    await page.goto("/");
    await expect(page.getByRole("main")).toContainText("Rungs is not open yet");
    expect(api.calls.some((c) => c.path === "/v1/stats")).toBe(false);
    await page.goto(`/line/${ADDR.current}`);
    await expect(page.getByRole("main")).toContainText("You owe");
  });
  test("live", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await expect(page.getByRole("link", { name: /holders with a line/ })).toContainText("4");
  });
});

test("T-W06 a handle with markup renders as text", async ({ page }) => {
  await mockApi(page);
  await page.goto(`/line/${ADDR.evil}`);
  await expect(page.getByTestId("handle")).toHaveText(
    "<img src=x onerror=window.__pwned=1><script>window.__pwned=2</script>.ai",
  );
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  expect(await page.locator("main img").count()).toBe(0);
});

test.describe("T-W07 accessibility", () => {
  for (const path of [...ROUTES, `/line/${ADDR.open}`, `/line/${ADDR.late}`, `/line/${ADDR.noLine}`]) {
    test(`axe has no serious issues on ${path}`, async ({ page }) => {
      await mockApi(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const r = await new AxeBuilder({ page }).analyze();
      const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
    });
  }
  test("keyboard only: find a line and focus is visible", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    const field = page.getByLabel("Open my line", { exact: true });
    for (let i = 0; i < 20 && !(await field.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press("Tab");
    }
    await expect(field).toBeFocused();
    const outline = await field.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");
    await page.keyboard.type(ADDR.current);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/line/${ADDR.current}$`));
    await expect(page.getByRole("main")).toContainText("You owe");
  });
});

test.describe("T-W08 risk notice on every route", () => {
  for (const path of ALL_PATHS) {
    test(path, async ({ page }) => {
      await mockApi(page);
      await page.goto(path);
      await expect(page.getByTestId("risk-notice")).toContainText(
        "Rungs is an experimental, unaudited lending pilot.",
      );
    });
  }
});

test("T-W09 no sign-in, QR, pairing-code or secret input anywhere", async ({ page }) => {
  await mockApi(page);
  for (const path of [...ROUTES, `/line/${ADDR.noLine}`, `/line/${ADDR.open}`]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await page.locator("input[type=password]").count(), path).toBe(0);
    expect(await page.locator("canvas, img[alt*=QR i]").count(), path).toBe(0);
    const controls = await page.evaluate(() =>
      [...document.querySelectorAll("input, textarea, button, label, [role=button]")]
        .map(
          (e) =>
            `${e.textContent ?? ""} ${e.getAttribute("aria-label") ?? ""} ${e.getAttribute("placeholder") ?? ""} ${e.getAttribute("name") ?? ""}`,
        )
        .join("\n"),
    );
    expect(controls, path).not.toMatch(
      /sign.?in|log.?in|connect|seed|private key|mnemonic|pairing|secret|password|qr/i,
    );
    expect(await page.evaluate(() => document.cookie), path).toBe("");
  }
});

test("T-W10 banned phrases are absent from all copy", async ({ page }) => {
  await mockApi(page);
  for (const path of ALL_PATHS) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const text = await page.evaluate(() => document.body.innerText);
    expect(findBannedPhrases(text), path).toEqual([]);
  }
});

test("T-W11 there is no name search: the address field refuses anything but an address", async ({ page }) => {
  const api = await mockApi(page);
  await page.goto("/");
  const field = page.getByLabel("Open my line", { exact: true });
  for (const name of ["dewi.ai", "dewi", "0x1234"]) {
    await field.fill(name);
    await page.getByRole("button", { name: "Open", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText("Enter a wallet address. Rungs does not look up names.");
    await expect(page).toHaveURL(/\/$/);
  }
  expect(api.calls.filter((c) => c.path.startsWith("/v1/lines/"))).toEqual([]);
  await page.goto("/line/dewi.ai");
  await expect(page.getByRole("main")).toContainText("Rungs does not look up names");
});

test("T-W12 no Binance or BNB in the product name, logo alt text or title", async ({ page }) => {
  await mockApi(page);
  for (const path of ROUTES) {
    await page.goto(path);
    expect(await page.title(), path).not.toMatch(/binance|bnb/i);
    const brand = await page.getByRole("link", { name: "Rungs home" }).innerText();
    expect(brand).toBe("Rungs");
    const alts = await page.evaluate(() =>
      [...document.querySelectorAll("img, svg[aria-label], [role=img]")].map(
        (e) => e.getAttribute("alt") ?? e.getAttribute("aria-label") ?? "",
      ),
    );
    for (const a of alts) expect(a, path).not.toMatch(/binance|bnb/i);
    expect(await page.locator("meta[property='og:site_name']").getAttribute("content")).toBe("Rungs");
  }
});
