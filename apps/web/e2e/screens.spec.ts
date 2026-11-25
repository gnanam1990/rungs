// Screenshots for review and the pull request. Runs only with SCREENSHOTS=1.
import { test } from "@playwright/test";
import { ADDR, mockApi } from "./mock";

const PAGES: [string, string][] = [
  ["home", "/"],
  ["ladder", "/ladder"],
  ["vouch", "/vouch"],
  ["open", "/open"],
  ["agents", "/agents"],
  ...Object.entries(ADDR).map(([k, a]) => [`line-${k}`, `/line/${a}`] as [string, string]),
];

test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1");
for (const [name, path] of PAGES) {
  test(name, async ({ page }, info) => {
    await mockApi(page);
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `../../docs/screenshots/m07/${info.project.name}-${name}.jpg`,
      fullPage: true,
      type: "jpeg",
      quality: 70,
    });
  });
}
