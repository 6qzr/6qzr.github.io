# Maintenance notes

Notes for working on the site itself. The public readme is [README.md](README.md).

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # type-checks, then writes dist/
npm run preview  # serve the production build
```

Node 22 or newer. Deploys on every push to `main`.

## Where to change things

Almost all copy lives in `src/data/site.ts`: name, headline, contact links, the
About copy, the build and protect sections, the stack chips, the timeline and
the certificates. Colours, type scale and the glass surfaces are in
`src/styles/global.css`.

Projects are one Markdown file each in `src/content/projects/`. Copy the
frontmatter from an existing one; the schema in `src/content.config.ts`
validates it at build time, so a mistake fails the build instead of rendering
an empty card. The filename becomes the URL. Set `featured: false` to keep a
project off the homepage while still publishing its page.

Replacing the CV means overwriting `public/cv/Mohammed-Al-Abri-CV.pdf`, or
updating the path in `site.ts` if the filename changes.

## Traps

**Put `data-reveal` on the glass panel itself, never on a wrapper around it.**
A filling opacity animation creates a stacking context, so a `backdrop-filter`
on a child samples that group instead of the page behind it and the blur has
nothing to blur. The timeline panels looked visibly more transparent than every
other card until this was fixed.

**Never put a `style` attribute on an element.** The Content Security Policy
hashes stylesheets but cannot hash style attributes, so an inline one is
silently blocked and simply does not apply. This already bit once: the backdrop
placeholder stopped painting. It now comes in as `--scene-placeholder` from a
generated stylesheet. Setting styles from JavaScript (`el.style.x = y`) is
fine, which is what the leaf and orbit scripts do.

**The leaf sheet geometry is duplicated in three files.** `FRAMES`, the variant
count and the tile size appear in `tools/render_leaves.py`,
`tools/build_leaf_sheet.py` and `src/scripts/leaves.ts`. Change one without the
others and the canvas samples the sheet at the wrong offsets.

**The spiral cannot hold many chips.** A golden spiral widens by phi every
quarter turn, so the arc has room for roughly nine readable pills. That is why
only `spotlight` entries ride it and the full list sits below.

## Design notes

**The landscape** is the photograph in `public/images/`, fixed behind the page.
It ships at four widths in WebP and JPEG, served through a `<picture>` and
preloaded, so a desktop pulls about 395KB rather than the 2.6MB source. Dark
mode grades the same photograph down to dusk with a CSS filter rather than
loading a second image. Behind it sits a 430-byte blurred copy of the same
photo so the first paint already looks like the scene that is loading.

The photo puts a figure dead centre, which is why the hero copy sits upper
left and carries its own soft diagonal wash. If the backdrop is ever swapped
for one with a different focal point, revisit both.

**The golden ratio** is used literally, not decoratively. The spacing scale
steps by phi, the About and footer grids split 1fr / 1.618fr, and the stack
chips travel a real logarithmic spiral, `r(θ) = r₀·φ^(θ/(π/2))`, which widens
by exactly phi every quarter turn. The faint guide curve behind them is
generated from the same equation, so the visible path and the travelled path
cannot drift apart. The chips advance by radius rather than angle: arc length
on a log spiral is proportional to radius, so that gives constant speed and
even spacing. Stepping the angle instead made outer chips race and bunched
them all at the eye.

**Leaves** are a sprite sheet rendered in Blender: 28 frames by 3 variants at
72px. Each row is one full turn about the leaf's long axis, so the leaf goes
edge-on and flat again, and the loop is seamless because the turn completes
exactly once. Veins are geometry rather than texture, a raised midrib plus
narrow gaussian ridges, because real ridges catch the light at sprite size.
Rendered in Cycles, since the light passing through the blade is most of what
makes a leaf read as organic.

```bash
blender -b -P tools/render_leaves.py   # renders frames to a temp dir
python tools/build_leaf_sheet.py       # assembles public/images/leaves.webp
```

**The opening gust** holds a dense burst of leaves for 0.55s, then clears left
to right over 0.85s while the ambient drift fades up underneath. Tuned by
`INTRO_HOLD`, `INTRO_WIPE` and `WIPE_BAND` in `leaves.ts`. The clearing front
is deliberately faster than the leaves; if it were not, they would ride ahead
of it and never be caught. It is skipped under `prefers-reduced-motion`, plays
once per tab, defers while the page is in a background tab, and is skipped
entirely if the sprite sheet arrives more than two seconds late.

**Section scrolling** uses CSS scroll snap in `mandatory` mode: one gesture
carries you the whole way to the next slide, with the content centred.

That only works because **every section fits one screen**. Verified at
1280x800, 1440x900 and 1536x864, where all seven measure exactly 1.00 screens.
If a section ever grows past the viewport the browser fights the reader while
they are partway through it, which is what makes scroll-jacked sites unusable.
Measure before adding content to a section:

```js
const vh = document.documentElement.clientHeight;
[...document.querySelectorAll('main > section')]
  .map(s => s.id + ' ' + (s.getBoundingClientRect().height / vh).toFixed(2));
```

Getting there meant laying the dense sections out sideways rather than cutting
anything: the spiral sits beside the stack list, and the timeline runs in two
columns with the certificates on one line. `global.css` falls back to
`proximity` below 44rem tall or 48rem wide, where sections stack and grow.

## Performance and accessibility

- About 2.3KB of gzipped JavaScript for every animation on the page.
- Only `transform` and `opacity` are animated, so everything stays on the
  compositor, and every animation loop suspends off-screen or when the tab is
  hidden.
- The theme is resolved by a blocking inline script before first paint, so the
  page never flashes the wrong theme.
- `prefers-reduced-motion`, `prefers-reduced-transparency` and
  `prefers-contrast` are each handled separately. Under reduced motion the
  spiral becomes a plain list, the leaves and the gust do not run, and scroll
  snapping is switched off.
- The scrollbar is hidden. Scrolling still works by every other means, but the
  drag control and the position cue are both gone.

## Security

Static site: no server, database, authentication, user input, cookies or
third-party scripts, so most of the OWASP Top 10 has no surface here.

- `npm audit` reports 0 vulnerabilities. Run it before each deploy.
- CSP is configured under `security.csp` in `astro.config.mjs`. Astro hashes
  its inline scripts and styles, so the policy needs no `unsafe-inline`.
- `frame-ancestors` is omitted because it is ignored in a meta policy and logs
  an error on every load. Clickjacking cannot be prevented on GitHub Pages,
  which cannot send response headers. Add it plus `X-Frame-Options` as real
  headers if this ever moves to a host that can.
- The JSON-LD in `Base.astro` escapes `<` to `<`, because
  `JSON.stringify` does not, and a value containing `</script>` would close the
  block early.
- Workflow permissions are minimal, every action is pinned to a commit SHA,
  `npm ci` builds from the lockfile, and checkout does not persist its token.
- The CV PDF and the `mailto:` are public on purpose and will be scraped. The
  PDF contains a phone number.

## Deploying

Pushes to `main` build and deploy through `.github/workflows/deploy.yml`.
Pages is set to the **GitHub Actions** source, not "deploy from a branch".

This is a root user-site, so it is served from `/` and `astro.config.mjs` needs
`site` but no `base`. Moving it to a project repo would require adding `base`
or every asset path breaks.
