// End to end: a Lunar Dig host plays every storyboard through Sim Runner.
//
//   npm run build && node tests/e2e.mjs
//
//   HOST_URL     the game (default https://lunardig.com); a local ld-web preview works too
//   HOST_QUERY   extra query for the game, e.g. engine=http for a local preview
//   PACE         fast (default), brisk or relaxed
//   ONLY         storyboard ids, comma separated (default: all)
//   VIDEO_DIR    record both windows to this folder (WebM), and compose a 1080p MP4 per
//                storyboard plus one for the whole run (needs ffmpeg)
//   VOICE        caption voice for recordings: guide or showcase (default showcase)
//   RUNNER_URL   a deployed Sim Runner instead of dist/ (e.g. https://lunardig.github.io/ld-simrun/)
//
// Sim Runner is served from dist/ on a local port, so it is a different origin from the game.
import { chromium } from "playwright";
import { preview } from "vite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { compose } from "./compose.mjs";

const HOST_URL = (process.env.HOST_URL ?? "https://lunardig.com").replace(/\/$/, "");
const HOST_QUERY = process.env.HOST_QUERY ?? "";
const PACE = process.env.PACE ?? "fast";
const ONLY = process.env.ONLY ?? "all";
const VIDEO_DIR = process.env.VIDEO_DIR;
const VOICE = process.env.VOICE ?? "showcase";
// The runner records as a tall column: a page narrower than the video sits at the frame's
// top left at its own size, so a 480x900 viewport is cropped out and scaled to 576x1080.
const RUNNER_VIEW = { width: 480, height: 900 };
const RUNNER_BOX = { x: 0, y: 0, w: 480, h: 900 };

const server = await preview({ preview: { port: 0, host: "127.0.0.1" }, logLevel: "error" });
const runnerBase = process.env.RUNNER_URL ?? server.resolvedUrls.local[0];
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  ...(VIDEO_DIR ? { recordVideo: { dir: VIDEO_DIR, size: { width: 1600, height: 900 } } } : {}),
});
const errors = [];
ctx.on("page", (p) => p.on("pageerror", (e) => errors.push(`${p.url()}: ${e.message}`)));
let failed = false;
try {
  const hostT0 = Date.now();
  const host = await ctx.newPage();
  await host.goto(`${HOST_URL}/?demo=simrun${HOST_QUERY ? `&${HOST_QUERY}` : ""}`);
  await host.getByTestId("controllers").waitFor({ timeout: 60_000 });
  await host.getByTestId("follow-pace").check();
  const clip = VIDEO_DIR ? `&present&voice=${VOICE}` : "";
  const url = `${runnerBase}?host=${encodeURIComponent(new URL(HOST_URL).origin)}&pace=${PACE}&run=${ONLY}${clip}`;
  await host.getByTestId("controller-url").fill(url);
  let runnerT0 = 0;
  const [runner] = await Promise.all([ctx.waitForEvent("page").then((p) => ((runnerT0 = Date.now()), p)), host.getByTestId("open-controller").click()]);
  if (VIDEO_DIR) await runner.setViewportSize(RUNNER_VIEW);
  await host.getByTestId("allow-controller").click();
  // The runner asks to start its first scenario; the player lets it run them back to back.
  await host.getByTestId("trust-scenarios").check({ timeout: 30_000 });
  await host.getByTestId("allow-scenario").click();
  // Watch each storyboard's badge, to know when each one ran (for cutting clips).
  const marks = new Map(); // id -> { title, start, end }
  const deadline = Date.now() + 30 * 60_000;
  for (;;) {
    const state = await runner.evaluate(() => ({
      rows: [...document.querySelectorAll("[data-board]")].map((l) => ({ id: l.dataset.board, title: l.querySelector("strong").textContent, badge: l.querySelector(".badge").textContent })),
      done: !!document.querySelector('[data-testid="summary"]')?.dataset.ran,
    }));
    const now = Date.now();
    for (const r of state.rows) {
      if (r.badge === "running" && !marks.has(r.id)) marks.set(r.id, { title: r.title, start: now });
      const m = marks.get(r.id);
      if (m && !m.end && ["passed", "failed", "stopped"].includes(r.badge)) m.end = now;
    }
    if (state.done) break;
    if (now > deadline) throw new Error("the run did not finish in 30 minutes");
    await new Promise((r) => setTimeout(r, 250));
  }
  if (VIDEO_DIR) await host.waitForTimeout(4000); // let the last checks show
  const ran = await runner.getByTestId("summary").getAttribute("data-ran");
  const passed = await runner.getByTestId("summary").getAttribute("data-passed");
  const rows = await runner.locator("[data-board]").evaluateAll((ls) => ls.map((l) => `${l.dataset.board}: ${l.querySelector(".badge").textContent}`));
  console.log(rows.join("\n"));
  console.log(`${passed} of ${ran} passed`);
  if (passed !== ran) failed = true;
  if (errors.length) {
    console.log("page errors:\n" + errors.join("\n"));
    failed = true;
  }
  if (VIDEO_DIR) {
    const hostVideo = host.video();
    const runnerVideo = runner.video();
    await ctx.close();
    const rec = { host: { file: await hostVideo.path(), t0: hostT0 }, runner: { file: await runnerVideo.path(), t0: runnerT0 } };
    const outDir = join(VIDEO_DIR, "clips");
    mkdirSync(outDir, { recursive: true });
    const all = [...marks.entries()].filter(([, m]) => m.end);
    for (const [id, m] of all) {
      const out = join(outDir, `${id}.mp4`);
      compose({ ...rec, from: m.start - 500, to: m.end + 4000, title: m.title, out, runnerBox: RUNNER_BOX });
      console.log(`clip ${out}`);
    }
    if (all.length > 1) {
      const out = join(outDir, "all.mp4");
      compose({ ...rec, from: all[0][1].start - 500, to: all[all.length - 1][1].end + 4000, title: "From dirt to machines", out, runnerBox: RUNNER_BOX });
      console.log(`clip ${out}`);
    }
  }
} catch (err) {
  console.error(err);
  failed = true;
} finally {
  await ctx.close().catch(() => {});
  await browser.close();
  server.httpServer.close();
}
process.exit(failed ? 1 : 0);
