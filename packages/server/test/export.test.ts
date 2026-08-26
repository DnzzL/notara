import { describe, expect, test } from "bun:test";
import {
	blockToMarkdown,
	csvEscape,
	makeFilenameAllocator,
	sanitizeFilename,
} from "../src/export/page.js";

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
		expect(blockToMarkdown("todo", "Do this thing")).toBe(
			"- [ ] Do this thing",
		);
	});

	test("converts checked todo with existing checkbox marker", () => {
		expect(blockToMarkdown("todo", "[x] Completed")).toBe("- [x] Completed");
	});

	test("converts code block", () => {
		const result = blockToMarkdown("code", "const x = 1;");
		expect(result).toBe("```\nconst x = 1;\n```");
	});

	test("converts blockquote", () => {
		expect(blockToMarkdown("blockquote", "A wise quote")).toBe(
			"> A wise quote",
		);
	});

	test("converts divider", () => {
		expect(blockToMarkdown("divider", "")).toBe("---");
	});

	test("converts image", () => {
		expect(blockToMarkdown("image", "https://example.com/img.png")).toBe(
			"![image](https://example.com/img.png)",
		);
	});

	test("converts toggle", () => {
		expect(blockToMarkdown("toggle", "Click to expand")).toBe(
			"<details><summary>Click to expand</summary></details>",
		);
	});

	test("converts callout", () => {
		expect(blockToMarkdown("callout", "Important note")).toBe(
			"> [!NOTE]\n> Important note",
		);
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

describe("makeFilenameAllocator", () => {
	test("leaves a unique name alone", () => {
		const allocate = makeFilenameAllocator();
		expect(allocate("Roadmap", ".md")).toBe("Roadmap.md");
	});

	test("suffixes a repeat instead of returning it twice", () => {
		// Two pages titled "Notes" used to overwrite each other while the export
		// reported success — a backup that drops pages without saying so.
		const allocate = makeFilenameAllocator();
		expect(allocate("Notes", ".md")).toBe("Notes.md");
		expect(allocate("Notes", ".md")).toBe("Notes (2).md");
		expect(allocate("Notes", ".md")).toBe("Notes (3).md");
	});

	test("treats names that sanitise alike as colliding", () => {
		// "A/B" and "A B" both become "A_B", so uniqueness has to be judged after
		// sanitising, not before.
		const allocate = makeFilenameAllocator();
		expect(allocate("A/B", ".md")).toBe("A_B.md");
		expect(allocate("A B", ".md")).toBe("A_B (2).md");
	});

	test("collides case-insensitively, because macOS and Windows do", () => {
		// On a case-insensitive filesystem "notes.md" and "Notes.md" are one file.
		// Comparing case-sensitively would still lose data on the two platforms
		// most users are on.
		const allocate = makeFilenameAllocator();
		expect(allocate("Notes", ".md")).toBe("Notes.md");
		expect(allocate("notes", ".md")).toBe("notes (2).md");
	});

	test("gives an untitled page a name rather than a bare extension", () => {
		const allocate = makeFilenameAllocator();
		expect(allocate("", ".md")).toBe("Untitled.md");
		expect(allocate("", ".md")).toBe("Untitled (2).md");
	});

	test("keeps the suffix out of the extension", () => {
		const allocate = makeFilenameAllocator();
		allocate("Tasks", ".csv");
		expect(allocate("Tasks", ".csv")).toBe("Tasks (2).csv");
	});

	test("allocators are independent, so different folders may reuse a name", () => {
		const pages = makeFilenameAllocator();
		const databases = makeFilenameAllocator();
		expect(pages("Tasks", ".md")).toBe("Tasks.md");
		expect(databases("Tasks", ".csv")).toBe("Tasks.csv");
	});
});
