// Cloudflare Worker: serves the static site and handles the contact form.
//
// The form posts to /api/contact. This Worker rate-limits, verifies a Cloudflare
// Turnstile token, validates the input, then sends the message to the studio
// inbox using Cloudflare Email Routing (the send_email binding in wrangler.toml).
// No third-party email API and no API keys in the repo.
//
// Everything else (/, /index.html, /styles.css, /app.js, ...) is served by the
// static-assets binding (env.ASSETS), which also applies public/_headers.

import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/contact") {
      if (request.method !== "POST") {
        return json({ success: false, message: "Method not allowed." }, 405);
      }
      return handleContact(request, env);
    }

    // Not the API route -> serve a static asset (index.html, etc.).
    return env.ASSETS.fetch(request);
  },
};

async function handleContact(request, env) {
  // Does the caller want JSON (our fetch sets this) or a full page (no-JS POST)?
  const wantsJson = (request.headers.get("Accept") || "").includes("application/json");
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";

  let form;
  try {
    form = await request.formData();
  } catch {
    return reply(wantsJson, false, "That submission could not be read.", 400);
  }

  // Honeypot: humans leave it empty. If filled, silently accept and drop.
  if (str(form.get("_honey")).trim() !== "") {
    return reply(wantsJson, true, "Thanks. Your message is on its way.", 200);
  }

  // Rate limit per client IP (binding in wrangler.toml). Cheap, runs early.
  if (env.CONTACT_RATELIMIT) {
    const { success } = await env.CONTACT_RATELIMIT.limit({ key: ip });
    if (!success) {
      return reply(wantsJson, false, "Too many messages. Please wait a minute and try again.", 429);
    }
  }

  // Turnstile: verify the bot-challenge token before doing any work.
  if (!env.TURNSTILE_SECRET) {
    return reply(wantsJson, false, "The contact form is not fully configured yet.", 500);
  }
  const token = str(form.get("cf-turnstile-response"));
  if (!(await verifyTurnstile(token, env.TURNSTILE_SECRET, ip))) {
    return reply(wantsJson, false, "Verification failed. Please complete the challenge and try again.", 400);
  }

  // header() strips CR/LF + all control chars, so nothing can be injected into an
  // email header. body() keeps newlines/tabs but drops other control characters.
  const name = header(form.get("name"), 100);
  const email = header(form.get("email"), 150);
  const message = body(form.get("message"), 2000);

  if (!name || !email || !message) {
    return reply(wantsJson, false, "Please fill in every field.", 400);
  }
  if (!isEmail(email)) {
    return reply(wantsJson, false, "That email address looks off.", 400);
  }
  if (!env.SENDER_ADDRESS || !env.DESTINATION_ADDRESS) {
    return reply(wantsJson, false, "The contact form is not fully configured yet.", 500);
  }

  const mime = createMimeMessage();
  mime.setSender({ name: "Paintbrush Creations site", addr: env.SENDER_ADDRESS });
  mime.setRecipient(env.DESTINATION_ADDRESS);
  mime.setHeader("Reply-To", `${name} <${email}>`);
  mime.setSubject("New message from Paintbrush Creations");
  mime.addMessage({
    contentType: "text/plain",
    data: `Name:  ${name}\nEmail: ${email}\n\n${message}\n`,
  });

  try {
    await env.CONTACT_EMAIL.send(
      new EmailMessage(env.SENDER_ADDRESS, env.DESTINATION_ADDRESS, mime.asRaw())
    );
  } catch (err) {
    console.error("send_email failed:", err && err.message);
    return reply(wantsJson, false, "Could not send right now. Please try again shortly.", 502);
  }

  return reply(wantsJson, true, "Thanks. Your message is on its way.", 200);
}

// ---- helpers ---------------------------------------------------------------

async function verifyTurnstile(token, secret, ip) {
  if (!token) return false;
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (ip && ip !== "unknown") body.append("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

function str(v) {
  return v == null ? "" : String(v);
}

// For values placed in an email header: strip ALL control chars (incl. CR/LF).
function header(v, max) {
  return str(v).replace(/[\x00-\x1F\x7F]/g, "").trim().slice(0, max);
}

// For the message body: keep newline (\x0A) and tab (\x09), strip other controls.
function body(v, max) {
  return str(v).replace(/[\x00-\x08\x0B-\x1F\x7F]/g, "").trim().slice(0, max);
}

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}

// JSON for fetch callers; a tiny self-contained HTML page for no-JS POSTs.
function reply(wantsJson, success, message, status) {
  if (wantsJson) return json({ success, message }, status);
  const safe = message.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const html =
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${success ? "Message sent" : "Something went wrong"}</title>` +
    `<body style="font-family:system-ui;max-width:32rem;margin:18vh auto;padding:0 1.25rem;text-align:center;line-height:1.6">` +
    `<h1 style="font-size:1.5rem">${success ? "Thanks!" : "Hmm."}</h1><p>${safe}</p>` +
    `<p><a href="/#contact" style="color:#23b3a3;font-weight:600">Back to the site</a></p></body>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "X-Content-Type-Options": "nosniff" },
  });
}
