// A tiny history router: six routes, no dependency.

import { useEffect, useState } from "react";

export type Route =
  | { name: "home" }
  | { name: "line"; address: string }
  | { name: "ladder" }
  | { name: "vouch" }
  | { name: "open" }
  | { name: "agents" }
  | { name: "notFound" };

export function parse(pathname: string): Route {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/") return { name: "home" };
  const m = /^\/line\/([^/]+)$/.exec(p);
  if (m) return { name: "line", address: decodeURIComponent(m[1]!) };
  if (p === "/ladder") return { name: "ladder" };
  if (p === "/vouch") return { name: "vouch" };
  if (p === "/open") return { name: "open" };
  if (p === "/agents") return { name: "agents" };
  return { name: "notFound" };
}

export function navigate(to: string): void {
  window.history.pushState(null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.pathname));
  useEffect(() => {
    const on = () => setRoute(parse(window.location.pathname));
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  return route;
}

/** An in-app link: plain <a href> so it works without JS and with the keyboard. */
export function onLinkClick(e: React.MouseEvent<HTMLAnchorElement>): void {
  const a = e.currentTarget;
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target) return;
  const url = new URL(a.href);
  if (url.origin !== window.location.origin) return;
  e.preventDefault();
  navigate(url.pathname + url.search);
}
