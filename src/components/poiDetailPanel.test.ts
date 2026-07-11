import { describe, expect, it, vi } from "vitest";
import { createPoiDetailPanel } from "./poiDetailPanel";
import type { PointOfInterest } from "../types/config";

const poiWithLinks: PointOfInterest = {
  id: "poi-01",
  name: "露頭A（花崗岩貫入部）",
  description: "花崗岩の貫入と接触変成の様子が観察できる露頭。",
  position: { lat: 35.681, lng: 139.767 },
  media: [
    { url: "https://drive.google.com/file/d/xxx/view", caption: "露頭全景写真", type: "photo" },
  ],
  referencePapers: [
    { url: "https://doi.org/10.xxxx/example", citation: "山田太郎ほか (2020)" },
  ],
};

const poiWithoutLinks: PointOfInterest = {
  id: "poi-02",
  name: "露頭B",
  description: "断層露頭",
  position: { lat: 35.682, lng: 139.768 },
  media: [],
  referencePapers: [],
};

describe("createPoiDetailPanel", () => {
  it("is hidden initially", () => {
    const panel = createPoiDetailPanel();
    expect(panel.root.hidden).toBe(true);
  });

  it("shows the POI name and description", () => {
    const panel = createPoiDetailPanel();
    panel.show(poiWithLinks);

    expect(panel.root.hidden).toBe(false);
    expect(panel.root.querySelector(".poi-detail-panel__title")?.textContent).toBe(
      "露頭A（花崗岩貫入部）",
    );
    expect(panel.root.querySelector(".poi-detail-panel__description")?.textContent).toBe(
      "花崗岩の貫入と接触変成の様子が観察できる露頭。",
    );
  });

  it("renders a distinct メディア section with safe new-tab links", () => {
    const panel = createPoiDetailPanel();
    panel.show(poiWithLinks);

    const mediaSection = panel.root.querySelector(".poi-detail-panel__media");
    expect(mediaSection?.textContent).toContain("メディア");
    const link = mediaSection?.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://drive.google.com/file/d/xxx/view");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link?.textContent).toBe("露頭全景写真");
  });

  it("renders a distinct 参考文献 section separate from media", () => {
    const panel = createPoiDetailPanel();
    panel.show(poiWithLinks);

    const paperSection = panel.root.querySelector(".poi-detail-panel__papers");
    expect(paperSection?.textContent).toContain("参考文献");
    const link = paperSection?.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://doi.org/10.xxxx/example");
    expect(link?.textContent).toBe("山田太郎ほか (2020)");
  });

  it("omits empty media and reference paper sections", () => {
    const panel = createPoiDetailPanel();
    panel.show(poiWithoutLinks);

    expect(panel.root.querySelector(".poi-detail-panel__media")?.children.length).toBe(0);
    expect(panel.root.querySelector(".poi-detail-panel__papers")?.children.length).toBe(0);
  });

  it("hides the panel when hide() is called", () => {
    const panel = createPoiDetailPanel();
    panel.show(poiWithLinks);
    panel.hide();

    expect(panel.root.hidden).toBe(true);
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    const panel = createPoiDetailPanel(onClose);
    panel.show(poiWithLinks);

    panel.root.querySelector<HTMLButtonElement>(".poi-detail-panel__close")!.click();

    expect(onClose).toHaveBeenCalled();
  });
});
