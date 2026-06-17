
export interface MarketData {
  time: number; // Unix timestamp for Lightweight Charts
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AssetInfo {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: string;
  volume24h: string;
}

export interface AnalysisResult {
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  score: number;
  summary: string;
  recommendations: string[];
}

export interface ActiveTrade {
  id: string;
  symbol: string;
  userName?: string; 
  direction: 'up' | 'down';
  amount: string;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  startTime: number;
  duration: number; 
  status: 'pending' | 'won' | 'lost';
  forceOutcome?: 'win' | 'loss';
  isBot?: boolean;
  isAI?: boolean;
  settledAt?: number;
  pnl?: number;         // positive = profit, negative = loss
  payoutRate?: number;  // e.g. 0.85
}

export interface LiveTx {
  id: string;
  userName: string;
  symbol: string;
  type: 'buy' | 'sell';
  price: number;
  amountUsd: number;
  amountToken: number;
  timestamp: number;
  isSimulated?: boolean;
}

export interface Transaction {
  id: string;
  type: 'Send' | 'Receive' | 'Swap' | 'Contract' | 'Trade';
  asset: string;
  amount: string;
  status: 'Completed' | 'Pending' | 'Failed' | 'Win' | 'Loss';
  timestamp: string;
  hash: string;
  destinationAddress?: string; // New field for withdrawals
}

export interface WalletData {
  address: string;
  source?: string;
  chainType?: 'evm' | 'svm' | 'substrate'; 
  email?: string;
  isDelegated?: boolean;
  trading_balance?: number;
  available_balance?: number;
  balances: {
    symbol: string;
    amount: string;
    valueUsd: string;
  }[];
  protocolBalances?: {
    symbol: string;
    amount: string;
    valueUsd: string;
  }[];
  history: Transaction[];
}

export interface ExchangeOffer {
  id: string;
  provider: string;
  rate: number;
  eta: string;
  rating: number;
  type: 'Best rate' | 'Fastest' | 'Best choice' | 'Standard';
  logo: string;
}

export interface InjectedAccount {
  address: string;
  genesisHash?: string | null;
  name?: string;
  type?: string;
}

export interface InjectedExtension {
  name: string;
  version: string;
  accounts: {
    get: (anyType?: boolean) => Promise<InjectedAccount[]>;
    subscribe: (cb: (accounts: InjectedAccount[]) => void) => () => void;
  };
  metadata?: any;
  provider?: any;
  signer: {
    signRaw: (payload: { address: string; data: string; type: 'bytes' | 'payload' }) => Promise<{ id: number; signature: string }>;
  };
}

export type InjectedWindowProvider = Record<string, {
  enable: (origin: string) => Promise<InjectedExtension>;
  version: string;
}>;

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      isTrust?: boolean;
      isBraveWallet?: boolean;
      request: (args: { method: string; params?: any[] }) => Promise<any>;
    };
    solana?: {
      isPhantom?: boolean;
      connect: (args?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } }>;
      signMessage: (message: Uint8Array, encoding: string) => Promise<{ signature: Uint8Array }>;
    };
    injectedWeb3?: InjectedWindowProvider;
  }
}
