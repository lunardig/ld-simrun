import { describe, expect, test } from "vitest";
import { GAME_ORIGIN, hostOriginFrom } from "./host";

describe("hostOriginFrom (SECURITY-REVIEW-ldcp F-11)", () => {
  test("keeps only origins a host can have", () => {
    expect(hostOriginFrom("https://lunardig.com/")).toBe("https://lunardig.com");
    expect(hostOriginFrom("http://127.0.0.1:4173")).toBe("http://127.0.0.1:4173");
    for (const bad of [null, "", "javascript:alert(1)", "http://game.example", "https://lunardig.com/x", "https://lunardig.com/?a=1", "data:text/html,x", "http://localhost.evil.example"]) {
      expect(hostOriginFrom(bad), String(bad)).toBe(GAME_ORIGIN);
    }
  });
});
