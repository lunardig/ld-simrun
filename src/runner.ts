/**
 * Plays storyboards through the claim host, one step at a time, at a pace a person can
 * watch. Every command goes through ldcp-0 like any controller's, attributed to this page.
 */
import type { ClaimView } from "@lunardig/ld-interfaces";
import type { LdcpClient } from "../vendor/ld-sdk/ts/src/ldcp";
import { holds, readingMs, resolveArgs, type Check, type Condition, type Step, type Storyboard } from "./storyboard";

export type Pace = "relaxed" | "brisk" | "fast";
const PACE: Record<Pace, number> = { relaxed: 1.4, brisk: 0.8, fast: 0.03 };

export interface Progress {
  board: Storyboard;
  /** Index of the step under way, or steps.length when checking. */
  step: number;
  caption: string;
  /** While waiting: what for, and whether the host is fast-forwarding. */
  waiting?: { label: string; followed: boolean };
  commands: number;
}

export interface Outcome {
  board: Storyboard;
  passed: boolean;
  checks: { check: Check; ok: boolean }[];
  error?: string;
  commands: number;
  stateHash: string;
  claimSeconds: number;
}

export class Stopped extends Error {}

export class Runner {
  pace: Pace = "relaxed";
  onProgress: (p: Progress) => void = () => {};
  #host: LdcpClient;
  #view: ClaimView | null = null;
  #fresh: Promise<void> | null = null;
  #waiters = new Set<() => void>();
  #stopped = false;
  #wake: (() => void) | null = null;

  constructor(host: LdcpClient) {
    this.#host = host;
    const prior = host.handlers.events;
    host.handlers.events = (events, cursor, t) => {
      prior?.(events, cursor, t);
      this.#changed();
    };
    host.handlers.reset = () => this.#changed();
  }

  /** Every step of the claim: re-read the view (one read in flight at a time). */
  #changed() {
    if (this.#fresh) return;
    this.#fresh = this.#host
      .observe()
      .then(({ view }) => {
        this.#view = view;
        for (const w of this.#waiters) w();
      })
      .catch(() => {})
      .finally(() => (this.#fresh = null));
  }

  async #observe(): Promise<ClaimView> {
    this.#view = (await this.#host.observe()).view;
    return this.#view;
  }

  stop() {
    this.#stopped = true;
    this.#wake?.();
    for (const w of this.#waiters) w();
  }

  async #sleep(ms: number) {
    const t = ms * PACE[this.pace];
    await new Promise<void>((r) => {
      const timer = setTimeout(r, t);
      this.#wake = () => (clearTimeout(timer), r());
    });
    this.#wake = null;
    if (this.#stopped) throw new Stopped("stopped");
  }

  async #until(c: Condition) {
    let v = await this.#observe();
    while (!holds(c, v)) {
      await new Promise<void>((r) => {
        const w = () => (this.#waiters.delete(w), r());
        this.#waiters.add(w);
      });
      if (this.#stopped) throw new Stopped("stopped");
      v = this.#view!;
    }
  }

  async run(board: Storyboard): Promise<Outcome> {
    this.#stopped = false;
    const host = this.#host;
    let commands = 0;
    const progress = (step: number, caption: string, waiting?: Progress["waiting"]) => this.onProgress({ board, step, caption, waiting, commands });
    const say = async (text: string | undefined) => {
      if (!text) return;
      progress(current, text);
      await host.caption(text).catch(() => {});
    };
    let current = 0;
    try {
      progress(0, `Starting “${board.title}”…`);
      await host.openScenario(board.scenario.kind, board.scenario.id);
      await host.subscribe({});
      const start = BigInt((await this.#observe()).time_us);
      await this.#sleep(1200);
      for (current = 0; current < board.steps.length; current++) {
        const step: Step = board.steps[current];
        if ("do" in step) {
          await say(step.say);
          await this.#sleep(step.say ? readingMs(step.say) * 0.6 : 700 + Math.random() * 600);
          const args = resolveArgs(step.args, await this.#observe());
          const out = await host.submit(step.do, args as never);
          commands++;
          progress(current, step.say ?? `${step.do} ${Object.values(args)[0] ?? ""}`);
          if (out.outcome !== "applied") throw new Error(`${step.do} was rejected (${out.stage} ${out.code}): ${out.message ?? ""}`);
          await this.#sleep(500);
        } else if ("wait" in step) {
          await say(step.say);
          let followed = false;
          if (!holds(step.wait, await this.#observe()) && step.pace) {
            followed = (await host.hurry(true, BigInt(Math.round(step.pace * 1e6)))).followed;
          }
          progress(current, step.say ?? `Waiting for ${step.label}`, { label: step.label, followed });
          try {
            await this.#until(step.wait);
          } finally {
            if (followed) await host.hurry(false).catch(() => {});
          }
          await this.#sleep(900);
        } else {
          await say(step.say);
          await this.#sleep(readingMs(step.say));
        }
      }
      progress(board.steps.length, "Checking the result…");
      const v = await this.#observe();
      const checks = board.checks.map((check) => ({ check, ok: holds(check.holds, v) }));
      const passed = checks.every((c) => c.ok);
      await say(passed ? `“${board.title}”: every check passed.` : `“${board.title}”: a check failed.`);
      return { board, passed, checks, commands, stateHash: v.state_hash, claimSeconds: Number((BigInt(v.time_us) - start) / 1_000_000n) };
    } catch (err) {
      await host.hurry(false).catch(() => {});
      const v = this.#view;
      return {
        board,
        passed: false,
        checks: [],
        error: err instanceof Stopped ? "Stopped." : err instanceof Error ? err.message : String(err),
        commands,
        stateHash: v?.state_hash ?? "",
        claimSeconds: 0,
      };
    }
  }
}
