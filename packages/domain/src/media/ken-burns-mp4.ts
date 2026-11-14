import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Builds a short MP4 from a still image (Ken Burns zoom). Product-neutral proposal;
 * not a third-party generative video API.
 */
export async function kenBurnsMp4FromImage(input: {
  imageBytes: Buffer;
  durationSeconds: number;
  width?: number;
  height?: number;
  ffmpegPath?: string;
}): Promise<Buffer> {
  const ffmpeg = input.ffmpegPath ?? process.env.FFMPEG_PATH?.trim();
  if (!ffmpeg) {
    throw new Error('FFMPEG_NOT_AVAILABLE');
  }
  const w = input.width ?? 1080;
  const h = input.height ?? 1920;
  const dur = Math.min(Math.max(input.durationSeconds, 3), 30);
  const dir = await mkdtemp(join(tmpdir(), 'oma-kenburns-'));
  const inPath = join(dir, 'in.jpg');
  const outPath = join(dir, 'out.mp4');
  try {
    await writeFile(inPath, input.imageBytes);
    const vf = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},zoompan=z='min(zoom+0.0012,1.2)':d=${dur * 25}:s=${w}x${h}:fps=25`;
    await runFfmpeg(ffmpeg, [
      '-y',
      '-loop',
      '1',
      '-i',
      inPath,
      '-vf',
      vf,
      '-t',
      String(dur),
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      outPath,
    ]);
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runFfmpeg(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    child.stderr?.on('data', (c) => {
      err += String(c);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(err.slice(-800) || `ffmpeg exit ${code}`));
    });
  });
}
