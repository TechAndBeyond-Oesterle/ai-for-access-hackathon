// Run with the site running: node scripts/check-recording.mjs http://localhost:4321
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const base = process.argv[2] || 'http://localhost:4321';
const media = '/media/info-session-20260918/recording.mp4';
for (const lang of ['de', 'en']) {
  const response = await fetch(`${base}/${lang}/info-session/2026-09-18/`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /name="robots" content="noindex, nofollow, noarchive"/);
  assert.match(html, /<video[^>]*controls[^>]*playsinline[^>]*preload="none"/);
  assert.ok(html.includes(media));
  const homepage = await (await fetch(`${base}/${lang}/`)).text();
  assert.ok(!homepage.includes('/info-session/2026-09-18'), 'Recording must remain unlisted');
}

const file = new URL(`../public${media}`, import.meta.url);
const size = statSync(file).size;
assert.ok(size < 100_000_000, 'Keep the recording below 100 MB');
const bytes = readFileSync(file);
assert.ok(bytes.indexOf('moov') < bytes.indexOf('mdat'), 'MP4 must support fast start');
for (const range of ['bytes=0-1023', `bytes=${size - 1024}-${size - 1}`]) {
  const response = await fetch(`${base}${media}`, { headers: { Range: range } });
  assert.equal(response.status, 206, 'Video seeking requires partial responses');
  assert.match(response.headers.get('content-type'), /video\/mp4/);
  assert.equal((await response.arrayBuffer()).byteLength, 1024);
}

const probe = JSON.parse(execFileSync('ffprobe', [
  '-v', 'error', '-show_streams', '-show_format', '-of', 'json', file.pathname,
], { encoding: 'utf8' }));
assert.ok(probe.streams.some(s => s.codec_name === 'h264' && s.pix_fmt === 'yuv420p' && s.width === 1280));
assert.ok(probe.streams.some(s => s.codec_name === 'aac'));
assert.ok(Math.abs(Number(probe.format.duration) - 3620.16) < 1, 'Preserve the full recording');
console.log('Recording checks passed: both pages, unlisted links, codecs, fast start and HTTP seeking.');
