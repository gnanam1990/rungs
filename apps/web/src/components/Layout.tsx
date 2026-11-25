import type { ReactNode } from "react";
import { EXPLORER, REPO_URL, type Site } from "../api";
import { type Route, onLinkClick } from "../router";
import { S } from "../strings";
import { AddressField } from "./AddressField";
import { Wordmark } from "./Ladder";
import { RiskNotice } from "./ui";

const NAV: [Route["name"], string, string][] = [
  ["ladder", "/ladder", S.nav.ladder],
  ["vouch", "/vouch", S.nav.vouch],
  ["open", "/open", S.nav.open],
  ["agents", "/agents", S.nav.agents],
];

export function Layout({
  route,
  site,
  pool,
  children,
}: {
  route: Route;
  site: Site | null;
  pool: string | null;
  children: ReactNode;
}) {
  return (
    <>
      <a className="sr-only" href="#main">
        Skip to content
      </a>
      <header className="header">
        <div className="wrap">
          <a className="brand" href="/" onClick={onLinkClick} aria-label="Rungs home">
            <Wordmark />
            <span>{S.product}</span>
          </a>
          <nav className="nav" aria-label="Main">
            {NAV.map(([name, href, label]) => (
              <a
                key={href}
                href={href}
                onClick={onLinkClick}
                aria-current={route.name === name ? "page" : undefined}
              >
                {label}
              </a>
            ))}
          </nav>
          {route.name !== "home" && <AddressField compact />}
        </div>
      </header>
      {site?.mode === "paused" && (
        // biome-ignore lint/a11y/useSemanticElements: a live status banner, not the result of a form
        <div className="banner" role="status">
          <div className="wrap">{site.notice ?? S.paused}</div>
        </div>
      )}
      <main id="main" className="wrap" tabIndex={-1}>
        {children}
      </main>
      <footer className="footer">
        <div className="wrap">
          <RiskNotice />
          <p>{S.independence}</p>
          <div className="footer-links">
            <span>
              {S.footer.contract}:{" "}
              {pool ? (
                <a
                  className="mono break"
                  href={`${EXPLORER}/address/${pool}#code`}
                  rel="noreferrer"
                  target="_blank"
                >
                  {pool}
                </a>
              ) : (
                <span>{S.footer.notDeployed}</span>
              )}
            </span>
            <a href={REPO_URL} rel="noreferrer" target="_blank">
              {S.footer.repo}
            </a>
            <a href={`${REPO_URL}/blob/main/docs/INTEGRATE.md`} rel="noreferrer" target="_blank">
              {S.footer.integrate}
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
