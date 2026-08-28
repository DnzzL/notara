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

## The story

Not a feature tour — a feature tour is a list, and a list does not make anyone
believe anything. This is one believable minute of someone's Tuesday, where
each step causes the next:

| Beat | What it proves |
|---|---|
| a tracker page links to a brief | pages link to pages |
| follow the link | the app navigates, the sidebar follows |
| the brief is a real page — Goal, Scope, Milestones | it is not a stub |
| it knows who links to it — one backlink, pointing home | the graph is real, both ways |
| back to the tracker via the sidebar | the tree kept its place |
| the same records, as a board | one dataset, several views |

The claim underneath is *everything is connected*, which is exactly what a
screenshot cannot say.

An earlier cut showed a table turning into a board and nothing else. That
answers "does it have views", which nobody was asking. The objection a hero for
a Notion alternative has to kill is *is this actually as good?* — and that is
answered by watching someone move through it, not by watching a control change
state.

### What could not be filmed

Some interactions do not survive automation and were cut rather than filmed
badly: the status picker in a table cell ignores synthetic events, the page
chip inside a cell does not navigate (only the page-link *block* does), and
markdown shortcuts work but the trailing empty block does not persist between
steps. Probe every interaction before writing a storyboard around it.

## The camera

Two problems in one: this renders at **693x395** on the landing page. A frame
wide enough to show the product puts the app's 13px text under 6px; a frame
tight enough to read shows a fragment. So the camera moves — wide to establish,
in to read, out to close the loop on the frame it opened with.

`TIMELINE` in `src/Hero.tsx` is the whole choreography: keyframes of `{ t, shot }`,
interpolated between, held where two keyframes share a shot. Every move lands
*before* the thing it exists to show.

The shots are windows over the source, not CSS scales of the whole frame. The
content column measures **1035 CSS px** (from the DOM, not guessed); anything
narrower clips headings, which reads as broken rather than cropped.

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
