/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#15202b",
        slate2: "#5a6775",
        bench: "#edf0f3",
        rule: "#d5dbe2",
        ibm: "#1f5fbf",
        ibmdark: "#174a96",
      },
      fontFamily: {
        serif: ['"IBM Plex Serif"', "Georgia", "serif"],
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
