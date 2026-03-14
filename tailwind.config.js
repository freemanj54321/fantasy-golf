/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        masters: {
          dark: '#073017',   /* Deepest green (borders/shadows) */
          base: '#0a4220',   /* Main background green */
          light: '#0d5428',  /* Lighter hover green */
        }
      }
    },
  },
  plugins: [
    require("tailwindcss-animate")
  ],
}
