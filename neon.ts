import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true,
  functions: {
    // Participant directory API: finds a participant by id or name for a signed-in user.
    participants: {
      name: "participant api",
      source: "participant-api/src/index.ts",
      env: {
        // Comma-separated origins allowed to call the API from a browser, e.g. chrome-extension://<id>.
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? "",
        // This Function's own https origin: the trusted origin it presents to Neon Auth when signing users in.
        AUTH_ORIGIN: process.env.AUTH_ORIGIN ?? "",
      },
    },
  },
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
