import { describe, expect, it, vi } from "vitest";
import { downloadTextFile } from "./downloadTextFile";

describe("downloadTextFile", () => {
  it("creates an object URL, triggers a download via a temporary link, and revokes the URL", () => {
    let capturedBlob: Blob | undefined;
    const createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return "blob:fake-url";
    });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadTextFile("memos.csv", "a,b,c", "text/csv");

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(capturedBlob).toBeInstanceOf(Blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("sets the anchor's download attribute to the given filename", () => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:fake-url"),
      revokeObjectURL: vi.fn(),
    });
    let capturedDownload: string | undefined;
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        capturedDownload = this.download;
      });

    downloadTextFile("observation-memos.geojson", "{}", "application/geo+json");

    expect(capturedDownload).toBe("observation-memos.geojson");

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
