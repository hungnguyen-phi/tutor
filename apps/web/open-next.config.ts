import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Incremental cache / queue can be wired to R2/KV at M4 (RSC/ISR).
export default defineCloudflareConfig({});
