import { describe, test, expect } from "bun:test";
import { blockToMarkdown, csvEscape, sanitizeFilename } from "../src/export/page.js";

describe("blockToMarkdown", () => {
  test("converts heading1", () => {
    expect(blockToMarkdown("heading1", "Title")).toBe("# Title");
  });

  test("converts heading2", () => {
    expect(blockToMarkdown("heading2", "Section")).toBe("## Section");
  });

  test("converts heading3", () => {
    expect(blockToMarkdown("heading3", "Subsection")).toBe("### Subsection");
  });

  test("converts paragraph", () => {
    expect(blockToMarkdown("paragraph", "Hello world")).toBe("Hello world");
  });

  test("converts bulletList", () => {
    expect(blockToMarkdown("bulletList", "Item one")).toBe("- Item one");
  });

  test("converts numberedList", () => {
    expect(blockToMarkdown("numberedList", "First item")).toBe("1. First item");
  });

  test("converts unchecked todo", () => {
    expect(blockToMarkdown("todo", "Do this thing")).toBe("- [ ] Do this thing");
  });

  test("converts checked todo with existing checkbox marker", () => {
    expect(blockToMarkdown("todo", "[x] Completed")).toBe("- [x] Completed");
  });

  test("converts code block", () => {
    const result = blockToMarkdown("code", "const x = 1;");
    expect(result).toBe("```\nconst x = 1;\n```");
  });

  test("converts blockquote", () => {
    expect(blockToMarkdown("blockquote", "A wise quote")).toBe("> A wise quote");
  });

  test("converts divider", () => {
    expect(blockToMarkdown("divider", "")).toBe("---");
  });

  test("converts image", () => {
    expect(blockToMarkdown("image", "https://example.com/img.png")).toBe("![image](https://example.com/img.png)");
  });

  test("converts toggle", () => {
    expect(blockToMarkdown("toggle", "Click to expand")).toBe("<details><summary>Click to expand</summary></details>");
  });

  test("converts callout", () => {
    expect(blockToMarkdown("callout", "Important note")).toBe("> [!NOTE]\n> Important note");
  });

  test("falls back to raw content for unknown types", () => {
    expect(blockToMarkdown("unknown_type", "raw text")).toBe("raw text");
  });
});

describe("csvEscape", () => {
  test("returns plain value unchanged", () => {
    expect(csvEscape("hello")).toBe("hello");
  });

  test("quotes value containing comma", () => {
    expect(csvEscape("hello, world")).toBe('"hello, world"');
  });

  test("quotes value containing double quote", () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });

  test("quotes value containing newline", () => {
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });

  test("quotes value containing carriage return", () => {
    expect(csvEscape("line1\rline2")).toBe('"line1\rline2"');
  });

  test("handles empty string", () => {
    expect(csvEscape("")).toBe("");
  });

  test("handles multiple commas and quotes", () => {
    expect(csvEscape('a, b, "c"')).toBe('"a, b, ""c"""');
  });
});

describe("sanitizeFilename", () => {
  test("replaces forbidden characters with underscore", () => {
    expect(sanitizeFilename("file/name")).toBe("file_name");
  });

  test("replaces spaces with underscores", () => {
    expect(sanitizeFilename("my file name")).toBe("my_file_name");
  });

  test("truncates to 200 characters", () => {
    const long = "a".repeat(250);
    const result = sanitizeFilename(long);
    expect(result.length).toBe(200);
  });

  test("handles various special characters", () => {
    expect(sanitizeFilename('<>:"/\\|?*')).toBe("_________");
  });

  test("preserves normal characters", () => {
    expect(sanitizeFilename("Hello_World-2024")).toBe("Hello_World-2024");
  });
});
