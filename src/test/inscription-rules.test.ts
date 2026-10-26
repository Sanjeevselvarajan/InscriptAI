import { describe, it, expect } from "vitest";
import { validateImageFile, MAX_BYTES } from "@/lib/inscription-types";

describe("upload rules", () => {
  it("rejects files over 16 MB", () => {
    expect(validateImageFile({ name: "a.png", type: "image/png", size: 16 * 1024 * 1024 + 1 })).toMatch(/16 MB/);
    expect(MAX_BYTES).toBe(16 * 1024 * 1024);
  });
  it("accepts a 16 MB TIFF", () => {
    expect(validateImageFile({ name: "a.tif", type: "image/tiff", size: 16 * 1024 * 1024 })).toBeNull();
  });
  it("rejects unsupported types", () => {
    expect(validateImageFile({ name: "a.gif", type: "image/gif", size: 100 })).toMatch(/Unsupported/);
  });
});
