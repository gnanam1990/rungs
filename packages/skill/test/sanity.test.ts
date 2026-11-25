import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "../src/index";

describe("skill sanity", () => {
  it("exports its package name", () => {
    expect(PACKAGE_NAME).toBe("@rungs/skill");
  });
});
