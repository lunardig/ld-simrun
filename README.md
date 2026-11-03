# Sim Runner for Lunar Dig

Sim Runner plays Lunar Dig's scenarios the way a person would. It installs machines,
connects them, starts jobs and waits for results, one step at a time, with a caption for
each. In the game window you watch the factory appear and come to life.

It is a **third-party controller**: an ordinary web page on its own site
(https://lunardig.github.io/ld-simrun/), driving the game through the claim host protocol,
ldcp-0 (`LdcpClient` in [lunardig/ld-sdk](https://github.com/lunardig/ld-sdk), guide §8).
The game asks you to allow it, and records every command it sends in the claim's history
under its address. Anything it does, your own controller can do.

## Try it

1. Open https://lunardig.com/?demo=simrun, which starts a claim with the Controllers dialog open.
2. Press **Open Sim Runner** and allow it.
3. Press **Run all**, or pick scenarios. The game asks before each scenario starts. Tick
   "without asking" to run them back to back.
4. Waits ("until 90 kg of regolith is stored") run at the game's speed. Raise the speed in
   the game, or tick **Let controllers set the pace** so Sim Runner can fast-forward while
   it waits. Your own speed control always wins.

**Presentation** shows large captions for recording, and **Showcase captions** switches to the punchier voice used in the clips (`?present&voice=showcase` in the address does both). Runs that a controller starts do not
count toward your campaign.

## Storyboards

`src/storyboards.ts` holds one storyboard per lesson: actions (one command each), waits on
what the claim shows, and captions. Commands take effect at the game's current time, so a
storyboard never names a time; it waits for a state instead. Each storyboard ends with
checks, so a run is also a test: pass or fail.

```ts
{
  id: "dig",
  scenario: { kind: "campaign", id: "dig" },
  steps: [
    { say: "Install the excavator.", do: "INSTALL", args: { lot_id: { kit: "excavator-kit" }, product: "excavator-kit", location: "pad-a", as_id: "excavator-1" } },
    { say: "Waiting for 90 kg of regolith.", wait: { stored: "regolith", atLeast: 90 }, pace: 600, label: "90 kg in the hopper" },
  ],
  checks: [{ label: "At least 90 kg stored", holds: { stored: "regolith", atLeast: 90 } }],
}
```

Fork the repository to add your own: a new storyboard, a different narration, your own
look. GitHub Pages publishes your fork at `https://<you>.github.io/ld-simrun/`, and the
game's Controllers dialog opens it by address.

## Develop

    git clone --recurse-submodules https://github.com/lunardig/ld-simrun
    npm ci
    npm run dev            # then open it from the game's Controllers dialog
    npm test               # conditions and storyboards
    npm run build && npm run e2e

`npm run e2e` drives the live game (or `HOST_URL=` a local one) through every storyboard in
a headless browser. `VIDEO_DIR=recordings` records both windows and, with ffmpeg, composes a
1080p MP4 per storyboard and one for the whole run: the game on the left, Sim Runner's
caption column on the right, title and footer. `VOICE=showcase` (the default for clips) uses
the punchier captions in `src/showcase.ts`; `guide` uses the teaching ones. The **e2e**
workflow runs it on demand and uploads the clips (`clips-1080p`) and the raw windows.

## Licence

Apache-2.0 (LICENSE, NOTICE). Copyright 2026 ioMetics LC.
