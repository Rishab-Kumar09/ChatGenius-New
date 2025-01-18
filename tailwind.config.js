/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./client/src/**/*.{js,jsx,ts,tsx}",
    "./client/index.html",
    "./dist/public/**/*.{html,js}",
    "./client/dist/**/*.{html,js}",
    "./public/**/*.{html,js}"
  ],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        border: "#e5e7eb"
      }
    }
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography")
  ]
}

