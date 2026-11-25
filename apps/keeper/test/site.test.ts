import { describe, expect, it } from "vitest";
import { decideSite, refuseWhileComingSoon } from "../src/site";

const base = {
  country: "ID",
  blockedCountries: ["US", "KP"],
  unknownCountryPolicy: "allow" as const,
  comingSoon: false,
  paused: false,
};

describe("T-S09 page mode", () => {
  it("live for an allowed country", () => {
    expect(decideSite(base)).toEqual({ blocked: false, reason: null, mode: "live", notice: null });
  });
  it("blocked country", () => {
    expect(decideSite({ ...base, country: "us" })).toMatchObject({ blocked: true, mode: "live" });
  });
  it("unknown country under both policies", () => {
    expect(decideSite({ ...base, country: null }).blocked).toBe(false);
    expect(decideSite({ ...base, country: "XX", unknownCountryPolicy: "block" })).toMatchObject({
      blocked: true,
      reason: expect.stringMatching(/could not tell your region/),
    });
    expect(decideSite({ ...base, country: null, unknownCountryPolicy: "block" }).blocked).toBe(true);
  });
  it("paused contract", () => {
    const s = decideSite({ ...base, paused: true });
    expect(s.mode).toBe("paused");
    expect(s.notice).toMatch(/Repayments.*still work/);
  });
  it("coming soon wins over paused", () => {
    expect(decideSite({ ...base, paused: true, comingSoon: true }).mode).toBe("comingSoon");
  });
});

describe("coming soon also stops the API (web-app-shipping 2)", () => {
  it("refuses new lines, loans and stakes", () => {
    for (const a of ["open", "draw", "vouch"]) {
      expect(refuseWhileComingSoon(true, a)).toMatchObject({ ok: false, code: "NotOpenYet" });
    }
  });
  it("keeps every way out working: repay, cure, unvouch, claim, approve, write-off", () => {
    for (const a of ["approve", "repay", "unvouch", "claim", "writeOff"]) {
      expect(refuseWhileComingSoon(true, a)).toBeNull();
    }
  });
  it("refuses nothing when live", () => {
    expect(refuseWhileComingSoon(false, "draw")).toBeNull();
  });
});
