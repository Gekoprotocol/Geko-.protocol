
import { WalletData, InjectedWindowProvider, InjectedExtension, InjectedAccount } from "../types";

// Helper to convert string to hex for signing
const stringToHex = (str: string): string => {
  let hex = '0x';
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
};

export const polkadotService = {
  // Check if any Substrate wallets are injected
  getInjectedExtensions: (): InjectedWindowProvider | null => {
    const injectedWeb3 = (window as any).injectedWeb3 as InjectedWindowProvider;
    return injectedWeb3 || null;
  },

  // Connect to a specific extension (e.g., 'talisman', 'polkadot-js')
  connect: async (source: string): Promise<WalletData> => {
    const injectedWeb3 = (window as any).injectedWeb3 as InjectedWindowProvider;
    
    if (!injectedWeb3 || !injectedWeb3[source]) {
      throw new Error(`${source} extension not found.`);
    }

    // Trigger the extension popup to ask for permission
    const extension: InjectedExtension = await injectedWeb3[source].enable('Geko Protocol');
    
    // Get accounts
    const accounts = await extension.accounts.get();
    
    if (accounts.length === 0) {
      throw new Error("No accounts found in the wallet.");
    }

    const primaryAccount = accounts[0];

    // Map to App's WalletData format
    return {
      address: primaryAccount.address,
      source: source,
      isDelegated: false,
      balances: [
        { symbol: 'DOT', amount: '1,240.5', valueUsd: '8,931.60' },
        { symbol: 'KSM', amount: '15.0', valueUsd: '675.00' },
        { symbol: 'USDT', amount: '5,000.0', valueUsd: '5,000.00' }
      ],
      history: []
    };
  },

  // Sign a message using the extension's signer
  signMessage: async (address: string, source: string, message: string): Promise<string> => {
    const injectedWeb3 = (window as any).injectedWeb3 as InjectedWindowProvider;
    
    if (!injectedWeb3 || !injectedWeb3[source]) {
      throw new Error("Wallet source not found.");
    }

    // We must re-enable to get the signer object
    const extension = await injectedWeb3[source].enable('Geko Protocol');
    const signer = extension.signer;

    if (signer && signer.signRaw) {
      const { signature } = await signer.signRaw({
        address,
        data: stringToHex(message),
        type: 'bytes'
      });
      return signature;
    } else {
      throw new Error("Signer not available on this extension.");
    }
  }
};
