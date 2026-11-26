import { fee, lateFee } from "@rungs/core";
import drawTmpl from "@rungs/skill/prompts/draw.md?raw";
import openTmpl from "@rungs/skill/prompts/open.md?raw";
import repayTmpl from "@rungs/skill/prompts/repay.md?raw";
import { fillPrompt } from "@rungs/skill/render";
import { useEffect, useState } from "react";
import { KEEPER_URL, type Site, type Stats, api } from "../api";
import { AddressField } from "../components/AddressField";
import { Notice, PromptBlock, ScrollRegion, Skeleton, StatTile } from "../components/ui";
import { usdt } from "../format";
import { S } from "../strings";

const PROMPTS: Record<string, string> = { open: openTmpl, draw: drawTmpl, repay: repayTmpl };
const U = 10n ** 18n;

export function Home({ site }: { site: Site | null }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);
  const live = site?.mode !== "comingSoon";
  useEffect(() => {
    if (!live) return;
    api
      .stats()
      .then(setStats)
      .catch(() => setFailed(true));
  }, [live]);
  const n = stats?.excludingTeam;
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title">
          {S.home.h1a}
          <br />
          <span className="accent-text">{S.home.h1b}</span>
        </h1>
        <p>{S.home.sub}</p>
        <AddressField />
      </section>

      {!live ? (
        <Notice kind="info">{S.home.comingSoon}</Notice>
      ) : (
        <section className="stack-sm" aria-label="Live numbers">
          <div className="grid-4">
            {failed ? (
              <Notice kind="error">{S.line.apiDown}</Notice>
            ) : n && stats ? (
              <>
                <StatTile value={String(n.holders)} label={S.home.stats.holders} to="/open" />
                <StatTile value={String(n.repaidOnTime)} label={S.home.stats.onTime} to="/open" />
                <StatTile value={String(n.writtenOff)} label={S.home.stats.writtenOff} to="/open" />
                <StatTile value={`${usdt(stats.pool.idle)} USDT`} label={S.home.stats.pool} to="/open" />
              </>
            ) : (
              [0, 1, 2, 3].map((i) => (
                <div key={i} className="card">
                  <Skeleton />
                </div>
              ))
            )}
          </div>
          <p className="small muted">{S.home.stats.note}</p>
        </section>
      )}

      <section className="stack" aria-labelledby="how-title">
        <h2 id="how-title">{S.home.howTitle}</h2>
        <div className="grid-3">
          {S.home.how.map((h) => (
            <article key={h.title} className="card stack card-fill">
              <h3>{h.title}</h3>
              <p className="muted">{h.body}</p>
              <PromptBlock
                label="Prompt"
                what="paste into your AI agent"
                text={fillPrompt(PROMPTS[h.command]!, { KEEPER_URL, AMOUNT: "1" }).trim()}
              />
            </article>
          ))}
        </div>
      </section>

      <section className="stack" aria-labelledby="cost-title">
        <h2 id="cost-title">{S.home.costTitle}</h2>
        <p className="muted">{S.home.costIntro}</p>
        <ScrollRegion label="Fee examples">
          <table>
            <caption className="sr-only">Fee examples</caption>
            <thead>
              <tr>
                <th scope="col">Borrow</th>
                <th scope="col" className="num">
                  Fee
                </th>
                <th scope="col" className="num">
                  Repay on time
                </th>
                <th scope="col" className="num">
                  Repay late
                </th>
              </tr>
            </thead>
            <tbody>
              {[1n, 10n, 50n].map((x) => {
                const p = x * U;
                return (
                  <tr key={String(x)}>
                    <td className="mono">{usdt(p)} USDT</td>
                    <td className="num mono">{usdt(fee(p))}</td>
                    <td className="num mono">{usdt(p + fee(p))}</td>
                    <td className="num mono">{usdt(p + fee(p) + lateFee(p))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollRegion>
      </section>

      <section className="stack" aria-labelledby="wrong-title">
        <h2 id="wrong-title">{S.home.wrongTitle}</h2>
        <ul className="plain">
          {S.home.wrong.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
