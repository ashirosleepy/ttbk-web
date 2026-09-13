import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [{
    name: "extract-expense-inline-script",
    transformIndexHtml(html, context) {
      if (!context.filename.endsWith("Chi tiêu TTBK.html")) return html;
      return html.replace(/\s*<script>([\s\S]*?)<\/script>/, "");
    },
  }],
  build: {
    rollupOptions: {
      input: {
        app: "index.html",
        login: "login.html",
        expenses: "Chi tiêu TTBK.html",
        demo: "demo.html",
      },
    },
  },
});