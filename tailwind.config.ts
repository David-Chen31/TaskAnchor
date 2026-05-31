import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "Segoe UI",
          "Microsoft YaHei",
          "sans-serif",
        ],
      },
      boxShadow: {
        quiet: "0 16px 40px rgba(20, 28, 35, 0.16)",
      },
    },
  },
  plugins: [],
} satisfies Config;
