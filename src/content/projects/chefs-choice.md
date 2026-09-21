---
title: "Chef's Choice"
track: "fullstack"
tagline: "Three places to eat near you, and never the same three twice."
brief: >-
  A web app for the question nobody wants to answer at seven in the evening. It
  sweeps the map around you for real restaurants and offers three: one safe, one
  you have not tried, one a reach. Veto any of them and it remembers.
role: "Personal project"
period: "2026"
stack:
  - "React"
  - "Vite"
  - "OpenStreetMap Overpass"
  - "Google Places API"
  - "IndexedDB"
highlights:
  - "A rebuild measured rather than guessed: over a 60-day simulation on real Muscat data, unique suggestions went from 11% of slots to 83%, and the most-repeated place from 50 days out of 60 down to 3."
  - "One button gives you a Safe Bet, a Something New and a Long Shot. Veto anything you do not want, and it remembers, so tomorrow is different from today."
  - "Discovery moved to a tiled OpenStreetMap sweep, which finds 505 places where Google's API caps at 20, including the Arabic-named local spots that popularity ranking buries under the chains."
  - "Google is now called about three times per spin instead of up to fifty, and the app works fully offline with no API key at all."
  - "Shipped with the security of its own deployment thought through: a restricted key, a referrer policy chosen so the restriction still works, and cache rules that stop returning visitors being stranded on an old build."
repo: "https://github.com/6qzr/restaurant-picker"
repoNote: null
order: 3
featured: true
---

Deciding where to eat is a small problem that everyone has and nobody enjoys.
Chef's Choice answers it in one button: three places near you, one safe, one
you have not tried, one a bit of a reach. Swipe away anything that does not
appeal. It remembers what it has already shown you, so tomorrow is a different
three.

The first version did not work, and the reason turned out to be structural
rather than a matter of tuning. Google's nearby search returns at most twenty
results, has no pagination, and ranks by popularity. After filtering to rated
places the app was choosing from roughly fifteen rows, so the same handful of
restaurants kept coming back. The "hidden gem" tier asked for places with few
reviews, which a popularity-ranked list almost never contains, so it quietly
fell back to the same pool as the safe pick. Two of the three cards were
effectively the same card.

Rather than guess at a fix, I simulated sixty days of one spin per day against
real data from Muscat and measured it. Unique places went from 11% of slots to
83%, the most-repeated restaurant from fifty days out of sixty down to three,
and the number of boards showing two of the same cuisine from 43% to zero. The
run that mattered most was the control: widening the data alone only reached
36%, which showed the sampler had to change too, not just the source.

So discovery moved off Google entirely and onto a tiled OpenStreetMap sweep,
which turns up 505 places across the city where the old call allowed twenty,
and surfaces the small Arabic-named places that popularity ranking pushes below
the chains. Results cache in the browser, so a repeat visit fills the pool in
about ten milliseconds and the whole app works offline. Google now does one
narrow job, decorating the three cards you actually see with a rating and a
photo, which took it from as many as fifty calls per spin down to three.

The picker itself avoids repeats by decaying novelty on a ten-day half-life and
multiplying it into the score rather than adding, so somewhere you saw
yesterday drops out of contention without being banished. Selection is
Gumbel-top-k at a temperature you control, from Safe to Chaos, with a
constraint that stops the board offering three pizza places.

The deployment got the same attention as the app. Vite inlines any `VITE_`
variable into the bundle, so an API key in the build is public to anyone who
opens devtools; the key is restricted by referrer and to a single API, and the
setup screen tells you the exact string to paste. The referrer policy is
deliberately not the strictest available, because Google's referrer restriction
reads that header and suppressing it would reject every call. Cache rules keep
the content-hashed assets forever and refuse to cache the entry point and
service worker, which is the usual reason a deployed update never reaches
people who already have the site open.
