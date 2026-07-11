import { describe, expect, it, vi } from "vitest";
import { copyToClipboard } from "./clipboard";

describe("copyToClipboard", () => {
  it("returns true and writes the text when the Clipboard API succeeds", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    const result = await copyToClipboard("hello", { writeText });

    expect(result).toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("returns false without throwing when no clipboard is provided", async () => {
    await expect(copyToClipboard("hello", undefined)).resolves.toBe(false);
  });

  it("returns false without throwing when the Clipboard API rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));

    await expect(copyToClipboard("hello", { writeText })).resolves.toBe(false);
  });
});
