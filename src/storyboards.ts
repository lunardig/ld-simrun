/**
 * The scenarios, as storyboards. Each follows the game's lesson of the same name (ld-web
 * src/game/campaign.ts): the same machines, the same order, captions from its steps.
 */
import type { Arg, Op, Step, Storyboard } from "./storyboard";

const install = (product: string, as_id: string, say?: string): Step => ({
  say,
  do: "INSTALL",
  args: { lot_id: { kit: product }, product, location: "pad-a", as_id },
});
const connect = (connection_id: string, from_port: string, to_port: string, say?: string): Step => ({
  say,
  do: "CONNECT",
  args: { connection_id, template: "pipe", from_port, to_port },
});
const job = (job_id: string, process: string, machine_id: string, priority: number, say?: string, target = "1000000000000"): Step[] => [
  { say, do: "CREATE_JOB", args: { job_id, process, machine_id, target_extent: target, priority: String(priority) } as Record<string, Arg> },
  { do: "START" as Op, args: { job_id } },
];
const power = (): Step[] => [
  install("solar-kit", "solar-1", "Power first: unpack the solar array from the cargo hold."),
  ...job("job-solar", "generate-solar", "solar-1", 100, "Give it a job. While the sun is up, it feeds the power bus."),
];
const MIN = 60;

