import { describe, expect, it, vi } from "vitest";
import { ShareLinkService } from "./shareLinkService";
import type { ShareViewState } from "../types/config";

const BASE_URL = "https://yokayoka.github.io/FieldTourMap/";

describe("ShareLinkService", () => {
  describe("encode/decode round-trip", () => {
    it("round-trips center, zoom, and layer state without a POI id", () => {
      const service = new ShareLinkService({ baseUrl: BASE_URL });
      const state: ShareViewState = {
        lat: 35.681236,
        lng: 139.767125,
        zoom: 15,
        baseLayerId: "gsi-std",
        overlayLayerIds: ["aist-geology"],
      };

      const url = service.encode(state);
      const decoded = service.decode(url);

      expect(decoded).toEqual(state);
    });

    it("round-trips a poiId when present", () => {
      const service = new ShareLinkService({ baseUrl: BASE_URL });
      const state: ShareViewState = {
        lat: 35.68,
        lng: 139.76,
        zoom: 16,
        baseLayerId: "osm",
        overlayLayerIds: [],
        poiId: "poi-01",
      };

      const decoded = service.decode(service.encode(state));

      expect(decoded).toEqual(state);
    });

    it("round-trips a tourId when present", () => {
      const service = new ShareLinkService({ baseUrl: BASE_URL });
      const state: ShareViewState = {
        lat: 35.68,
        lng: 139.76,
        zoom: 16,
        baseLayerId: "osm",
        overlayLayerIds: [],
        tourId: "second-tour",
        poiId: "poi-01",
      };

      const decoded = service.decode(service.encode(state));

      expect(decoded).toEqual(state);
    });

    it("produces a URL rooted at the configured base URL", () => {
      const service = new ShareLinkService({ baseUrl: BASE_URL });
      const url = service.encode({
        lat: 0,
        lng: 0,
        zoom: 1,
        baseLayerId: "gsi-std",
        overlayLayerIds: [],
      });

      expect(url.startsWith(BASE_URL)).toBe(true);
    });

    it("keeps the encoded URL reasonably compact", () => {
      const service = new ShareLinkService({ baseUrl: BASE_URL });
      const url = service.encode({
        lat: 35.681236,
        lng: 139.767125,
        zoom: 15,
        baseLayerId: "gsi-std",
        overlayLayerIds: ["aist-geology", "contour"],
        poiId: "poi-01",
      });

      expect(url.length).toBeLessThan(180);
    });
  });

  describe("decode error handling", () => {
    it("returns null when required parameters are missing", () => {
      const service = new ShareLinkService({ baseUrl: BASE_URL });
      expect(service.decode(`${BASE_URL}?zoom=15`)).toBeNull();
    });

    it("returns null when lat/lng/zoom are not valid numbers", () => {
      const service = new ShareLinkService({ baseUrl: BASE_URL });
      expect(
        service.decode(`${BASE_URL}?lat=not-a-number&lng=139.7&zoom=15&base=gsi-std`),
      ).toBeNull();
    });

    it("returns null when the URL itself cannot be parsed", () => {
      const service = new ShareLinkService({ baseUrl: BASE_URL });
      expect(service.decode("not a valid url")).toBeNull();
    });

    it("returns null when the base layer id is missing", () => {
      const service = new ShareLinkService({ baseUrl: BASE_URL });
      expect(service.decode(`${BASE_URL}?lat=35.68&lng=139.76&zoom=15`)).toBeNull();
    });

    it("treats a share URL with no share parameters at all as absent (not an error)", () => {
      const service = new ShareLinkService({ baseUrl: BASE_URL });
      expect(service.decode(BASE_URL)).toBeNull();
    });
  });

  describe("copyToClipboard", () => {
    it("returns true and writes the URL when the Clipboard API succeeds", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      const service = new ShareLinkService({ baseUrl: BASE_URL, clipboard: { writeText } });

      const result = await service.copyToClipboard("https://example.com/shared");

      expect(result).toBe(true);
      expect(writeText).toHaveBeenCalledWith("https://example.com/shared");
    });

    it("returns false without throwing when the Clipboard API is unavailable", async () => {
      const service = new ShareLinkService({ baseUrl: BASE_URL, clipboard: undefined });

      await expect(service.copyToClipboard("https://example.com/shared")).resolves.toBe(false);
    });

    it("returns false without throwing when the Clipboard API rejects", async () => {
      const writeText = vi.fn().mockRejectedValue(new Error("denied"));
      const service = new ShareLinkService({ baseUrl: BASE_URL, clipboard: { writeText } });

      await expect(service.copyToClipboard("https://example.com/shared")).resolves.toBe(false);
    });
  });

  describe("shareViaWebShareApi", () => {
    it("returns true when navigator.share succeeds", async () => {
      const share = vi.fn().mockResolvedValue(undefined);
      const service = new ShareLinkService({
        baseUrl: BASE_URL,
        webShare: { share, canShare: () => true },
      });

      const result = await service.shareViaWebShareApi("https://example.com/shared");

      expect(result).toBe(true);
      expect(share).toHaveBeenCalledWith({ url: "https://example.com/shared" });
    });

    it("returns false when the Web Share API is unavailable", async () => {
      const service = new ShareLinkService({ baseUrl: BASE_URL, webShare: undefined });

      await expect(service.shareViaWebShareApi("https://example.com/shared")).resolves.toBe(
        false,
      );
    });

    it("returns false without throwing when the user cancels the share sheet", async () => {
      const share = vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError"));
      const service = new ShareLinkService({
        baseUrl: BASE_URL,
        webShare: { share, canShare: () => true },
      });

      await expect(service.shareViaWebShareApi("https://example.com/shared")).resolves.toBe(
        false,
      );
    });
  });
});
