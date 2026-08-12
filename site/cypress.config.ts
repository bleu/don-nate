import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5173",
    // No support file needed yet — specs are read-only against the live testnet contract
    // and don't need a connected wallet (see register.cy.ts's note on scope).
    supportFile: false,
    viewportWidth: 1280,
    viewportHeight: 900,
    // Browse's spec waits on a handful of real Soroban RPC calls against testnet — give
    // it more room than Cypress's default 4s.
    defaultCommandTimeout: 15000,
  },
});
