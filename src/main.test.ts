import { describe, expect, it } from "vitest";
import { mountApp } from "./main";

describe("mountApp", () => {
  it("renders the app shell into the given root element", () => {
    const root = document.createElement("div");

    mountApp(root);

    expect(root.querySelector("#map")).not.toBeNull();
  });
});
