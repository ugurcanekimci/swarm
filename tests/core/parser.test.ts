import { describe, it, expect } from "vitest";
import { segmentsToText, wordCount, totalDuration } from "../../src/core/parser.js";
import type { TranscriptSegment } from "../../src/types.js";

function seg(text: string, offset: number, duration: number): TranscriptSegment {
  return { text, offset, duration, lang: "en" };
}

describe("segmentsToText", () => {
  it("joins segments into a single paragraph when gaps are small", () => {
    const segments = [seg("Hello world", 0, 1.5), seg("this is a test", 1.5, 1.0)];
    expect(segmentsToText(segments)).toBe("Hello world this is a test");
  });

  it("inserts paragraph breaks on 2+ second gaps", () => {
    const segments = [seg("First sentence.", 0, 1.0), seg("Second sentence.", 5, 1.0)];
    expect(segmentsToText(segments)).toBe("First sentence.\n\nSecond sentence.");
  });

  it("decodes HTML entities", () => {
    const segments = [seg("Tom &amp; Jerry&#39;s &lt;show&gt;", 0, 1)];
    expect(segmentsToText(segments)).toBe("Tom & Jerry's <show>");
  });

  it("strips music/applause tags", () => {
    const segments = [seg("[Music] Hello [Applause] there", 0, 1)];
    expect(segmentsToText(segments)).toBe("Hello there");
  });

  it("strips filler words", () => {
    const segments = [seg("so um like uh yeah hmm okay", 0, 1)];
    expect(segmentsToText(segments)).toBe("so like yeah okay");
  });

  it("returns empty string for empty segments", () => {
    expect(segmentsToText([])).toBe("");
  });

  it("skips segments that clean to empty", () => {
    const segments = [seg("[Music]", 0, 1), seg("Hello", 3, 1)];
    expect(segmentsToText(segments)).toBe("Hello");
  });
});

describe("wordCount", () => {
  it("counts words", () => {
    expect(wordCount("hello world foo")).toBe(3);
  });

  it("returns 0 for empty string", () => {
    expect(wordCount("")).toBe(0);
  });
});

describe("totalDuration", () => {
  it("returns last segment offset + duration", () => {
    const segments = [seg("a", 0, 1), seg("b", 10, 2.5)];
    expect(totalDuration(segments)).toBe(13);
  });

  it("returns 0 for empty", () => {
    expect(totalDuration([])).toBe(0);
  });
});
