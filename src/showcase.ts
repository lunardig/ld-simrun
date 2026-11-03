/**
 * The showcase voice: punchier lines for video and ads, keyed by the guide caption they
 * replace. A caption without one keeps its guide wording.
 */
export const SHOWCASE: Record<string, string> = {
  // shared
  "Power first: unpack the solar array from the cargo hold.": "Step one on any world: power.",
  "Give it a job. While the sun is up, it feeds the power bus.": "Sunlight in. A megawatt on the bus.",
  // dig
  "A fresh claim beside an icy crater. Nothing is built yet.": "An empty claim. A crater full of ice. Let's dig.",
  "Install the excavator. It digs 100 kg per cycle.": "Drop in an excavator: 100 kg a bite.",
  "Give the excavator a job, and let time run.": "Put it to work.",
  "Waiting for 90 kg of regolith in the hopper.": "Watch the hopper fill.",
  "The hopper is filling. A kilogram in every hundred is lost as dust: the engine tracks every element.":
    "Every kilogram accounted for, down to the dust that blows away.",
  // water from ice
  "The excavator is digging and the hopper is filling. Now turn regolith into water.": "Dirt is cheap. Water is life. Time to turn one into the other.",
  "Install the beneficiation plant: it sorts ice and ilmenite out of regolith.": "A sorting plant splits ice and ore from the rock.",
  "Next, a melter to turn ice into water,": "Then melt the ice.",
  "Waiting for 20 mol of water.": "Water, from moon dirt, while you watch.",
  "Soil in, water out. Each machine is the same pattern: install, connect, give it a job.": "Soil in, water out. Install, connect, run. Repeat until you own the Moon.",
  // split water
  "The lander has offloaded 200 mol of water. Split it into rocket fuel and air.": "Water in the tank. Rocket fuel and air on the menu.",
  "Install the electrolyzer.": "Bring in the electrolyzer.",
  "Start splitting: 2 H₂O → 2 H₂ + O₂.": "Split it. 2 H₂O → 2 H₂ + O₂.",
  "Waiting for 10 mol of hydrogen.": "Hydrogen and oxygen, filling up.",
  "36 g of water became 4 g of hydrogen and 32 g of oxygen. Every reaction balances, element by element.":
    "Real chemistry. Every atom balanced, every time.",
  // iron
  "300 mol of ilmenite and 300 mol of hydrogen. Hot hydrogen pulls the oxygen out of ilmenite and leaves iron.": "Ore plus hydrogen plus heat. Out comes iron.",
  "Install the reduction reactor.": "Fire up a reduction reactor.",
  "Waiting for the batch to release its iron.": "Ten minutes at 900 °C…",
  "Iron from lunar soil. The water the reaction made can go back to the electrolyzer: the hydrogen is only borrowed.":
    "Iron, made on the Moon. Even the water comes back for another round.",
  // build a hopper
  "1,900 mol of iron, about 106 kg, all made on this claim. Enough for a new hopper.": "106 kg of home-made iron. Let's build something.",
  "Install the fabricator.": "A fabricator turns metal into machines.",
  "Waiting for the kit: about ten minutes of work.": "Forging a hopper.",
  "Install the hopper the claim just made.": "Installed. Built here, from here.",
  "Regolith became ice and ilmenite, ice became hydrogen, hydrogen made iron, and iron became equipment.":
    "Dirt became water, water became fuel, fuel made iron, iron made machines. The loop is closed.",
  // night shift
  "The sun sets in five minutes, and lunar night lasts two weeks.": "Sunset in five minutes. Then fourteen days of dark.",
  "Install the battery. It needs no pipes and no job.": "One battery. No pipes, no jobs: just plug it in.",
  "Charging from power the electrolyzer does not need.": "Banking the sunlight.",
  "Dusk is coming. Watch the battery take over.": "Here comes the night.",
  "Night has fallen. The electrolyzer keeps running on stored energy.": "Lights out. The plant keeps running.",
};

export type Voice = "guide" | "showcase";

export const voiced = (text: string, voice: Voice) => (voice === "showcase" ? (SHOWCASE[text] ?? text) : text);

/** The closing line of a run. */
export function closing(title: string, passed: boolean, voice: Voice) {
  if (!passed) return `“${title}”: a check failed.`;
  return voice === "showcase" ? `${title}: built, run, and verified.` : `“${title}”: every check passed.`;
}
