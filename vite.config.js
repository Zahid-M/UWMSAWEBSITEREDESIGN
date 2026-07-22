import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base must match your repo name for GitHub Pages project sites:
// https://YOUR_USERNAME.github.io/msa-uw/  ->  base: "/UWMSAWEBSITEREDESIGN/"
export default defineConfig({
  plugins: [react()],
  base: "/UWMSAWEBSITEREDESIGN/",
});
