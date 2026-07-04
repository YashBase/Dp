import { resolveApiBaseUrl } from "./api";

describe("resolveApiBaseUrl", () => {
  it("avoids double-slash API paths for auth requests", () => {
    expect(resolveApiBaseUrl("https://example.com/")).toBe("https://example.com/api");
    expect(resolveApiBaseUrl("https://example.com/api/")).toBe("https://example.com/api");
    expect(resolveApiBaseUrl("https://example.com//")).toBe("https://example.com/api");
  });
});
