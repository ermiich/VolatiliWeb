export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#1a1d27",
        border: "#2d3148",
        accent: "#6366f1",
        base: "#0f1117"
      },
      fontFamily: {
        sans: ["Bahnschrift", "Segoe UI Variable", "Segoe UI", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
