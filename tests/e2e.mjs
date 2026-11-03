// End to end: a Lunar Dig host plays every storyboard through Sim Runner.
//
//   npm run build && node tests/e2e.mjs
//
//   HOST_URL     the game (default https://lunardig.com); a local ld-web preview works too
//   HOST_QUERY   extra query for the game, e.g. engine=http for a local preview
//   PACE         fast (default), brisk or relaxed
//   ONLY         storyboard ids, comma separated (default: all)
//   VIDEO_DIR    record both windows to this folder (WebM)
//
// Sim Runner is served from dist/ on a local port, so it is a different origin from the game.
import { chromium } from "playwright";
import { preview } from "vite";

const HOST_URL = (process.env.HOST_URL ?? "https://lunardig.com").replace(/\/$/, "");
const HOST_QUERY = process.env.HOST_QUERY ?? "";
const PACE = process.env.PACE ?? "fast";
const ONLY = process.env.ONLY ?? "all";
const VIDEO_DIR = process.env.VIDEO_DIR;

const server = await preview({ preview: { port: 0, host: "127.0.0.1" }, logLevel: "error" });
const runnerBase = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  ...(VIDEO_DIR ? { recordVideo: { dir: VIDEO_DIR, size: { width: 1600, height: 900 } } } : {}),
});
const errors = [];
ctx.on("page", (p) => p.on("pageerror", (e) => errors.push(`${p.url()}: ${e.message}`)));
let failed = false;
try {
  const host = await ctx.newPage();
  await host.goto(`${HOST_URL}/?demo=simrun${HOST_QUERY ? `&${HOST_QUERY}` : ""}`);
  await host.getByTestId("controllers").waitFor({ timeout: 60_000 });
  await host.getByTestId("follow-pace").check();
  const url = `${runnerBase}?host=${encodeURIComponent(new URL(HOST_URL).origin)}&pace=${PACE}&run=${ONLY}`;
  await host.getByTestId("controller-url").fill(url);
  const [runner] = await Promise.all([ctx.waitForEvent("page"), host.getByTestId("open-controller").click()]);
  await host.getByTestId("allow-controller").click();
  // The runner asks to start its first scenario; the player lets it run them back to back.
  await host.getByTestId("trust-scenarios").check({ timeout: 30_000 });
  await host.getByTestId("allow-scenario").click();
  const expected = ONLY === "all" ? null : ONLY.split(",").length;
  await runner.waitForFunction(
    (n) => {
      const s = document.querySelector('[data-testid="summary"]');
      return s && s.dataset.ran && (n === null || Number(s.dataset.ran) === n);
    },
    expected,
    { timeout: 20 * 60_000 },
  );
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
} catch (err) {
  console.error(err);
  failed = true;
} finally {
  await ctx.close();
  await browser.close();
  server.httpServer.close();
}
process.exit(failed ? 1 : 0);
