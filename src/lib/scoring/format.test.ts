import { describe, expect, it } from "vitest";
import { formatToPar } from "./format";

describe("formatToPar", () => {
  it("formats even par as E", () => {
    expect(formatToPar(0)).toBe("E");
  });
  it("formats under par with a leading minus", () => {
    expect(formatToPar(-5)).toBe("-5");
  });
  it("formats over par with a leading plus", () => {
    expect(formatToPar(3)).toBe("+3");
  });
});
