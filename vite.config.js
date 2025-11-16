import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "html-transform",
      apply: "build",
      transformIndexHtml(html) {
        // making it possible to serve the app on sub-path + disable caching
        return html
          .replace(/"\//g, `"`)
          .replace(/(\.(js|css))(?=")/g, `$1?${Date.now()}`);
      },
    },
  ],
});
