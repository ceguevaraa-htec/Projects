import { describe, expect, it } from "vitest";
import { includesToday, isInFuture, isToday, rangesOverlap } from "../../src/domain/date-utils.js";

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

describe("isInFuture", () => {
  it("returns false for exactly today", () => {
    expect(isInFuture(todayIso())).toBe(false);
  });

  it("returns true for tomorrow", () => {
    expect(isInFuture(addDays(todayIso(), 1))).toBe(true);
  });

  it("returns false for yesterday", () => {
    expect(isInFuture(addDays(todayIso(), -1))).toBe(false);
  });
});

describe("isToday", () => {
  it("returns true for exactly today", () => {
    expect(isToday(todayIso())).toBe(true);
  });

  it("returns false for tomorrow", () => {
    expect(isToday(addDays(todayIso(), 1))).toBe(false);
  });

  it("returns false for yesterday", () => {
    expect(isToday(addDays(todayIso(), -1))).toBe(false);
  });
});

describe("includesToday", () => {
  it("returns true when today falls within the range", () => {
    expect(includesToday({ start: addDays(todayIso(), -1), end: addDays(todayIso(), 1) })).toBe(
      true,
    );
  });

  it("returns true when the range is exactly today (single-day range)", () => {
    expect(includesToday({ start: todayIso(), end: todayIso() })).toBe(true);
  });

  it("returns false when the range is entirely in the future", () => {
    expect(includesToday({ start: addDays(todayIso(), 1), end: addDays(todayIso(), 5) })).toBe(
      false,
    );
  });

  it("returns false when the range is entirely in the past", () => {
    expect(includesToday({ start: addDays(todayIso(), -5), end: addDays(todayIso(), -1) })).toBe(
      false,
    );
  });
});

describe("rangesOverlap", () => {
  it("returns true for identical ranges", () => {
    const range = { start: "2024-01-01", end: "2024-01-10" };
    expect(rangesOverlap(range, { ...range })).toBe(true);
  });

  it("returns true for full containment", () => {
    expect(
      rangesOverlap(
        { start: "2024-01-01", end: "2024-01-31" },
        { start: "2024-01-10", end: "2024-01-15" },
      ),
    ).toBe(true);
  });

  it("returns true for partial overlap", () => {
    expect(
      rangesOverlap(
        { start: "2024-01-01", end: "2024-01-15" },
        { start: "2024-01-10", end: "2024-01-25" },
      ),
    ).toBe(true);
  });

  it("returns true for single-day overlap (one range's end equals the other's start)", () => {
    expect(
      rangesOverlap(
        { start: "2024-01-01", end: "2024-01-10" },
        { start: "2024-01-10", end: "2024-01-20" },
      ),
    ).toBe(true);
  });

  it("returns false for zero overlap (fully disjoint, with a gap)", () => {
    expect(
      rangesOverlap(
        { start: "2024-01-01", end: "2024-01-05" },
        { start: "2024-01-10", end: "2024-01-20" },
      ),
    ).toBe(false);
  });

  it("is symmetric — order of arguments does not matter", () => {
    const a = { start: "2024-01-01", end: "2024-01-10" };
    const b = { start: "2024-01-05", end: "2024-01-15" };
    expect(rangesOverlap(a, b)).toBe(rangesOverlap(b, a));
  });
});
