import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "../src/index";

describe("keeper sanity", () => {
  it("exports its package name", () => {
    expect(PACKAGE_NAME).toBe("@rungs/keeper");
  });
});
