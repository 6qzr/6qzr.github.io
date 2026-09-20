// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Root user-site (6qzr.github.io) -> served from "/", so no `base` is needed.
export default defineConfig({
  site: 'https://6qzr.github.io',
  integrations: [mdx(), sitemap()],
  vite: { plugins: [tailwindcss()] },
  build: { inlineStylesheets: 'auto' },

  security: {
    /*
     * GitHub Pages serves static files and cannot set response headers, so the
     * policy ships as a <meta> tag. Astro hashes every inline script and style
     * it emits and adds `script-src` and `style-src` itself, which is what
     * makes this possible without falling back to 'unsafe-inline'.
     *
     * `frame-ancestors` is deliberately absent: it is ignored in a meta policy
     * and browsers log an error for it on every page load. Clickjacking cannot
     * be prevented on Pages without response headers. The risk is low here
     * anyway, since the site has no auth, no forms and no state-changing
     * actions to hijack. Add `frame-ancestors 'none'` and `X-Frame-Options` as
     * real headers if this ever moves to a host that can send them.
     */
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        // `data:` is required: the backdrop placeholder is an inline
        // base64 JPEG (src/data/scene-placeholder.ts).
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
        'upgrade-insecure-requests',
      ],
    },
  },
});
