// Page mode, decided on the server (web-app-shipping: the client never guesses its own region or mode).

export interface SiteInput {
  country: string | null;
  blockedCountries: string[];
  unknownCountryPolicy: "allow" | "block";
  comingSoon: boolean;
  paused: boolean | null;
}

export interface SiteResponse {
  blocked: boolean;
  reason: string | null;
  mode: "live" | "paused" | "comingSoon";
  notice: string | null;
}

export function decideSite(i: SiteInput): SiteResponse {
  const country = i.country?.trim().toUpperCase() || null;
  const unknown = country === null || country === "XX" || country === "T1";
  let blocked = false;
  let reason: string | null = null;
  if (!unknown && i.blockedCountries.includes(country)) {
    blocked = true;
    reason = "Rungs is not available in your region.";
  } else if (unknown && i.unknownCountryPolicy === "block") {
    blocked = true;
    reason = "Rungs could not tell your region, so it is not shown here.";
  }
  if (i.comingSoon) return { blocked, reason, mode: "comingSoon", notice: "Rungs is not open yet." };
  if (i.paused)
    return {
      blocked,
      reason,
      mode: "paused",
      notice:
        "New lines, loans and stakes are paused. Repayments, write-offs, unvouching and claims still work.",
    };
  return { blocked, reason, mode: "live", notice: null };
}
