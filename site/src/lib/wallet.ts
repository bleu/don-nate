import { StellarWalletsKit, Networks } from "@creit.tech/stellar-wallets-kit";
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";

StellarWalletsKit.init({
  network: Networks.TESTNET,
  modules: [new FreighterModule(), new xBullModule()],
});

export async function connectWallet(): Promise<string> {
  const { address } = await StellarWalletsKit.authModal();
  return address;
}

export async function getConnectedAddress(): Promise<string | null> {
  try {
    const { address } = await StellarWalletsKit.getAddress();
    return address || null;
  } catch {
    return null;
  }
}

export async function disconnectWallet(): Promise<void> {
  await StellarWalletsKit.disconnect();
}

export async function signTransaction(
  xdr: string,
  opts: { networkPassphrase: string; address: string },
): Promise<{ signedTxXdr: string }> {
  return StellarWalletsKit.signTransaction(xdr, opts);
}
