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

**Glass must sit on the outermost transformed or animated element, never
inside one.** A `transform`, a `filter`, or a filling opacity animation on an
ancestor makes that ancestor a backdrop root, so a `backdrop-filter` on a
descendant has nothing behind it to blur and the panel goes flat and
see-through. This has bitten twice:

- The timeline panels, where `data-reveal` was on the `<li>` wrapper.
- The project deck, where the card was inside a transformed positioning
  wrapper *and* the deck carried `data-reveal`. The fix was to move
  `glass-deep` onto the transformed `.deck__card` and strip the surface from
  the card inside, so there is one pane of glass rather than two stacked.

The deck also carries no `data-reveal`, for a second reason: the `rise`
keyframes animate `transform` with `forwards`, which would pin the card over
the placement the stack script sets.

**Fallback font metrics are measured, not guessed.** `global.css` declares
`Inter Fallback` and `Instrument Serif Fallback` with `size-adjust`,
`ascent-override` and `descent-override` so the fallback occupies exactly the
space the real font will. Without them the page painted in Georgia and then
visibly shrank, because Instrument Serif is 21% narrower. Recompute with
fontTools if either font changes: `size-adjust` is the ratio of average
lowercase advance widths, and the ascent and descent come from the OS/2 table
scaled by that ratio. Both fonts are self-hosted in `public/fonts` and
preloaded from `Base.astro`, which is why they are declared by hand rather
than imported from `@fontsource`.

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

**The spiral holds five chips, and that is arithmetic.** Arc length on a
logarithmic spiral is 3.41x the radius span, so the 536px orbit beside the list
offers about 535px of curve. Nine chips put them 59px apart while averaging
110px wide, which is why they collided; five gives 107px. Widen the orbit or
add a chip and redo that sum.

**The spiral cannot hold many chips.** A golden spiral widens by phi every
quarter turn, so the arc has room for roughly nine readable pills at desktop
width and about five on a phone, where alternates are hidden in CSS. That is
why only `spotlight` entries ride it and the full list sits below. The radius
inset in `orbit.ts` is proportional rather than a flat 80px, which a phone
container cannot spare.

**The project deck is fixed height.** Cards are absolutely positioned and
placed by transform, so the deck reserves one card's worth of space however
many there are, and a card whose content exceeds that height is clipped
silently. `ProjectCard` takes a `compact` prop that trims the highlights to two
for the deck; the detail page carries the rest. Re-measure after any content
change:

```js
[...document.querySelectorAll('.deck__card .card')]
  .map(c => Math.max(0, c.scrollHeight - c.clientHeight));
```

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

**Snapping is opt-in per page**, via `slides` on `Base.astro`, which sets
`data-slides` on `<html>`. It must be: a page with no slide sections still has
a footer, and mandatory snapping with a single snap target pins the page to it.
The project pages opened at the bottom and could not be scrolled up until this
was scoped.

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
anything, and splitting the path in two: the spiral sits beside the stack list,
and education plus certificates get their own slide. Experience keeps the
vertical timeline with a marker per entry: as a row of three cards the unequal
heights read as broken, where on a thread they read as entries simply having
different amounts to say. `global.css` falls back to `proximity` below 44rem tall or
48rem wide, where sections stack and grow.

**How it glides** is `src/scripts/slides.ts`. CSS snap decides where the page
lands but gives no control over how it gets there, and Chrome's native snap
animation lands hard. The controller reads a scroll intent and animates to the
next section, switching native snap off for the duration so the two do not
fight.

What makes a hijacked scroll feel laggy is not the duration on its own, it is
being ignored. A first attempt ran 820ms and swallowed every wheel event until
it finished, so a second flick did nothing and the page felt stuck. It is now
460ms, eased out so it leaves immediately and settles softly, and
**re-targetable**: a flick mid-slide aims at the next one and continues from
wherever the page currently is. `INTENT_GAP` stops one trackpad flick, which
fires dozens of events, from running away through the whole page.

One wheel flick is a burst of dozens of events, so the wheel is **locked for
the whole gesture**: the first event moves one slide and the rest are
swallowed until the animation has finished and the wheel has been quiet for
`WHEEL_QUIET`. Throttling the burst on a timer instead, which an earlier
version did, restarted the animation every 140ms so it never arrived. A
keyboard press produces exactly one event, which is why the keys always felt
right while the wheel crawled.

It is deliberately narrow, because hijacking the wheel is user-hostile when
overdone. It steps aside entirely under reduced motion, below the fallback
breakpoints, and on touch devices where native momentum already feels right.
It never locks the page: any pointer press, hash change or resize cancels the
animation, and native snapping is the behaviour with no JavaScript at all.

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
