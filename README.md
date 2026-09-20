# 6qzr.github.io

Personal site for **Mohammed Al Abri** — full-stack developer and cybersecurity
practitioner, Muscat, Oman.

Built with [Astro](https://astro.build), Tailwind CSS v4 and TypeScript.
Deployed to GitHub Pages by GitHub Actions.

---

## Running it

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # type-checks, then writes dist/
npm run preview  # serve the production build
```

Node 22 or newer.

---

## Where to change things

Almost all copy lives in one file.

| What | Where |
| --- | --- |
| Name, headline, email, links, CV path | `src/data/site.ts` |
| About copy, personal facts | `src/data/site.ts` → `about` |
| The build / break section | `src/data/site.ts` → `duality` |
| Tech chips on the spiral | `src/data/site.ts` → `stack` |
| Experience and education | `src/data/site.ts` → `timeline` |
| Certificates | `src/data/site.ts` → `certificates` |
| Projects | `src/content/projects/*.md` |
| Colours, type scale, glass | `src/styles/global.css` |

### Adding a project

Drop a new `.md` file into `src/content/projects/`. Copy the frontmatter from an
existing one — the schema in `src/content.config.ts` validates it at build time,
so a mistake fails the build instead of rendering an empty card. The filename
becomes the URL: `oman-community-services-platform.md` →
`/projects/oman-community-services-platform/`.

Set `featured: false` to keep a project out of the homepage grid while still
publishing its page.

### Replacing the CV

Overwrite `public/cv/Mohammed-Al-Abri-CV.pdf`. The filename is referenced from
`site.ts`, so keep the name or update both.

---

## Design notes

The brief was: *nature feel, sky blue, tree green, liquid glass, golden ratio,
wind-blown leaves.* How each of those is implemented:

**The landscape** is the photograph in `public/images/` — a meadow under
mountains with a figure at a vintage computer. It is fixed behind the page, so
content scrolls over it and the parallax comes for free.

It ships at four widths in WebP and JPEG (`scene-480` … `scene-1600`), served
through a `<picture>` with `srcset`, and preloaded in `<head>` because it is the
largest paint on the page. A desktop pulls ~220KB rather than the 2.6MB source.
Regenerate the derivatives from a new source with the Pillow snippet in the
commit history, or any image tool — just keep the filenames.

Dark mode grades the same photograph down to dusk with a CSS filter rather than
loading a second image.

Behind the photo sits a layered SVG landscape (`NatureScene.astro`) that
re-themes from CSS variables. It is what shows while the photo downloads and if
the photo ever 404s. Pass `photo={false}` to use the drawn scene alone.

**Composition note:** the photo puts a figure dead centre. The hero copy
therefore sits upper-left, over sky and mountain, so the two never compete —
and the hero carries its own soft diagonal wash (`.hero::before`) so the text
stays legible even where it crosses sunlit grass. If the background is ever
swapped for one with a different focal point, revisit both.

**Liquid glass** is `.glass` and `.glass-deep` in `global.css`. Material weight
encodes hierarchy — the heavier blur is for surfaces carrying dense text — and
each surface has a bright top edge so it reads as a physical lip catching light
rather than flat translucency. The two are never nested.

**The golden ratio** is used literally, not decoratively:

- The spacing scale steps by φ (`--spacing-phi-1` … `--spacing-phi-6`).
- The About and footer grids split `1fr / 1.618fr`.
- The stack cards travel a real logarithmic spiral, `r(θ) = r₀·φ^(θ/(π/2))`,
  which widens by exactly φ every quarter turn. The faint guide curve drawn
  behind them is generated from the same equation, so the visible path and the
  travelled path cannot drift apart.

Cards emerge at the eye of the spiral and dissolve at the outer end. To reverse
it — spiralling inward and vanishing at the golden point — set
`data-direction="inward"` on the `[data-orbit]` container in
`src/components/StackOrbit.astro`.

**Leaves** (`src/scripts/leaves.ts`) are one canvas above the page, with a
wandering gust so the wind is never metronomic. Pointer events are off and the
layer carries no information, so nothing is lost if it never loads.

The leaves themselves are rendered in Blender, not drawn in code. The sheet is
28 frames by 3 variants at 72px (`public/images/leaves.webp`, 90KB, fetched
only when motion is allowed). Each row is one full turn about the leaf's long
axis, so the leaf goes edge-on and flat again the way a real one does, and
because the turn completes exactly once across the row the loop is seamless.
The three rows differ in silhouette as well as colour.

Veins are geometry rather than texture: a raised midrib plus narrow gaussian
ridges swept off it. Real ridges catch the light as the leaf turns, which is
what sells it at ~20px. Rendered in Cycles, because the light passing through
the blade is most of what makes a leaf read as organic, and EEVEE only
approximates it.

To change the leaves:

```bash
blender -b -P tools/render_leaves.py   # renders frames to a temp dir
python tools/build_leaf_sheet.py       # assembles public/images/leaves.webp
```

`FRAMES`, the variant count and the tile size are duplicated in
`tools/render_leaves.py`, `tools/build_leaf_sheet.py` and `src/scripts/leaves.ts`.
Change all three together or the sheet will be sampled at the wrong offsets.

### Performance and accessibility

- ~4KB of JavaScript total (1.8KB gzipped) for every animation on the page.
- Only `transform` and `opacity` are animated, so everything stays on the
  compositor.
- Every rAF loop suspends when off-screen or when the tab is hidden.
- The theme is resolved by a blocking inline script before first paint, so the
  page never flashes the wrong theme.
- `prefers-reduced-motion`, `prefers-reduced-transparency` and
  `prefers-contrast` are each handled separately. Under reduced motion the
  spiral becomes a plain readable list and the leaves stop.
- The moving spiral cards are decorative duplicates; a grouped, static version
  of the same list stays in the DOM for screen readers and for no-JS.

---

## Deploying

The site deploys on every push to `main` via `.github/workflows/deploy.yml`.

First-time setup on a fresh repository:

1. Create the repository as **`6qzr/6qzr.github.io`** (the name must match the
   username exactly for a root user-site).
2. Push `main`.
3. In **Settings → Pages**, set **Source** to **GitHub Actions** — not "deploy
   from a branch". Or from the CLI:

   ```bash
   gh api -X POST repos/6qzr/6qzr.github.io/pages -f build_type=workflow
   ```

4. The site goes live at `https://6qzr.github.io`.

Because this is a root user-site it is served from `/`, so `astro.config.mjs`
needs `site` but no `base`. If this is ever moved to a project repo, a `base`
must be added or every asset path will break.
