// Composes a 1080p clip from the two window recordings: the game large on the left, Sim
// Runner's caption column on the right, a title and a footer. Needs ffmpeg.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FONTS = ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"];
const font = (bold) => FONTS.slice(bold ? 0 : 1).find(existsSync) ?? FONTS.find(existsSync);

/**
 * host, runner: { file, t0 } — a recording and the wall time (ms) it started.
 * from, to: wall times (ms) of the segment. runnerBox: where the runner page sits in its
 * recording frame (it is letterboxed when its viewport is narrower than the video).
 */
export function compose({ host, runner, from, to, title, out, runnerBox }) {
  const dir = mkdtempSync(join(tmpdir(), "clip-"));
  const text = (name, s) => {
    const f = join(dir, name);
    writeFileSync(f, s);
    return f.replace(/[:\\']/g, (c) => `\\${c}`);
  };
  const dur = ((to - from) / 1000).toFixed(2);
  const ss = (rec) => Math.max(0, (from - rec.t0) / 1000).toFixed(2);
  const { x, y, w, h } = runnerBox;
  const bold = font(true).replace(/:/g, "\\:");
  const plain = font(false).replace(/:/g, "\\:");
  const filter = [
    `color=c=0x111215:s=1920x1080:d=${dur}:r=30[bg]`,
    `[0:v]scale=1344:756,setsar=1[g]`,
    `[1:v]crop=${w}:${h}:${x}:${y},scale=576:1080,setsar=1[r]`,
    `[bg][g]overlay=0:162:shortest=1[a]`,
    `[a][r]overlay=1344:0:shortest=1[b]`,
    `[b]drawtext=fontfile=${bold}:textfile=${text("brand.txt", "LUNAR DIG")}:x=48:y=54:fontsize=30:fontcolor=0x5fc4a0,` +
      `drawtext=fontfile=${bold}:textfile=${text("title.txt", title)}:x=48:y=96:fontsize=40:fontcolor=white,` +
      `drawtext=fontfile=${plain}:textfile=${text("foot.txt", "Played by Sim Runner, a third-party controller   ·   lunardig.com")}:x=48:y=966:fontsize=26:fontcolor=0xb8b6ae,` +
      `drawtext=fontfile=${plain}:textfile=${text("foot2.txt", "Every command verified and recorded in the claim's history")}:x=48:y=1006:fontsize=22:fontcolor=0x8a8880[v]`,
  ].join(";");
  execFileSync(
    "ffmpeg",
    ["-v", "error", "-y", "-ss", ss(host), "-t", dur, "-i", host.file, "-ss", ss(runner), "-t", dur, "-i", runner.file,
     "-filter_complex", filter, "-map", "[v]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart", out],
    { stdio: "inherit" },
  );
}
