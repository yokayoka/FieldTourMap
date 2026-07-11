import { describe, expect, it } from "vitest";
import { createAdminNav } from "./adminNav";

describe("createAdminNav", () => {
  it("renders a link for each admin page", () => {
    const nav = createAdminNav("layers");

    const links = nav.querySelectorAll<HTMLAnchorElement>(".admin-nav__link");
    expect(links).toHaveLength(2);
    expect(Array.from(links).map((link) => link.textContent)).toEqual([
      "レイヤー編集",
      "ツアー編集（POI・ルート）",
    ]);
  });

  it("marks the current page's link as current", () => {
    const nav = createAdminNav("tour");

    const current = nav.querySelector<HTMLAnchorElement>(".admin-nav__link--current");
    expect(current?.textContent).toBe("ツアー編集（POI・ルート）");
    expect(current?.getAttribute("aria-current")).toBe("page");

    const other = Array.from(nav.querySelectorAll<HTMLAnchorElement>(".admin-nav__link")).find(
      (link) => link !== current,
    );
    expect(other?.classList.contains("admin-nav__link--current")).toBe(false);
    expect(other?.hasAttribute("aria-current")).toBe(false);
  });

  it("points each link at the corresponding admin page", () => {
    const nav = createAdminNav("layers");

    const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>(".admin-nav__link"));
    expect(links[0].getAttribute("href")).toBe("./index.html");
    expect(links[1].getAttribute("href")).toBe("./tour-editor.html");
  });
});
