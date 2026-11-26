// The rules, vouching, open books and agent pages.

import { isAddress } from "@rungs/chain";
import vouchTmpl from "@rungs/skill/prompts/vouch.md?raw";
import { fillPrompt } from "@rungs/skill/render";
import { useEffect, useId, useState } from "react";
import { type Config, EXPLORER, KEEPER_URL, REPO_URL, type Stats, api } from "../api";
import { Ladder } from "../components/Ladder";
import { Notice, PromptBlock, ScrollRegion, Skeleton, Time } from "../components/ui";
import { usdt } from "../format";
import { S } from "../strings";

export function LadderPage() {
  return (
    <>
      <section className="stack" aria-labelledby="t">
        <h1 id="t">{S.ladder.title}</h1>
        <p className="muted">{S.ladder.intro}</p>
        <div className="card">
          <Ladder level={null} />
        </div>
      </section>
      <section className="stack" aria-labelledby="o">
        <h2 id="o">{S.ladder.outcomesTitle}</h2>
        <ScrollRegion label="Outcomes">
          <table>
            <tbody>
              {S.ladder.outcomes.map(([k, v]) => (
                <tr key={k}>
                  <th scope="row">{k}</th>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
      </section>
      <section className="grid-2">
        <div className="card stack-sm">
          <h3>{S.ladder.probationTitle}</h3>
          <p className="muted">{S.ladder.probation}</p>
        </div>
        <div className="card stack-sm">
          <h3>{S.ladder.holdTitle}</h3>
          <p className="muted">{S.ladder.hold}</p>
        </div>
      </section>
    </>
  );
}

export function VouchPage() {
  const [borrower, setBorrower] = useState("");
  const [amount, setAmount] = useState("5");
  const bId = useId();
  const aId = useId();
  const okB = isAddress(borrower.trim());
  const okA = /^\d{1,6}(\.\d{1,18})?$/.test(amount.trim()) && Number(amount) >= 1;
  return (
    <>
      <section className="stack" aria-labelledby="t">
        <h1 id="t">{S.vouch.title}</h1>
        <p className="muted">{S.vouch.intro}</p>
      </section>
      <section className="grid-2">
        <div className="card stack-sm">
          <h3>{S.vouch.lossTitle}</h3>
          <ol className="steps">
            {S.vouch.loss.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>
          <p className="small muted">{S.vouch.cureNote}</p>
        </div>
        <div className="card stack-sm">
          <h3>Limits</h3>
          <p className="muted">{S.vouch.limits}</p>
          <p className="muted">{S.vouch.unlock}</p>
        </div>
      </section>
      <section className="card stack" aria-labelledby="agent-path">
        <h2 id="agent-path">{S.vouch.agentPath}</h2>
        <div className="stepper">
          <label htmlFor={bId} className="small">
            Their wallet address
          </label>
          <input
            id={bId}
            className="mono input-wide"
            value={borrower}
            onChange={(e) => setBorrower(e.target.value)}
            placeholder="0x…"
            spellCheck={false}
            autoComplete="off"
            aria-invalid={borrower !== "" && !okB ? "true" : "false"}
          />
        </div>
        {borrower !== "" && !okB && (
          <p className="field-error" role="alert">
            {S.address.refuse}
          </p>
        )}
        <div className="stepper">
          <label htmlFor={aId} className="small">
            Stake (USDT)
          </label>
          <input id={aId} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <Notice kind="risk">If their loan is written off, your stake is taken first.</Notice>
        {okB && okA ? (
          <PromptBlock
            label="Prompt"
            what="paste into your AI agent"
            text={fillPrompt(vouchTmpl, {
              KEEPER_URL,
              AMOUNT: amount.trim(),
              BORROWER: borrower.trim(),
            }).trim()}
          />
        ) : (
          <p className="small muted">
            Enter their wallet address and a stake of at least 1 USDT to get the prompt.
          </p>
        )}
        <p className="small muted">{S.vouch.walletPath}</p>
      </section>
    </>
  );
}

const PERMS: [string, string, string, string][] = [
  ["fund", "Add the owner's own USDT as lending capital.", "Take anyone else's money.", "None"],
  [
    "defund",
    "Take back capital that is not lent out (idle).",
    "Touch stakes, claimable balances, the reserve or money lent.",
    "None",
  ],
  ["sweepReserve", "Move the reserve into lending capital.", "Run while any loan is outstanding.", "None"],
  [
    "setCaps",
    "Lower the lending caps at once; queue a raise.",
    "Raise a cap at once, or raise one cap while lowering the other.",
    "Raise: 2 days",
  ],
  [
    "executeCapsRaise / cancelCapsRaise",
    "Apply a queued raise after its delay, or drop it.",
    "Apply it early.",
    "—",
  ],
  [
    "setPaused",
    "Stop new lines, loans and stakes.",
    "Block repayments, write-offs, unvouching or claims.",
    "None",
  ],
  [
    "transferOwnership",
    "Hand the owner role to another address in two steps.",
    "Renounce ownership (disabled), upgrade the contract, change the ladder.",
    "Needs acceptance",
  ],
];

export function OpenPage() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    api
      .config()
      .then(setCfg)
      .catch(() => setFailed(true));
    api
      .stats()
      .then(setStats)
      .catch(() => setFailed(true));
  }, []);
  const addr = (a: string | null | undefined, label: string) =>
    a ? (
      <a className="mono break" href={`${EXPLORER}/address/${a}#code`} target="_blank" rel="noreferrer">
        {a}
      </a>
    ) : (
      <span className="muted">{label}</span>
    );
  return (
    <>
      <section className="stack" aria-labelledby="t">
        <h1 id="t">{S.open.title}</h1>
        <p className="muted">{S.open.howCounted}</p>
        {failed && <Notice kind="error">{S.line.apiDown}</Notice>}
      </section>
      <section className="card stack-sm" aria-labelledby="c">
        <h2 id="c">{S.open.contracts}</h2>
        <dl className="kv">
          <dt>RungsPool</dt>
          <dd>{addr(cfg?.pool, S.footer.notDeployed)}</dd>
          <dt>USDT</dt>
          <dd>{addr(cfg?.usdt ?? "0x55d398326f99059fF775485246999027B3197955", "")}</dd>
          <dt>Agent ID registry</dt>
          <dd>{addr(cfg?.registry ?? "0x60b9262456de011f7d15a54cdd8c48baaa8b022f", "")}</dd>
          <dt>{S.open.owner}</dt>
          <dd>{addr(cfg?.owner, "—")}</dd>
        </dl>
        <p className="small">
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            Source, tests and PROVEN.md
          </a>
        </p>
      </section>
      <section className="stack" aria-labelledby="p">
        <h2 id="p">{S.open.permissions}</h2>
        <ScrollRegion label="Owner permissions">
          <table>
            <thead>
              <tr>
                {S.open.permHead.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMS.map((r) => (
                <tr key={r[0]}>
                  <td className="mono">{r[0]}</td>
                  <td>{r[1]}</td>
                  <td>{r[2]}</td>
                  <td>{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
        <p className="small muted">
          The owner can never move tokens out of a holder's wallet, touch stakes or claimable balances, change
          a loan's terms, or change the ladder's limits and fees (they are constants in the contract).
        </p>
      </section>
      <section className="grid-3">
        <div className="card stack-sm">
          <h3>{S.open.caps}</h3>
          {stats ? (
            <>
              <dl className="kv">
                <dt>Max lent at once</dt>
                <dd>{usdt(stats.pool.maxOutstanding)} USDT</dd>
                <dt>New borrowers a day</dt>
                <dd>{stats.pool.dailyNewLineCap}</dd>
              </dl>
              <p className="small muted">
                {stats.pool.queuedCapRaise ? (
                  <>
                    A cap raise is queued and can apply from{" "}
                    <Time unix={Number(stats.pool.queuedCapRaise.eta)} />.
                  </>
                ) : (
                  S.open.noQueued
                )}
              </p>
            </>
          ) : (
            <Skeleton />
          )}
        </div>
        <div className="card stack-sm">
          <h3>{S.open.pool}</h3>
          {stats ? (
            <dl className="kv">
              <dt>Available</dt>
              <dd>{usdt(stats.pool.idle)}</dd>
              <dt>Lent now</dt>
              <dd>{usdt(stats.pool.outstanding)}</dd>
              <dt>Reserve</dt>
              <dd>{usdt(stats.pool.reserve)}</dd>
              <dt>Staked</dt>
              <dd>{usdt(stats.pool.totalStaked)}</dd>
              <dt>Unrecovered loss</dt>
              <dd>{usdt(stats.pool.socialisedLoss)}</dd>
            </dl>
          ) : (
            <Skeleton />
          )}
        </div>
        <div className="card stack-sm">
          <h3>Activity</h3>
          {stats ? (
            <dl className="kv">
              <dt>Holders (all / excl. team)</dt>
              <dd>
                {stats.all.holders} / {stats.excludingTeam.holders}
              </dd>
              <dt>Loans drawn</dt>
              <dd>{stats.excludingTeam.loansDrawn}</dd>
              <dt>Repaid on time</dt>
              <dd>{stats.excludingTeam.repaidOnTime}</dd>
              <dt>Repaid late</dt>
              <dd>{stats.excludingTeam.repaidLate}</dd>
              <dt>Written off</dt>
              <dd>{stats.excludingTeam.writtenOff}</dd>
              <dt>Cured</dt>
              <dd>{stats.excludingTeam.cured}</dd>
              <dt>Vouches</dt>
              <dd>{stats.excludingTeam.vouches}</dd>
            </dl>
          ) : (
            <Skeleton />
          )}
        </div>
      </section>
      <section className="stack" aria-labelledby="l">
        <h2 id="l">{S.open.lossByRung}</h2>
        <ScrollRegion label="Loss by rung">
          <table>
            <thead>
              <tr>
                <th scope="col">{S.open.rung}</th>
                <th scope="col" className="num">
                  {S.open.holdersNow}
                </th>
                <th scope="col" className="num">
                  {S.open.drawn}
                </th>
                <th scope="col" className="num">
                  {S.open.wo}
                </th>
                <th scope="col" className="num">
                  {S.open.lossPrincipal}
                </th>
              </tr>
            </thead>
            <tbody>
              {(stats?.excludingTeam.byRung ?? []).map((r) => (
                <tr key={r.level}>
                  <td>{r.level}</td>
                  <td className="num mono">{r.holdersNow}</td>
                  <td className="num mono">{r.drawn}</td>
                  <td className="num mono">{r.writtenOff}</td>
                  <td className="num mono">{usdt(r.lossPrincipal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
      </section>
      <section className="card stack-sm" aria-labelledby="np">
        <h2 id="np">{S.open.notProven}</h2>
        <ul className="plain">
          {S.open.notProvenList.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </section>
    </>
  );
}

export function AgentsPage() {
  const links = [
    `${KEEPER_URL}/llms.txt`,
    `${KEEPER_URL}/skill.md`,
    `${KEEPER_URL}/v1/lines/0xYourAddress`,
    REPO_URL,
    `${REPO_URL}/blob/main/docs/INTEGRATE.md`,
  ];
  return (
    <>
      <section className="stack" aria-labelledby="t">
        <h1 id="t">{S.agents.title}</h1>
        <Notice kind="info">{S.agents.never}</Notice>
      </section>
      <section className="card stack" aria-labelledby="h">
        <h2 id="h">{S.agents.humans}</h2>
        <ol className="steps">
          {S.agents.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>
      <section className="card stack" aria-labelledby="a">
        <h2 id="a">{S.agents.forAgent}</h2>
        <ul className="plain">
          {S.agents.links.map((label, i) => (
            <li key={label}>
              <a href={links[i]} target="_blank" rel="noreferrer">
                {label}
              </a>{" "}
              <span className="mono small muted break">{links[i]}</span>
            </li>
          ))}
        </ul>
        <PromptBlock
          label="Example"
          what="the read call an agent makes first"
          text={`GET ${KEEPER_URL}/v1/lines/<your wallet address>`}
          nowrap
        />
      </section>
    </>
  );
}
