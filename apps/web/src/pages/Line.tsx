import { isAddress } from "@rungs/chain";
import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError, EXPLORER, type LineResponse, api, store } from "../api";
import { Ladder } from "../components/Ladder";
import { NextStepCard } from "../components/NextStepCard";
import { Link, Notice, Skeleton, Time } from "../components/ui";
import { short, usdt } from "../format";
import { S } from "../strings";

type State =
  | { kind: "loading" }
  | { kind: "ok"; line: LineResponse }
  | { kind: "down" }
  | { kind: "undeployed" };

export function Line({ address }: { address: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const valid = isAddress(address);
  useEffect(() => {
    if (!valid) return;
    let live = true;
    setState({ kind: "loading" });
    store.set("rungs.lastAddress", address);
    api
      .line(address)
      .then((line) => live && setState({ kind: "ok", line }))
      .catch(
        (e) => live && setState({ kind: e instanceof ApiError && e.status === 503 ? "undeployed" : "down" }),
      );
    return () => {
      live = false;
    };
  }, [address, valid]);

  if (!valid) return <Notice kind="error">{S.address.refuse}</Notice>;
  if (state.kind === "loading")
    return (
      <section className="stack" aria-busy="true" aria-label="Loading the line">
        <Skeleton width="40%" />
        <Ladder level={null} />
      </section>
    );
  if (state.kind === "undeployed") return <Notice kind="info">{S.line.notDeployed}</Notice>;
  if (state.kind === "down")
    return (
      <Notice kind="error">
        {S.line.apiDown} <Link to="/agents">{S.nav.agents}</Link>
      </Notice>
    );

  const l = state.line;
  const st = l.standing;
  return (
    <>
      <section className="line-head" aria-label="Holder">
        {/* the handle is user-chosen text: rendered as a text node, never as HTML */}
        <h1 data-testid="handle">{l.handle ? `${l.handle}.ai` : short(l.address)}</h1>
        <span className="mono muted small break">{l.address}</span>
        <a className="small" href={`${EXPLORER}/address/${l.address}`} target="_blank" rel="noreferrer">
          BscScan <ExternalLink size={12} aria-hidden="true" />
        </a>
      </section>

      {/* both rows of cards share one 16px rhythm, the same gap as between cards in a row */}
      <div className="stack">
        {!l.holdsAgentId && !l.hasLine ? (
          <Notice kind="info">{S.line.noId}</Notice>
        ) : (
          <div className="split">
            <div className="stack">
              <NextStepCard line={l} />
            </div>
            <div className="stack">
              <section className="card stack" aria-labelledby="rung-title">
                <h2 id="rung-title" className="sr-only">
                  Rung and limit
                </h2>
                {st ? (
                  <>
                    <div>
                      <span className="big-limit" data-testid="limit">
                        {usdt(l.limit)} USDT
                      </span>{" "}
                      <span className="muted">{S.line.limit}</span>
                      {BigInt(l.vouched) > 0n && (
                        <div className="small accent-text">{S.line.vouched(`${usdt(l.vouched)} USDT`)}</div>
                      )}
                    </div>
                    <p data-testid="rung">
                      Rung {st.level} of 6{st.frozen && <span className="badge badge-bad"> frozen</span>}
                    </p>
                    <Ladder level={st.frozen ? 0 : st.level} />
                  </>
                ) : (
                  <p>{S.line.noLine}</p>
                )}
              </section>
              {st && (
                <section className="card stack-sm" aria-labelledby="record-title">
                  <h3 id="record-title">{S.line.record}</h3>
                  <dl className="kv">
                    <dt>{S.line.repaid}</dt>
                    <dd>{st.repaid}</dd>
                    <dt>{S.line.late}</dt>
                    <dd>{st.late}</dd>
                    <dt>{S.line.defaults}</dt>
                    <dd>{st.defaults}</dd>
                  </dl>
                  <p className="small muted">
                    {st.level >= 6 ? S.line.top : S.line.progress(st.streak, st.need)}
                  </p>
                  {BigInt(l.claimable) > 0n && <p className="small">{S.line.claimable(usdt(l.claimable))}</p>}
                </section>
              )}
            </div>
          </div>
        )}

        {l.hasLine && (
          <div className="split">
            <section className="card stack-sm" aria-labelledby="history-title">
              <h3 id="history-title">{S.line.history}</h3>
              {l.history.length === 0 ? (
                <p className="muted">{S.line.noHistory}</p>
              ) : (
                <ul className="events">
                  {l.history.map((h) => (
                    <li key={`${h.tx}-${h.name}-${h.block}`}>
                      <span>{h.text}</span>
                      <span className="small muted">
                        <Time unix={h.time} /> ·{" "}
                        <a href={`${EXPLORER}/tx/${h.tx}`} target="_blank" rel="noreferrer" className="mono">
                          {short(h.tx)}
                        </a>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="card stack-sm" aria-labelledby="vouch-title">
              <h3 id="vouch-title">{S.line.vouchesIn}</h3>
              {l.vouchesIn.length === 0 ? (
                <p className="muted">{S.line.none}</p>
              ) : (
                <ul className="plain">
                  {l.vouchesIn.map((v) => (
                    <li key={v.voucher}>
                      <Link to={`/line/${v.voucher}`} className="mono">
                        {short(v.voucher)}
                      </Link>{" "}
                      · {usdt(v.amount)} USDT
                    </li>
                  ))}
                </ul>
              )}
              <h3>{S.line.vouchesOut}</h3>
              {l.vouchesOut.length === 0 ? (
                <p className="muted">{S.line.none}</p>
              ) : (
                <ul className="plain">
                  {l.vouchesOut.map((v) => (
                    <li key={v.borrower}>
                      <Link to={`/line/${v.borrower}`} className="mono">
                        {short(v.borrower)}
                      </Link>{" "}
                      · {usdt(v.amount)} USDT
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
      <p className="small muted">State read at block {l.asOfBlock}.</p>
    </>
  );
}
