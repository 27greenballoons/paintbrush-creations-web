/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.{html,js}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ["Fraunces", "ui-serif", "Georgia", "serif"],
        hand: ["Kalam", "ui-sans-serif", "cursive"],
        sans: ["Nunito", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      // Numeric weights so font-600 / font-700 utilities exist.
      fontWeight: { 400: "400", 500: "500", 600: "600", 700: "700" },
      // The studio paint palette. Teal is the house accent; the rest are decorative.
      colors: {
        canvas: "#fdf8ef",
        ink: "#2b2622",
        coral: "#ff6f61",
        mustard: "#f4b53f",
        teal: "#23b3a3",
        cobalt: "#3d6fd6",
        grape: "#8a6cf0",
        leaf: "#54aa5d",
      },
    },
  },
  plugins: [],
};
