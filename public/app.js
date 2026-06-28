// Site behavior: dark-mode toggle, scroll reveals, and the contact form.
// External file (no inline JS) so the Content-Security-Policy can stay strict.

// 1) Dark-mode toggle (remembers the choice).
var toggle = document.getElementById("theme-toggle");
if (toggle) {
  toggle.addEventListener("click", function () {
    var isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
  });
}

// 2) Scroll reveal via native IntersectionObserver.
var io = new IntersectionObserver(
  function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);
document.querySelectorAll(".reveal").forEach(function (el) {
  io.observe(el);
});

// 3) Contact form: submit inline via fetch to the Worker (/api/contact).
//    The Turnstile widget adds its own hidden token field, which rides along in
//    the FormData automatically.
var contactForm = document.getElementById("contact-form");
if (contactForm) {
  var formStatus = document.getElementById("form-status");
  contactForm.addEventListener("submit", function (e) {
    e.preventDefault();
    formStatus.textContent = "Sending…";
    var lastStatus = 0;
    fetch(contactForm.action, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: new FormData(contactForm),
    })
      .then(function (res) {
        lastStatus = res.status;
        return res.json().catch(function () {
          return {};
        });
      })
      .then(function (data) {
        // textContent (never innerHTML) keeps any returned string inert -> no XSS.
        if (data && data.success === true) {
          contactForm.reset();
          if (window.turnstile) window.turnstile.reset();
          formStatus.textContent = "Thanks. Your message is on its way.";
        } else {
          // Reset the widget so a retry gets a fresh token (Turnstile tokens are
          // single-use; reusing one yields a "timeout-or-duplicate" failure).
          if (window.turnstile) window.turnstile.reset();
          formStatus.textContent =
            data && data.message ? String(data.message) : "Something went wrong (HTTP " + lastStatus + ").";
        }
      })
      .catch(function () {
        formStatus.textContent = "Network error. Please try again in a moment.";
      });
  });
}

// 4) Mobile hamburger menu: toggle the panel and keep aria-expanded in sync.
var navToggle = document.getElementById("nav-toggle");
var mobileMenu = document.getElementById("mobile-menu");
if (navToggle && mobileMenu) {
  navToggle.addEventListener("click", function () {
    var isOpen = mobileMenu.classList.toggle("hidden") === false;
    navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });
  // Collapse the menu after tapping any link.
  mobileMenu.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      mobileMenu.classList.add("hidden");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}
