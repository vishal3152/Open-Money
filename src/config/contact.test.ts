import { describe, expect, it } from "vitest";

import { CONTACT_EMAIL, CONTACT_MAILTO } from "@/config/contact";

describe("contact", () => {
  it("exposes the maintainer email and mailto link", () => {
    expect(CONTACT_EMAIL).toBe("vishaly5@outlook.com");
    expect(CONTACT_MAILTO).toBe("mailto:vishaly5@outlook.com");
  });
});
