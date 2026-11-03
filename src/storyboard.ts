/**
 * A storyboard: one of the game's scenarios played as a person would play it. Steps are
 * actions (one command each), waits on what the claim shows, and captions. Commands take
 * effect at the host's current time, so a storyboard never names a time; it waits for
 * the claim to reach a state instead.
 */
import type { ClaimView, Command } from "@lunardig/ld-interfaces";

export type Op = Command["op"];

/** An argument resolved against the claim when the step runs: the lot holding a kit. */
export type Arg = string | { kit: string };

export type Condition =
  /** Raw stored amount of a species across all buffers, in its catalog unit (mmol for gases and
   *  liquids, kg for regolith). */
  | { stored: string; atLeast: number }
  /** A job's status. */
  | { job: string; status: string }
  /** A kit of this product is waiting in the cargo hold. */
  | { kitInHold: string }
  /** Energy in the claim's stores (batteries), in joules. */
  | { storedEnergyJ: number }
  /** The sun is down (irradiance zero) or up. */
  | { night: boolean }
  /** A machine or buffer with this id is installed. */
  | { installed: string }
  /** All of them at once. */
  | { all: Condition[] };

export type Step =
  /** A line to read; the runner pauses long enough to read it. */
  | { say: string }
  /** One command, as a player's click would make it. */
  | { say?: string; do: Op; args: Record<string, Arg> }
  /**
   * Wait until the condition holds. `pace` is the speed (claim seconds per real second) the
   * runner asks the host for while it waits, if the player lets controllers set the pace.
   */
  | { say?: string; wait: Condition; pace?: number; label: string };

export interface Check {
  label: string;
  holds: Condition;
}

export interface Storyboard {
  id: string;
  title: string;
  /** One or two sentences for the list. */
  blurb: string;
  /** The scenario the host starts it from (`open_scenario`). */
  scenario: { kind: "campaign" | "scenario"; id: string };
  steps: Step[];
  /** What must hold at the end for the run to pass. */
  checks: Check[];
}

export function holds(c: Condition, v: ClaimView): boolean {
  if ("all" in c) return c.all.every((x) => holds(x, v));
  if ("stored" in c) return v.buffers.reduce((a, b) => a + Number(b.contents[c.stored] ?? "0"), 0) >= c.atLeast;
  if ("job" in c) return v.jobs.some((j) => j.job_id === c.job && j.status === c.status);
  if ("installed" in c) return v.machines.some((m) => m.machine_id === c.installed) || v.buffers.some((b) => b.buffer_id === c.installed);
  if ("kitInHold" in c) return v.lots.some((l) => l.location === "inventory" && Number(l.products[c.kitInHold] ?? "0") > 0);
  if ("storedEnergyJ" in c) return (v.energy.stores ?? []).reduce((a, s) => a + Number(s.charge), 0) >= c.storedEnergyJ;
  const irr = v.environment.irradiance;
  const dark = irr ? Number(irr.n) === 0 : false;
  return c.night === dark;
}

/** Turns a step's arguments into a command's, looking kits up in the cargo hold. */
export function resolveArgs(args: Record<string, Arg>, v: ClaimView): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, a] of Object.entries(args)) {
    if (typeof a === "string") out[k] = a;
    else {
      const lot = v.lots.find((l) => l.location === "inventory" && Number(l.products[a.kit] ?? "0") > 0);
      if (!lot) throw new Error(`no ${a.kit} in the cargo hold`);
      out[k] = lot.lot_id;
    }
  }
  return out;
}

/** How long a viewer needs to read a line, in ms. */
export const readingMs = (text: string) => Math.max(1600, text.split(/\s+/).length * 260);
