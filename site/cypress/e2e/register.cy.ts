// Scope: only what's testable without a real or mocked wallet extension. Submitting a report
// needs a signed transaction from a connected wallet (Freighter/xBull) — that's a genuine
// signing flow, not something worth faking with a stubbed private key here. If wallet-mocking
// becomes worth the complexity later, extend this file rather than replacing it.

describe("Register", () => {
  beforeEach(() => cy.visit("/register"));

  it("explains the verifier step and gates the form behind a wallet connection", () => {
    cy.contains("h2", "Submit a verification report").should("be.visible");
    cy.contains("Permissionless, by design").should("be.visible");

    // No form fields render until a wallet is connected — nothing here should let someone
    // fill out a report and only discover they can't sign it at the very end.
    cy.get("#institution").should("not.exist");
    cy.contains("button", "Connect wallet").should("be.visible");
  });

  it("opens the wallet-selection modal on connect", () => {
    cy.contains("button", "Connect wallet").click();
    cy.contains("Connect Wallet").should("be.visible");
    cy.contains("Freighter").should("be.visible");
  });
});
