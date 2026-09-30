# Info session recording

Share `/en/info-session/2026-09-18/` or `/de/info-session/2026-09-18/` after deployment.
These pages are unlisted, with robots metadata and Vercel `X-Robots-Tag` headers
for the page and media. They are not password protected: anyone with a link can watch.
Do not add them to navigation or a future sitemap.

The complete 18 September recording is served as a static MP4 through Vercel,
without a video service or client player dependency. Native controls support
keyboard access, seeking and fullscreen; `playsinline` supports inline playback
on iPhones. `preload="none"` avoids fetching the recording before playback.
The source contains no subtitle track; captions have not been added.

## Encoding

Source: `AI for Access Hackathon info session-20260918_183428-Meeting Recording.mp4`.
The original stays outside the repository. Recreate the optimized asset with:

```sh
ffmpeg -i "$SOURCE_VIDEO" -map 0:v:0 -map 0:a:0 -vf scale=1280:-2 \
  -c:v libx264 -preset fast -crf 29 -pix_fmt yuv420p -g 64 \
  -c:a aac -ac 1 -b:a 48k -movflags +faststart \
  public/media/info-session-20260918/recording.mp4
ffmpeg -ss 30 -i "$SOURCE_VIDEO" -frames:v 1 -vf scale=1280:-2 -q:v 3 \
  public/media/info-session-20260918/poster.jpg
```

H.264/AAC MP4 follows [Apple's Safari video guidance](https://developer.apple.com/documentation/webkit/delivering-video-content-for-safari).
The optimized file remains below 100 MB for GitHub and Vercel static hosting.

## Verification

Run `bun run build`, start the site, then run
`node scripts/check-recording.mjs http://localhost:4321` (requires ffprobe).
The check covers both locales, noindex, no homepage link, deferred loading,
codecs, full duration, fast-start metadata, and beginning/end byte-range requests.
Run it against the deployed URL as well to verify production HTTP behavior.

Verified on 30 September 2026: production build and recording checks pass.
Chrome 154 plays the video and seeks to 15 seconds before the end without errors.
The mobile layout at 390 px has no horizontal overflow; its screenshot is in
`docs/screenshots/2026-09-30_1442_HCK-recording_mobile.png`.
Safari, Firefox, Edge, audible output and fullscreen have not been manually tested.
Production HTTP behavior remains to be checked after deployment.
`bunx astro check` is currently blocked by the existing TypeScript 7 / Astro
checker incompatibility.
