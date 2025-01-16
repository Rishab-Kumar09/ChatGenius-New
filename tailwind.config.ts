import type { Config } from "tailwindcss";

export default {
  content: [
    "./client/src/**/*.{js,jsx,ts,tsx}",
    "./client/index.html",
  ],
  theme: {
    extend: {},
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
