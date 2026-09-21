# WE.YO architects

Vanilla HTML/CSS/JavaScript with a Vercel Node.js function and Supabase CMS.

- Production project: `weyo-footer-restored-v2`
- Production URL: https://weyo-footer-restored-v2.vercel.app
- Git deployment branch: `main`
- Canonical origin: `https://www.we-yo.com`
- CMS: `/admin.html` (`/admin` redirects there)

## Runtime

`api/site.js` renders the existing `index.html` page functions with published CMS
projects and per-page SEO. `vercel.json` routes public pages through that function,
including `/` and `/sitemap.xml`; only the admin, robots, and assets are served as
static files. Unknown pages and project slugs return HTTP 404 with noindex.

`assets/media.js` is the shared browser/Node image resolver. Relative paths resolve
inside the Supabase public `project-media` bucket; HTTP(S) URLs pass through.
Filenames ending in `-mv2.jpg` are existing Supabase object names, not Wix requests.

CMS outage responses retain the existing fallback page rendering, return 503 with
no-store/noindex, and allow browser-side CMS recovery. A failed CMS read never
publishes the fallback project list as a current sitemap.

## Before connecting the custom domain

1. Verify the `main` deployment is READY and test the production URL above.
2. Keep the current DNS records, especially email MX/TXT records, for reference.
3. In a separate domain-connection task, add `www.we-yo.com` and `we-yo.com` to this
   Vercel project and apply the exact DNS records Vercel provides. Make `www` the
   canonical host and redirect the apex to it. Nameserver replacement is not
   inherently required.
4. Confirm HTTPS, clean URLs, legacy 301s, robots, sitemap, and canonical tags on
   the real domain. Confirm Supabase Auth allows `https://www.we-yo.com/admin.html`
   before testing the CMS email login on the custom domain.
5. Submit `https://www.we-yo.com/sitemap.xml` in Google Search Console and Naver.

No DNS, nameserver, registrar, Wix domain, or Vercel custom-domain settings are
changed by repository deployment.
