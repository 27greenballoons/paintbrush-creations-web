// Runs in <head> before paint: apply the saved (or OS-preferred) theme so there's
// no flash of the wrong mode. External file so the page needs no inline scripts.
(function () {
  var saved = localStorage.getItem("theme");
  var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (saved === "dark" || (!saved && prefersDark)) {
    document.documentElement.classList.add("dark");
  }
})();
