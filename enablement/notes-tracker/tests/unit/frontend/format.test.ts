import { describe, expect, it } from "vitest";
import { formatTimestamp, truncateContent } from "../../../public/js/format.js";

describe("truncateContent", () => {
  it("leaves content at or under the max length unchanged", () => {
    const content = "a".repeat(100);
    expect(truncateContent(content, 100)).toBe(content);
  });

  it("leaves short content unchanged with no ellipsis", () => {
    expect(truncateContent("short note", 100)).toBe("short note");
  });

  it("truncates longer content and appends an ellipsis", () => {
    const content = "a".repeat(150);
    const result = truncateContent(content, 100);

    expect(result).toHaveLength(101); // 100 chars + ellipsis
    expect(result.endsWith("…")).toBe(true);
    expect(result.startsWith("a".repeat(100))).toBe(true);
  });
});

describe("formatTimestamp", () => {
  it("renders a non-empty human-readable string from an ISO timestamp", () => {
    const result = formatTimestamp("2026-08-24T09:16:36.902Z");

    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    // Should not just be the raw ISO string passed through unchanged.
    expect(result).not.toBe("2026-08-24T09:16:36.902Z");
  });
});
