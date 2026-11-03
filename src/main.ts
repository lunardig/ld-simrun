import { LdcpClient, windowPort } from "../vendor/ld-sdk/ts/src/ldcp";
import { Runner, type Outcome, type Pace, type Progress } from "./runner";
import { STORYBOARDS } from "./storyboards";
import { voiced, type Voice } from "./showcase";
import type { Step, Storyboard } from "./storyboard";

const q = new URLSearchParams(location.search);
const HOST = q.get("host") ?? "https://lunardig.com";
const app = document.querySelector<HTMLElement>("#app")!;
const statusEl = document.querySelector<HTMLElement>("#status")!;

function status(text: string, tone: "" | "ok" | "bad" = "") {
  statusEl.textContent = text;
  statusEl.dataset.tone = tone;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: (Node | string)[]) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...kids);
  return e;
}

/** Opened directly, not by the game: explain, and offer the way in. */
function landing() {
  status("Not connected to a game.");
  app.replaceChildren(
    el(
      "section",
      { class: "landing" },
      el("h1", {}, "Watch a factory build itself on the Moon"),
      el(
        "p",
        {},
        "Sim Runner plays Lunar Dig's scenarios the way a person would: it installs machines, connects them, starts jobs and waits for results, one step at a time. It is an ordinary web page on its own site, driving the game through the same controller protocol any developer can use. Every command it sends is recorded in the claim's history under its address.",
      ),
      el("p", {}, el("a", { class: "cta", href: `${HOST}/?demo=simrun` }, "Open the game with Sim Runner")),
      el("p", { class: "fine" }, "The game opens this page from its Controllers dialog and asks you to allow it. ", el("a", { href: "https://github.com/lunardig/ld-simrun" }, "Source on GitHub"), "."),
    ),
  );
}

type Row = { board: Storyboard; li: HTMLLIElement; badge: HTMLElement; pick: HTMLInputElement };

