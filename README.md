# Paintbrush Creations

Marketing site for Paintbrush Creations, deployed on **Cloudflare Workers**
(static assets + a Worker for the contact form).

- **Site:** `public/index.html`, styled by **compiled Tailwind** (`public/styles.css`,
  built from `src/styles.css`). All scripts are external (`public/theme.js`,
  `public/app.js`) so the Content-Security-Policy can stay strict.
- **Contact form:** posts to a Cloudflare Worker (`src/index.js`) that emails the
  studio via **Cloudflare Email Routing** (`send_email` binding), gated by
  **Cloudflare Turnstile** and a **rate limit**. No third-party form service and
  no API keys. The studio email is **not shown on the site and not committed to
  the repo** (it's a secret); contact is form-only.

```
wrangler.toml          Worker + static assets + send_email + rate-limit bindings
tailwind.config.js     Tailwind theme (palette, fonts)
package.json           build (tailwind), dev, deploy scripts
src/index.js           Worker: rate limit -> Turnstile -> validate -> send email
src/styles.css         Tailwind input (compiled to public/styles.css)
public/index.html      the site
public/{theme,app}.js  external scripts
public/_headers         security headers (strict CSP, HSTS, etc.)
```

## One-time Cloudflare setup

### 1. Email Routing (so the form can deliver)
1. Cloudflare dashboard → your domain → **Email → Email Routing → Enable**.
2. **Destination addresses → add the address you want messages sent to, and
   verify it** (Cloudflare emails a confirmation link).
3. Store that address as a Worker secret so it stays out of this repo:
   ```bash
   npx wrangler secret put DESTINATION_ADDRESS
   ```
4. Set `SENDER_ADDRESS` (the `From` address) as a Worker secret too, so no email
   is committed: Worker → Settings → Variables and Secrets → add `SENDER_ADDRESS`
   = an address on your domain, e.g. `contact@yourdomain.com` (mailbox need not
   exist; the domain must have Email Routing enabled).

### 2. Turnstile (bot protection)
1. Dashboard → **Turnstile → Add widget** for your domain.
2. Put the **Site key** in `public/index.html` (replace `YOUR_TURNSTILE_SITE_KEY`).
   The site key is public and safe to commit.
3. Store the **Secret key** as a Worker secret (never commit it):
   ```bash
   npx wrangler secret put TURNSTILE_SECRET
   ```

### 3. Rate limit
Already configured in `wrangler.toml` (`[[ratelimits]]`, 5 submissions per minute
per IP). Tune `limit`/`period` there; `period` must be 10 or 60.

## Develop & deploy

```bash
npm install
npm run dev      # builds CSS, runs http://localhost:8787 (site + Worker)
npm run deploy   # builds CSS, publishes to Cloudflare
```

For local `npm run dev`, create a **gitignored** `.dev.vars` file with your secrets:

```
SENDER_ADDRESS=contact@yourdomain.com
DESTINATION_ADDRESS=you@example.com
TURNSTILE_SECRET=1x0000000000000000000000000000000AA
```

and use Cloudflare's always-pass Turnstile **test** site key
`1x00000000000000000000AA` in the HTML (`1x0000…AA` above is its matching test
secret).

To deploy from GitHub instead, connect the repo in **Workers & Pages → Create →
Workers**; Cloudflare runs `npm run deploy` on push.

## Security summary

- **No SQL anywhere**, so SQL injection does not apply.
- **XSS:** visitor input is never written into the page as HTML (`textContent`
  only); the no-JS thank-you page escapes its output; strict CSP with no
  `'unsafe-inline'` / `'unsafe-eval'`.
- **Email-header / CRLF injection:** the Worker strips control characters from
  name/email before they touch any header; the message is body-only.
- **Bots:** Cloudflare Turnstile (verified server-side) + a hidden honeypot.
- **Floods:** native per-IP rate limit on the form.
- **Abuse:** the Worker only ever sends to `DESTINATION_ADDRESS` (a verified Email
  Routing address), so the form can only email the studio.
- **Secrets:** `SENDER_ADDRESS`, `DESTINATION_ADDRESS`, and `TURNSTILE_SECRET` are
  all set in the dashboard (or via `wrangler secret put`) and never committed.
  No email address appears anywhere in the repo or on the page.
