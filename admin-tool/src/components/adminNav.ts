export type AdminPage = "layers" | "tour";

/** 管理ツール内のページ間を移動するための簡易ナビゲーション。 */
export function createAdminNav(current: AdminPage): HTMLElement {
  const nav = document.createElement("nav");
  nav.className = "admin-nav";

  const links: { page: AdminPage; href: string; label: string }[] = [
    { page: "layers", href: "./index.html", label: "レイヤー編集" },
    { page: "tour", href: "./tour-editor.html", label: "ツアー編集（POI・ルート）" },
  ];

  links.forEach(({ page, href, label }) => {
    const link = document.createElement("a");
    link.href = href;
    link.textContent = label;
    link.className = "admin-nav__link";
    if (page === current) {
      link.classList.add("admin-nav__link--current");
      link.setAttribute("aria-current", "page");
    }
    nav.appendChild(link);
  });

  return nav;
}
