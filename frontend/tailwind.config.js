/** @type {import("tailwindcss").Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Manrope", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#edfdf8",
          100: "#d1faed",
          200: "#a7f3d8",
          300: "#6ee7bf",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b"
        }
      },
      boxShadow: {
        soft: "0 12px 40px -12px rgba(0, 0, 0, 0.18)",
      },
      backgroundImage: {
        "hero-grid": "radial-gradient(circle at 1px 1px, rgba(15,118,110,0.12) 1px, transparent 0)",
      },
    },
  },
  plugins: [],
};
