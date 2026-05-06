import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // This is the "Magic Switch"
  // It tells TanStack to create a static index.html file during the build
  tanstackStart: {
    prerender: {
      enabled: true,
      routes: ['/'], // Tell it to specifically make the home page
    },
  },
});
