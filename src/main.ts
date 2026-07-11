import "./style.css";

export function mountApp(root: HTMLElement): void {
  const mapContainer = document.createElement("div");
  mapContainer.id = "map";
  root.replaceChildren(mapContainer);
}

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (appRoot) {
  mountApp(appRoot);
}
