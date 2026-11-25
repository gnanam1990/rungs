# Debug snippets

## Which element makes the page wider than the phone?

Run in the page (Playwright `page.evaluate`, the browser console, or a browser tool's JS runner) at phone width:

```js
(() => {
  const lim = window.innerWidth; // or the phone width you expect, e.g. 412
  const out = [];
  for (const e of document.querySelectorAll("body *")) {
    const r = e.getBoundingClientRect();
    if (r.right > lim + 1 && r.width > 0) {
      const childTooWide = [...e.children].some((k) => k.getBoundingClientRect().right > lim + 1);
      if (!childTooWide)
        out.push(`${e.tagName}.${String(e.className).slice(0, 40)} right=${Math.round(r.right)} w=${Math.round(r.width)} "${(e.textContent || "").trim().slice(0, 40)}"`);
    }
  }
  return { innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth, widest: out.slice(0, 15) };
})();
```

If `innerWidth` is bigger than the device width after an action (412 → 518), the page widened and the phone zoomed out. That is also why `scrollWidth - innerWidth` is useless as a phone overflow test: both grow together. Compare `scrollWidth` with `page.viewportSize().width` (or the known device width) instead. Fix the leaf elements listed. Decorative absolutely positioned layers (grain, giant faint words) usually sit inside an `overflow: hidden` parent and can be ignored.

## What is on top of a button?

```js
(() => {
  const btn = document.querySelector(".tabbar button");
  const b = btn.getBoundingClientRect();
  const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
  const chain = [];
  for (let e = btn; e; e = e.parentElement) {
    const s = getComputedStyle(e);
    chain.push(`${e.tagName}.${e.className}|pos=${s.position}|z=${s.zIndex}|tf=${s.transform}|op=${s.opacity}`);
  }
  return { hit: hit && `${hit.tagName}.${hit.className}`, chain };
})();
```

A `transform`, `opacity < 1`, `filter` or `will-change` on an ancestor creates a stacking context and can trap `z-index`. If the hit element is the button's own icon, the stacking is fine, and the real problem is the viewport (see above).

## A throw-away Playwright probe

Put it in `e2e/zz-debug.spec.ts`, run one project, read the console output, then delete the file:

```ts
import { test } from "@playwright/test";
import { mockApi } from "./mock-api.ts";
test("probe", async ({ page }) => {
  await mockApi(page);
  await page.goto("/app/");
  // …reach the broken state…
  console.log(JSON.stringify(await page.evaluate(() => ({ w: innerWidth, sw: document.documentElement.scrollWidth }))));
});
```

```
pnpm exec playwright test -c apps/web/playwright.config.ts --project=phone --reporter=line e2e/zz-debug.spec.ts
```

## Is the change live?

```bash
html=$(curl -s https://example.app/me)
js=$(echo "$html" | grep -o '/app/assets/[^"]*\.js' | head -1)
css=$(echo "$html" | grep -o '/app/assets/[^"]*\.css' | head -1)
curl -s "https://example.app$js" | grep -c "Notify me at launch"      # a new string
curl -s "https://example.app$css" | grep -o '\.tabs{[^}]*}'           # a new CSS rule
curl -s https://example.app/v1/public/site                            # a server flag
```

A guard check is also worth doing. A POST without the site's Origin should answer 403, and bad input should answer 400 with the user-facing message.
