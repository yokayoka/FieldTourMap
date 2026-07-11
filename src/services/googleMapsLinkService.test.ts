import { describe, expect, it, vi } from "vitest";
import { GoogleMapsLinkService } from "./googleMapsLinkService";

describe("GoogleMapsLinkService", () => {
  describe("buildSearchUrl", () => {
    it("builds a Google Maps pin-search URL from lat/lng (Requirement 14.2)", () => {
      const service = new GoogleMapsLinkService();

      const url = service.buildSearchUrl({ lat: 35.681236, lng: 139.767125 });

      expect(url).toBe("https://www.google.com/maps/search/?api=1&query=35.681236,139.767125");
    });

    it("rounds coordinates to 6 decimal places", () => {
      const service = new GoogleMapsLinkService();

      const url = service.buildSearchUrl({ lat: 35.6812361234, lng: 139.7671255678 });

      expect(url).toBe("https://www.google.com/maps/search/?api=1&query=35.681236,139.767126");
    });

    it("handles negative coordinates correctly", () => {
      const service = new GoogleMapsLinkService();

      const url = service.buildSearchUrl({ lat: -33.8688, lng: 151.2093 });

      expect(url).toBe("https://www.google.com/maps/search/?api=1&query=-33.868800,151.209300");
    });
  });

  describe("copyToClipboard", () => {
    it("returns true and writes the url when the Clipboard API succeeds", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      const service = new GoogleMapsLinkService({ clipboard: { writeText } });

      const result = await service.copyToClipboard("https://maps.example/x");

      expect(result).toBe(true);
      expect(writeText).toHaveBeenCalledWith("https://maps.example/x");
    });

    it("returns false without throwing when the Clipboard API is unavailable", async () => {
      const service = new GoogleMapsLinkService({ clipboard: undefined });

      await expect(service.copyToClipboard("https://maps.example/x")).resolves.toBe(false);
    });
  });
});
