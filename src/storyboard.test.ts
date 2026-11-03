import { describe, expect, test } from "vitest";
import type { ClaimView } from "@lunardig/ld-interfaces";
import { holds, resolveArgs } from "./storyboard";
import { STORYBOARDS } from "./storyboards";
import { SHOWCASE } from "./showcase";

const view = {
  time_us: "0",
  environment: { irradiance: { n: "0", d: "1" } },
  machines: [{ machine_id: "solar-1" }],
  jobs: [{ job_id: "job-solar", status: "RUNNING" }],
  buffers: [
    { buffer_id: "h2-tank", contents: { "h2-g": "6000" } },
    { buffer_id: "h2-2", contents: { "h2-g": "5000" } },
  ],
  lots: [{ lot_id: "kits", location: "inventory", products: { "tank-kit": "2" } }],
  energy: { stores: [{ charge: "60000000" }] },
} as unknown as ClaimView;

describe("conditions", () => {
  test("each kind reads the claim view", () => {
    expect(holds({ stored: "h2-g", atLeast: 11_000 }, view)).toBe(true);
    expect(holds({ stored: "h2-g", atLeast: 11_001 }, view)).toBe(false);
    expect(holds({ job: "job-solar", status: "RUNNING" }, view)).toBe(true);
    expect(holds({ kitInHold: "tank-kit" }, view)).toBe(true);
    expect(holds({ kitInHold: "hopper-kit" }, view)).toBe(false);
    expect(holds({ storedEnergyJ: 50_000_000 }, view)).toBe(true);
    expect(holds({ night: true }, view)).toBe(true);
    expect(holds({ installed: "h2-2" }, view)).toBe(true);
    expect(holds({ all: [{ night: true }, { installed: "nope" }] }, view)).toBe(false);
  });

  test("kit arguments resolve to the lot holding the kit", () => {
    expect(resolveArgs({ lot_id: { kit: "tank-kit" }, as_id: "t" }, view)).toEqual({ lot_id: "kits", as_id: "t" });
    expect(() => resolveArgs({ lot_id: { kit: "hopper-kit" } }, view)).toThrow(/cargo hold/);
  });
});

describe("storyboards", () => {
  test("ids are unique, every board has steps and checks, and every wait has a label", () => {
    expect(new Set(STORYBOARDS.map((b) => b.id)).size).toBe(STORYBOARDS.length);
    for (const b of STORYBOARDS) {
      expect(b.steps.length).toBeGreaterThan(3);
      expect(b.checks.length).toBeGreaterThan(0);
      for (const s of b.steps) if ("wait" in s) expect(s.label.length).toBeGreaterThan(0);
    }
  });

  test("every showcase line replaces a caption that exists", () => {
    const says = new Set(STORYBOARDS.flatMap((b) => b.steps.map((s) => ("say" in s ? s.say : undefined)).filter(Boolean)));
    for (const k of Object.keys(SHOWCASE)) expect(says.has(k), k).toBe(true);
  });
});
