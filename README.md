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

Behind it sits an inline 430-byte blurred copy of the same photograph
(`src/data/scene-placeholder.ts`), so the first paint already looks like the
scene that is loading. An earlier version used a drawn SVG landscape here, but
that was visibly a different picture and flashed on every refresh. The
placeholder is graded by the same dark-mode filter, otherwise it would flash
bright before the photo lands.

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

**The opening gust.** On arrival the page opens with a dense burst of fast
leaves that holds for 0.55s, then clears left to right over 0.85s while the
ambient drift fades up underneath. Total 1.4s, tuned by `INTRO_HOLD`,
`INTRO_WIPE` and `WIPE_BAND` at the top of `leaves.ts`.

It is deliberately hedged in four ways, because it sits in front of the
content:

- Skipped entirely under `prefers-reduced-motion`. A burst of full-screen
  motion is precisely what that preference is asking us not to do.
- Plays once per tab (`sessionStorage`), so coming back from a project page is
  not treated as a new arrival.
- Deferred if the page loaded in a background tab, so it plays when the visitor
  actually looks rather than being spent on nobody.
- Skipped if the sprite sheet arrives more than 2s late. By then the visitor is
  reading, and a gust is an interruption rather than an entrance.

The clearing front is deliberately faster than the leaves themselves. If it
were not, leaves would ride ahead of it and never be caught.

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

## Security

The site is static: no server, no database, no authentication, no user input,
no cookies and no third-party scripts. Most of the OWASP Top 10 has no surface
here. What does apply:

**Dependencies (A06).** `npm audit` reports 0 vulnerabilities. Keep it that
way; run it before each deploy.

**Content Security Policy (A05).** Configured under `security.csp` in
`astro.config.mjs`. Astro hashes every inline script and style it emits, so
the policy needs no `unsafe-inline`. Two consequences worth remembering:

- **Never add a `style` attribute to an element.** CSP hashes stylesheets but
  cannot hash style attributes, so an inline one is silently blocked. This is
  why the backdrop placeholder lives in a generated stylesheet as
  `--scene-placeholder` rather than on the element. Setting styles from
  JavaScript (`el.style.x = y`) is fine, which is what the leaf and orbit
  scripts do.
- `frame-ancestors` is omitted because it is ignored in a meta policy and
  logs an error on every load. Clickjacking cannot be prevented on GitHub
  Pages, which cannot send response headers. Low risk here, since there is
  nothing to hijack. Add it plus `X-Frame-Options` as real headers if this
  ever moves to a host that can send them.

**Injection (A03).** The only place a value is written into a script element
is the JSON-LD block in `Base.astro`, where `<` is escaped to `<`.
`JSON.stringify` does not escape it, so a value containing `</script>` would
otherwise close the block early.

**Supply chain (A08).** Workflow permissions are minimal (`contents: read`,
`pages: write`, `id-token: write`), every action is pinned to an immutable
commit SHA rather than a movable tag, `npm ci` builds from the lockfile, and
checkout does not persist its token because nothing here pushes.

**Deliberately public.** The CV PDF is served from `public/cv/` and contains a
phone number and email address, and the contact section exposes the email as a
plain `mailto:`. Both are intentional, both will be scraped. Remove the phone
number from the PDF if that matters.

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