async function main() {
  if (!window.opener) return landing();
  status(`Waiting for you to allow Sim Runner in the game…`);
  let host: LdcpClient;
  try {
    host = await LdcpClient.connect({
      app: { name: "Sim Runner", version: "0.1" },
      scopes: ["read", "operate", "build"],
      port: windowPort(HOST),
      handlers: { ended: (reason) => status(`Disconnected: ${reason}.`, "bad") },
    });
  } catch (err) {
    status(`The game refused the connection: ${(err as Error).message}.`, "bad");
    return;
  }
  status(`Connected to the game as session ${host.session}.`, "ok");
  document.body.dataset.session = host.session;
  const runner = new Runner(host);
  (window as unknown as { simrun: unknown }).simrun = { host, runner };

  // ---- layout
  const pace = el("select", { "aria-label": "Pace", "data-testid": "pace" }) as HTMLSelectElement;
  for (const [v, label] of [["relaxed", "Relaxed pace"], ["brisk", "Brisk pace"], ["fast", "Fast (testing)"]]) pace.append(el("option", { value: v }, label));
  pace.value = (q.get("pace") as Pace) ?? "relaxed";
  runner.pace = pace.value as Pace;
  pace.onchange = () => (runner.pace = pace.value as Pace);
  const voice = el("select", { "aria-label": "Captions", "data-testid": "voice" }) as HTMLSelectElement;
  for (const [v, label] of [["guide", "Guide captions"], ["showcase", "Showcase captions"]]) voice.append(el("option", { value: v }, label));
  voice.value = q.get("voice") === "showcase" ? "showcase" : "guide";
  runner.voice = voice.value as Voice;
  voice.onchange = () => (runner.voice = voice.value as Voice);
  if (q.has("present")) document.body.classList.add("presenting");
  const runAll = el("button", { class: "primary", "data-testid": "run-all" }, "Run all") as HTMLButtonElement;
  const runPicked = el("button", { "data-testid": "run-picked" }, "Run selected") as HTMLButtonElement;
  const stop = el("button", { "data-testid": "stop", disabled: "" }, "Stop") as HTMLButtonElement;
  const present = el("button", { "data-testid": "present", title: "Large captions for recording" }, "Presentation") as HTMLButtonElement;
  present.onclick = () => document.body.classList.toggle("presenting");
  const hint = el("p", { class: "hint", "data-testid": "hint" });

  const list = el("ol", { class: "boards", "data-testid": "boards" });
  const rows: Row[] = STORYBOARDS.map((board) => {
    const pick = el("input", { type: "checkbox", "aria-label": `Select ${board.title}` }) as HTMLInputElement;
    pick.checked = true;
    const badge = el("span", { class: "badge" }, "ready");
    const go = el("button", { class: "quiet", "data-run": board.id }, "Run") as HTMLButtonElement;
    const li = el("li", { "data-board": board.id }, pick, el("div", { class: "board-text" }, el("strong", {}, board.title), el("span", {}, board.blurb)), badge, go);
    go.onclick = () => runQueue([board]);
    return { board, li: li as HTMLLIElement, badge, pick };
  });
  list.append(...rows.map((r) => r.li));

  const stage = el("section", { class: "stage", "aria-live": "polite" });
  const caption = el("p", { class: "caption", "data-testid": "caption" }, "Choose scenarios to run, or run them all.");
  const title = el("h2", { class: "stage-title" }, "");
  const steps = el("ol", { class: "steps" });
  const waitBox = el("p", { class: "waiting" });
  const result = el("div", { class: "result", "data-testid": "result" });
  stage.append(title, caption, waitBox, steps, result);

  const summary = el("p", { class: "summary", "data-testid": "summary" });
  app.replaceChildren(
    el("section", { class: "panel" }, el("div", { class: "controls" }, runAll, runPicked, stop, pace, voice, present), hint, list, summary),
    stage,
  );

  // ---- progress
  let shown: Storyboard | null = null;
  runner.onProgress = (p: Progress) => {
    if (shown !== p.board) {
      shown = p.board;
      title.textContent = p.board.title;
      result.replaceChildren();
      steps.replaceChildren(
        ...p.board.steps.map((s, i) => el("li", { "data-step": String(i) }, stepLabel(s, runner.voice))),
      );
    }
    caption.textContent = p.caption;
    steps.querySelectorAll("li").forEach((li, i) => (li.className = i < p.step ? "done" : i === p.step ? "now" : ""));
    steps.querySelector(".now")?.scrollIntoView({ block: "nearest" });
    if (p.waiting) {
      waitBox.textContent = p.waiting.followed
        ? `Waiting for ${p.waiting.label}: the game is fast-forwarding.`
        : `Waiting for ${p.waiting.label}. Raise the speed in the game to get there sooner, or tick “Let controllers set the pace”.`;
      waitBox.dataset.followed = String(p.waiting.followed);
    } else waitBox.textContent = "";
  };

  const show = (o: Outcome) => {
    const row = rows.find((r) => r.board === o.board)!;
    row.badge.textContent = o.passed ? "passed" : o.error === "Stopped." ? "stopped" : "failed";
    row.badge.className = `badge ${o.passed ? "pass" : "fail"}`;
    result.replaceChildren(
      el("h3", {}, o.passed ? "Passed" : "Did not pass"),
      ...(o.error ? [el("p", { class: "error" }, o.error)] : []),
      el("ul", {}, ...o.checks.map((c) => el("li", { class: c.ok ? "ok" : "bad" }, `${c.ok ? "✓" : "✗"} ${c.check.label}`))),
      el("p", { class: "fine" }, `${o.commands} commands, each recorded under ${location.origin}. ${o.claimSeconds ? `${formatSpan(o.claimSeconds)} of claim time.` : ""} State ${o.stateHash.slice(0, 12)}.`),
    );
  };

  let running = false;
  async function runQueue(boards: Storyboard[]) {
    if (running || !boards.length) return;
    running = true;
    for (const b of [runAll, runPicked]) b.disabled = true;
    stop.disabled = false;
    hint.textContent = boards.length > 1 ? "The game asks before each scenario starts; tick “without asking” there to run them back to back." : "";
    const outcomes: Outcome[] = [];
    for (const board of boards) {
      const row = rows.find((r) => r.board === board)!;
      row.badge.textContent = "running";
      row.badge.className = "badge run";
      const o = await runner.run(board);
      outcomes.push(o);
      show(o);
      if (o.error === "Stopped.") break;
      await new Promise((r) => setTimeout(r, runner.pace === "fast" ? 100 : 2500));
    }
    const passed = outcomes.filter((o) => o.passed).length;
    summary.textContent = `${passed} of ${outcomes.length} passed.`;
    summary.dataset.passed = String(passed);
    summary.dataset.ran = String(outcomes.length);
    running = false;
    for (const b of [runAll, runPicked]) b.disabled = false;
    stop.disabled = true;
    hint.textContent = "";
  }
  runAll.onclick = () => runQueue(STORYBOARDS);
  runPicked.onclick = () => runQueue(rows.filter((r) => r.pick.checked).map((r) => r.board));
  stop.onclick = () => runner.stop();

  const auto = q.get("run");
  if (auto === "all") runQueue(STORYBOARDS);
  else if (auto) runQueue(STORYBOARDS.filter((b) => auto.split(",").includes(b.id)));
}

function stepLabel(s: Step, voice: Voice): string {
  if ("say" in s && s.say) return voiced(s.say, voice);
  if ("do" in s) {
    const id = Object.values(s.args).find((a) => typeof a === "string" && /-\d|^job-|^c-/.test(a));
    return `${s.do.toLowerCase().replace(/_/g, " ")} ${typeof id === "string" ? id : ""}`.trim();
  }
  return `wait for ${(s as { label: string }).label}`;
}

function formatSpan(s: number) {
  if (s < 120) return `${s} s`;
  if (s < 7200) return `${Math.round(s / 60)} min`;
  if (s < 172800) return `${(s / 3600).toFixed(1)} h`;
  return `${(s / 86400).toFixed(1)} days`;
}

main();
