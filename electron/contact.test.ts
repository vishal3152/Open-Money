import { describe, expect, it, vi } from "vitest";

import {
  CONTACT_EMAIL,
  buildAboutPanelOptions,
  buildApplicationMenuTemplate
} from "./contact.cjs";

describe("electron contact", () => {
  it("exposes the maintainer contact email", () => {
    expect(CONTACT_EMAIL).toBe("vishaly5@outlook.com");
  });

  it("puts the contact email in About panel credits", () => {
    expect(buildAboutPanelOptions()).toEqual({
      applicationName: "Open Money",
      copyright: "Copyright © Open Money",
      credits: "Contact: vishaly5@outlook.com"
    });
  });

  it("adds a Help → Contact item that opens mailto", () => {
    const openExternal = vi.fn();
    const template = buildApplicationMenuTemplate({
      platform: "linux",
      shell: { openExternal }
    });

    const help = template.find((item) => item.role === "help");
    expect(help).toBeDefined();
    expect(help?.submenu).toHaveLength(1);

    const contact = help?.submenu?.[0];
    expect(contact?.label).toBe("Contact…");
    contact?.click?.();
    expect(openExternal).toHaveBeenCalledWith("mailto:vishaly5@outlook.com");
  });

  it("keeps the macOS app menu role so About stays available", () => {
    const template = buildApplicationMenuTemplate({
      platform: "darwin",
      shell: { openExternal: vi.fn() }
    });

    expect(template[0]).toEqual({ role: "appMenu" });
  });
});
