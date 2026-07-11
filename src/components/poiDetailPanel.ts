import type { PointOfInterest } from "../types/config";

export interface PoiDetailPanel {
  root: HTMLElement;
  show(poi: PointOfInterest): void;
  hide(): void;
}

interface LinkItem {
  url: string;
  label: string;
}

function renderLinkSection(
  container: HTMLElement,
  heading: string,
  items: LinkItem[],
  listClassName: string,
): void {
  container.replaceChildren();
  if (items.length === 0) return;

  const headingEl = document.createElement("h3");
  headingEl.textContent = heading;
  container.appendChild(headingEl);

  const list = document.createElement("ul");
  list.className = listClassName;
  items.forEach((item) => {
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = item.label;
    li.appendChild(link);
    list.appendChild(li);
  });
  container.appendChild(list);
}

export function createPoiDetailPanel(onClose?: () => void): PoiDetailPanel {
  const root = document.createElement("div");
  root.className = "poi-detail-panel";
  root.hidden = true;

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "poi-detail-panel__close";
  closeButton.textContent = "閉じる";
  closeButton.addEventListener("click", () => onClose?.());

  const title = document.createElement("h2");
  title.className = "poi-detail-panel__title";

  const description = document.createElement("p");
  description.className = "poi-detail-panel__description";

  const mediaSection = document.createElement("div");
  mediaSection.className = "poi-detail-panel__section poi-detail-panel__media";

  const paperSection = document.createElement("div");
  paperSection.className = "poi-detail-panel__section poi-detail-panel__papers";

  root.append(closeButton, title, description, mediaSection, paperSection);

  return {
    root,
    show(poi: PointOfInterest) {
      title.textContent = poi.name;
      description.textContent = poi.description;
      renderLinkSection(
        mediaSection,
        "メディア",
        poi.media.map((media) => ({ url: media.url, label: media.caption })),
        "poi-detail-panel__media-list",
      );
      renderLinkSection(
        paperSection,
        "参考文献",
        poi.referencePapers.map((paper) => ({ url: paper.url, label: paper.citation })),
        "poi-detail-panel__paper-list",
      );
      root.hidden = false;
    },
    hide() {
      root.hidden = true;
    },
  };
}
