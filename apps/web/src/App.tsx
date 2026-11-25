// The app asks the server for its page mode first (GET /v1/public/site) and renders what it returns.
// A failed fetch falls back to a safe default: no region block, live mode.

import { useEffect, useState } from "react";
import { type Config, type Site, api } from "./api";
import { Layout } from "./components/Layout";
import { Notice, Skeleton } from "./components/ui";
import { Home } from "./pages/Home";
import { Line } from "./pages/Line";
import { AgentsPage, LadderPage, OpenPage, VouchPage } from "./pages/Static";
import { useRoute } from "./router";
import { S } from "./strings";

const TITLES: Record<string, string> = {
  home: "Rungs",
  line: "Line · Rungs",
  ladder: "Ladder · Rungs",
  vouch: "Vouch · Rungs",
  open: "Open books · Rungs",
  agents: "For agents · Rungs",
  notFound: "Not found · Rungs",
};

export function App() {
  const route = useRoute();
  const [site, setSite] = useState<Site | null>(null);
  const [cfg, setCfg] = useState<Config | null>(null);
  useEffect(() => {
    api
      .site()
      .then(setSite)
      .catch(() => setSite({ blocked: false, reason: null, mode: "live", notice: null }));
    api
      .config()
      .then(setCfg)
      .catch(() => setCfg(null));
  }, []);
  useEffect(() => {
    document.title = TITLES[route.name] ?? "Rungs";
  }, [route.name]);

  let body: React.ReactNode;
  if (!site) body = <Skeleton width="60%" />;
  else if (site.blocked) body = <Notice kind="info">{site.reason ?? S.blocked}</Notice>;
  else if (route.name === "home") body = <Home site={site} />;
  else if (route.name === "line") body = <Line address={route.address} />;
  else if (route.name === "ladder") body = <LadderPage />;
  else if (route.name === "vouch") body = <VouchPage />;
  else if (route.name === "open") body = <OpenPage />;
  else if (route.name === "agents") body = <AgentsPage />;
  else body = <Notice kind="info">{S.notFound}</Notice>;

  return (
    <Layout route={route} site={site} pool={cfg?.pool ?? null}>
      {body}
    </Layout>
  );
}
