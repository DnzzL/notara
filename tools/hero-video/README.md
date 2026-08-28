# Hero video

Authoring tool for the landing-page hero (`packages/app/public/notara-hero.mp4`)
and the README GIF. **Not part of the app build** — it lives outside
`packages/*` on purpose, so it is not a workspace, not in the dependency graph,
and not in the bundle-size budget.

## Why it exists

The hero renders at **693×395** on the landing page. That is the constraint
everything else follows from:

- A frame wide enough to show the product — sidebar, page, two databases — puts
  the app's 13px body text under 6px on screen. Unreadable.
- A frame tight enough to read shows a fragment of a table and nothing that
  says "workspace".

So the video does both, in time.

## What it has to prove

A hero for a Notion alternative is answering one objection: *is this actually as
good?* The copy handles ownership and price; the video's only job is to make
the product look real. It does that in the order a sceptic asks:

| Beat | Question it answers |
|---|---|
| the workspace — sidebar, nested pages | Is this a real app? |
| the page — headings, prose, a sub-page link, `Type '/' for commands` | Is the editor any good? |
| the database — typed fields, relations, a status line | Are the databases real? |
| the same records as a board | Is it more than one view? |

Two reading windows, not one. The content column is **1035 CSS px** wide
(measured from the DOM, not guessed): anything narrower clips headings, which
reads as broken rather than cropped. `PAGE` holds the whole column for the
editor beat; `DB` drops its right edge to buy back size on 13px table rows. The
camera slides between them while the page scrolls, so the move and the content
arrive together.

The last frame matches the first, so the loop has no seam.

ffmpeg cannot do this well. Its `crop` filter evaluates width and height once at
init, so an animated window needs `zoompan`, which resamples every frame and
judders. Remotion animates the window in React and renders deterministically.

## Recording a new capture

The capture must be **2×** (`deviceScaleFactor 2`), so the tightest window still
oversamples the 693px slot instead of upscaling into it.

```
agent-browser set viewport 1440 820 2
agent-browser record start capture.webm
# … drive the app; hide the consent banner, the demo notice and the
#   router devtools *inside* the recording — a recorder starts from a
#   fresh context and loses anything you set up beforehand
agent-browser record stop
```

Trim the lead-in before staging it (`ffmpeg -ss`), then drop it at
`public/capture.webm`. The first frame is what a GIF shows before it loads and
the frame the loop returns to; it must not be the empty state.

Update `BEATS` in `src/Hero.tsx` to the timestamps of the view switches in the
new capture — the push is timed to land just before one.

## Rendering

```
bun run studio    # preview and scrub the choreography
bun run render    # out/hero.mp4 at 1288x734
```

Then encode the three deliverables:

```
ffmpeg -y -i out/hero.mp4 -c:v libx264 -profile:v high -pix_fmt yuv420p \
  -crf 26 -movflags +faststart -an ../../packages/app/public/notara-hero.mp4

ffmpeg -y -ss 0.2 -i out/hero.mp4 -frames:v 1 -q:v 3 \
  ../../packages/app/public/notara-hero-poster.jpg

ffmpeg -y -i out/hero.mp4 -vf "fps=8,scale=700:-2:flags=lanczos,palettegen=max_colors=64:stats_mode=diff" /tmp/pal.png
ffmpeg -y -i out/hero.mp4 -i /tmp/pal.png \
  -lavfi "fps=8,scale=700:-2:flags=lanczos[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle" \
  -loop 0 ../../docs/screenshots/notara-hero.gif
```

The GIF is the expensive one: a moving window means every pixel changes every
frame, so delta compression has nothing to work with. 8fps at 700px is the
point where it stays under ~1.5 MB and still reads.