export const STORYBOARDS: Storyboard[] = [
  {
    id: "dig",
    title: "Dig",
    blurb: "Power an excavator, dig regolith from an icy crater, and fill a hopper.",
    scenario: { kind: "campaign", id: "dig" },
    steps: [
      { say: "A fresh claim beside an icy crater. Nothing is built yet." },
      ...power(),
      install("excavator-kit", "excavator-1", "Install the excavator. It digs 100 kg per cycle."),
      install("hopper-kit", "hopper-1", "And a hopper to hold what it digs."),
      connect("c-face", "icy-crater.face", "excavator-1.face", "Connect the crater's face to the excavator."),
      connect("c-dig", "excavator-1.out", "hopper-1.io", "Connect the excavator to the hopper."),
      ...job("job-dig", "excavate", "excavator-1", 10, "Give the excavator a job, and let time run."),
      { say: "Waiting for 90 kg of regolith in the hopper.", wait: { stored: "regolith", atLeast: 90 }, pace: 10 * MIN, label: "90 kg in the hopper" },
      { say: "The hopper is filling. A kilogram in every hundred is lost as dust: the engine tracks every element." },
    ],
    checks: [
      { label: "At least 90 kg of regolith stored", holds: { stored: "regolith", atLeast: 90 } },
      { label: "The excavator is still working", holds: { job: "job-dig", status: "RUNNING" } },
    ],
  },
  {
    id: "water-from-ice",
    title: "Water from ice",
    blurb: "Sort ice out of regolith, melt it, and store water: a production chain from soil to water.",
    scenario: { kind: "campaign", id: "water-from-ice" },
    steps: [
      { say: "The excavator is digging and the hopper is filling. Now turn regolith into water." },
      install("beneficiator-kit", "beneficiator-1", "Install the beneficiation plant: it sorts ice and ilmenite out of regolith."),
      install("ice-bin-kit", "ice-bin", "A bin for the ice,"),
      install("ilmenite-bin-kit", "ilmenite-bin", "a bin for the ilmenite,"),
      install("tailings-pile-kit", "tailings", "and a pile for everything else."),
      connect("c-feed", "hopper-1.io", "beneficiator-1.feed", "Feed the plant from the hopper."),
      connect("c-ice-out", "beneficiator-1.ice", "ice-bin.io", "Ice to the ice bin."),
      connect("c-ilm-out", "beneficiator-1.ilmenite", "ilmenite-bin.io", "Ilmenite to its bin."),
      connect("c-tail", "beneficiator-1.tailings", "tailings.io", "Tailings to the pile."),
      ...job("job-sort", "beneficiate", "beneficiator-1", 10, "Start the plant."),
      install("melter-kit", "melter-1", "Next, a melter to turn ice into water,"),
      install("tank-kit", "water-tank", "and a tank for the water."),
      connect("c-melt-in", "ice-bin.io", "melter-1.ice", "Ice bin to the melter."),
      connect("c-melt-out", "melter-1.water", "water-tank.io", "Melter to the tank."),
      ...job("job-melt", "melt-ice", "melter-1", 10, "Start the melter."),
      { say: "Waiting for 20 mol of water.", wait: { stored: "h2o-l", atLeast: 20_000 }, pace: 10 * MIN, label: "20 mol of water" },
      { say: "Soil in, water out. Each machine is the same pattern: install, connect, give it a job." },
    ],
    checks: [
      { label: "At least 20 mol of water stored", holds: { stored: "h2o-l", atLeast: 20_000 } },
      { label: "Ilmenite set aside for later", holds: { stored: "fetio3-s", atLeast: 1 } },
    ],
  },
  {
    id: "split-water",
    title: "Split water",
    blurb: "Split the lander's water into hydrogen and oxygen with solar power.",
    scenario: { kind: "campaign", id: "first-light" },
    steps: [
      { say: "The lander has offloaded 200 mol of water. Split it into rocket fuel and air." },
      ...power(),
      install("tank-kit", "lander-water", "Install a tank where the water is waiting. The water moves in."),
      install("electrolyzer-kit", "electrolyzer-1", "Install the electrolyzer."),
      install("tank-kit", "h2-tank", "A tank for hydrogen,"),
      install("tank-kit", "o2-tank", "and one for oxygen."),
      connect("c-water", "lander-water.io", "electrolyzer-1.water", "Water in,"),
      connect("c-h2", "electrolyzer-1.h2", "h2-tank.io", "hydrogen out,"),
      connect("c-o2", "electrolyzer-1.o2", "o2-tank.io", "oxygen out."),
      ...job("job-split", "electrolyze-water", "electrolyzer-1", 10, "Start splitting: 2 H₂O → 2 H₂ + O₂."),
      { say: "Waiting for 10 mol of hydrogen.", wait: { stored: "h2-g", atLeast: 10_000 }, pace: MIN, label: "10 mol of hydrogen" },
      { say: "36 g of water became 4 g of hydrogen and 32 g of oxygen. Every reaction balances, element by element." },
    ],
    checks: [
      { label: "At least 10 mol of hydrogen", holds: { stored: "h2-g", atLeast: 10_000 } },
      { label: "Oxygen stored too", holds: { stored: "o2-g", atLeast: 5_000 } },
    ],
  },
  {
    id: "iron",
    title: "Iron",
    blurb: "Reduce ilmenite with hydrogen in a batch reactor and make iron.",
    scenario: { kind: "campaign", id: "iron" },
    steps: [
      { say: "300 mol of ilmenite and 300 mol of hydrogen. Hot hydrogen pulls the oxygen out of ilmenite and leaves iron." },
      install("reactor-kit", "reactor-1", "Install the reduction reactor."),
      install("iron-bin-kit", "iron-bin", "A bin for iron,"),
      install("rutile-bin-kit", "rutile-bin", "and one for rutile."),
      connect("c-r-ilm", "ilmenite-bin.io", "reactor-1.ilmenite", "Ilmenite in,"),
      connect("c-r-h2", "h2-tank.io", "reactor-1.h2", "hydrogen in,"),
      connect("c-r-fe", "reactor-1.iron", "iron-bin.io", "iron out,"),
      connect("c-r-ti", "reactor-1.rutile", "rutile-bin.io", "rutile out,"),
      connect("c-r-w", "reactor-1.water", "water-tank.io", "water out,"),
      connect("c-r-back", "reactor-1.unreacted", "ilmenite-bin.io", "and what did not react goes back to the bin."),
      ...job("job-reduce", "reduce-ilmenite", "reactor-1", 10, "One batch: 100 mol of reaction, held at 900 °C for ten minutes.", "100000"),
      { say: "Waiting for the batch to release its iron.", wait: { stored: "fe-s", atLeast: 80_000 }, pace: MIN, label: "80 mol of iron" },
      { say: "Iron from lunar soil. The water the reaction made can go back to the electrolyzer: the hydrogen is only borrowed." },
    ],
    checks: [
      { label: "At least 80 mol of iron", holds: { stored: "fe-s", atLeast: 80_000 } },
      { label: "Rutile made beside it", holds: { stored: "tio2-s", atLeast: 1 } },
    ],
  },
  {
    id: "build-a-hopper",
    title: "Build a hopper",
    blurb: "Fabricate a hopper from the claim's own iron and install it: the loop closes.",
    scenario: { kind: "campaign", id: "build-a-hopper" },
    steps: [
      { say: "1,900 mol of iron, about 106 kg, all made on this claim. Enough for a new hopper." },
      install("fabricator-kit", "fabricator-1", "Install the fabricator."),
      install("scrap-bin-kit", "scrap-bin", "And a bin for offcuts."),
      connect("c-f-fe", "iron-bin.io", "fabricator-1.iron", "Iron in,"),
      connect("c-f-scrap", "fabricator-1.scrap", "scrap-bin.io", "scrap out."),
      ...job("job-fab", "fabricate-hopper", "fabricator-1", 10, "Make one hopper kit.", "1"),
      { say: "Waiting for the kit: about ten minutes of work.", wait: { kitInHold: "hopper-kit" }, pace: MIN, label: "a hopper kit in the hold" },
      install("hopper-kit", "hopper-1", "Install the hopper the claim just made."),
      { say: "Regolith became ice and ilmenite, ice became hydrogen, hydrogen made iron, and iron became equipment." },
    ],
    checks: [
      { label: "The new hopper is installed", holds: { installed: "hopper-1" } },
      { label: "Offcuts went to the scrap bin", holds: { stored: "fe-s", atLeast: 1 } },
    ],
  },
  {
    id: "night-shift",
    title: "Night shift",
    blurb: "Charge a battery before lunar dusk and keep the plant running into the night.",
    scenario: { kind: "campaign", id: "night-shift" },
    steps: [
      { say: "The sun sets in five minutes, and lunar night lasts two weeks." },
      install("battery-kit", "battery-1", "Install the battery. It needs no pipes and no job."),
      { say: "Charging from power the electrolyzer does not need.", wait: { storedEnergyJ: 50_000_000 }, pace: 30, label: "50 MJ in the battery" },
      { say: "Dusk is coming. Watch the battery take over.", wait: { night: true }, pace: 30, label: "dusk" },
      { say: "Night has fallen. The electrolyzer keeps running on stored energy.", wait: { job: "job-split", status: "RUNNING" }, pace: 30, label: "the electrolyzer running at night" },
    ],
    checks: [
      { label: "It is night", holds: { night: true } },
      { label: "The electrolyzer runs after dusk", holds: { job: "job-split", status: "RUNNING" } },
    ],
  },
];

