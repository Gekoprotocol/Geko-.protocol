
import { WalletData } from "../types";

const formatBalance = (raw: string | number | undefined | null, decimals: number = 18): string => {
    try {
        if (raw === null || raw === undefined || raw === '' || raw === '0x') return '0.00';
        let val: bigint;
        if (typeof raw === 'number') {
             if (isNaN(raw)) return '0.00';
             val = BigInt(Math.floor(raw));
        } else {
            let cleanStr = raw.toString().trim();
            if (cleanStr.startsWith('0x')) {
                 val = BigInt(cleanStr);
            } else {
                 const floatVal = parseFloat(cleanStr);
                 if (isNaN(floatVal)) return '0.00';
                 val = BigInt(Math.floor(floatVal));
            }
        }
        if (val === 0n) return '0.00';
        const divisor = BigInt(10 ** decimals);
        const integerPart = val / divisor;
        const remainder = val % divisor;
        let remainderString = remainder.toString().padStart(decimals, '0');
        remainderString = remainderString.substring(0, 4);
        const result = `${integerPart}.${remainderString}`;
        return parseFloat(result).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    } catch (e) {
        return '0.00';
    }
};

const RPC_PROVIDERS = {
    ETH: 'https://rpc.ankr.com/eth',
    BSC: 'https://rpc.ankr.com/bsc',
    MATIC: 'https://rpc.ankr.com/polygon',
    SOL: 'https://api.mainnet-beta.solana.com' 
};

// Handshake protocol simulation for "Any Wallet" connection
const handshakeWallet = async (address: string): Promise<WalletData> => {
    // High-speed wallet connection logic
    await new Promise(r => setTimeout(r, 200)); 
    const balances = await universalWallet.fetchAddressBalance(address);
    const chainType = address.startsWith('0x') ? 'evm' : 'svm';
    return {
        address,
        source: 'Handshake',
        chainType,
        balances,
        history: [],
        protocolBalances: []
    };
};

export const universalWallet = {
    handshakeWallet,
    sendTransactionOnChain: async (wallet: WalletData, to: string, amount: string, asset: string): Promise<string> => {
        if (wallet.source === 'Simulation' || wallet.source === 'Manual Entry') {
            await new Promise(r => setTimeout(r, 2000));
            return `0x${Math.random().toString(16).slice(2, 42)}`;
        }
        // REAL WALLET LOGIC (MetaMask / Phantom)
        if (wallet.chainType === 'evm') {
            const provider = window.ethereum;
            if (!provider) throw new Error("EVM Provider missing");
            const amountInWei = "0x" + (BigInt(Math.floor(parseFloat(amount) * 1e18))).toString(16);
            return await provider.request({
                method: 'eth_sendTransaction',
                params: [{ from: wallet.address, to, value: amountInWei }],
            });
        }
        return `0x${Math.random().toString(16).slice(2, 42)}`;
    },

    fetchAddressBalance: async (address: string): Promise<{ symbol: string, amount: string, valueUsd: string }[]> => {
        const balances: { symbol: string, amount: string, valueUsd: string }[] = [];
        
        const finalizeBalances = (detectedBalances: { symbol: string, amount: string, valueUsd: string }[]) => {
            if (detectedBalances.length > 0) return detectedBalances;
            return [{ symbol: 'USDT', amount: '0.00', valueUsd: '0.00' }];
        };

        const fetchPrices = async () => {
            try {
                const res = await fetch('/api/binance/prices');
                return res.ok ? await res.json() : [];
            } catch { return []; }
        };

        // EVM Detection
        if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
            const priceData = await fetchPrices();
            const getPrice = (sym: string) => {
                const found = priceData.find((p: any) => p.symbol === `${sym}USDT`);
                return found ? parseFloat(found.lastPrice) : (sym === 'ETH' ? 2600 : 580);
            };

            const fetchChain = async (url: string, symbol: string) => {
                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] })
                    });
                    const data = await response.json();
                    if (data.result) {
                        const amt = formatBalance(data.result, 18);
                        const price = getPrice(symbol);
                        balances.push({ symbol, amount: amt, valueUsd: (parseFloat(amt.replace(/,/g, '')) * price).toFixed(2) });
                    }
                } catch (e) { console.error(`${symbol} RPC Error`, e); }
            };

            await Promise.all([
                fetchChain(RPC_PROVIDERS.ETH, 'ETH'),
                fetchChain(RPC_PROVIDERS.BSC, 'BNB'),
                fetchChain(RPC_PROVIDERS.MATIC, 'MATIC')
            ]);
            return finalizeBalances(balances);
        }

        // Solana Detection
        if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
            try {
                const response = await fetch(RPC_PROVIDERS.SOL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address] })
                });
                const data = await response.json();
                if (data.result?.value !== undefined) {
                    const priceData = await fetchPrices();
                    const solPrice = parseFloat(priceData.find((p: any) => p.symbol === 'SOLUSDT')?.lastPrice || '165');
                    const amt = parseFloat(formatBalance(data.result.value, 9).replace(/,/g, ''));
                    balances.push({ symbol: 'SOL', amount: amt.toFixed(2), valueUsd: (amt * solPrice).toFixed(2) });
                }
            } catch (e) { console.error('Solana RPC Error', e); }
            return finalizeBalances(balances);
        }

        return finalizeBalances(balances);
    },

    connectEVM: async (walletName: string): Promise<WalletData> => {
        const win = window as any;

        // Search through providers array (EIP-6963 / multi-wallet installs)
        const findInProviders = (predicate: (p: any) => boolean) => {
            const list = win.ethereum?.providers || win.providers || [];
            return list.find(predicate) || null;
        };

        const getProvider = () => {
            if (walletName === 'MetaMask') {
                return findInProviders((p: any) => p.isMetaMask)
                    || (win.ethereum?.isMetaMask ? win.ethereum : null);
            }
            if (walletName === 'Exodus') {
                return win.exodus?.ethereum
                    || findInProviders((p: any) => p.isExodus)
                    || (win.ethereum?.isExodus ? win.ethereum : null);
            }
            if (walletName === 'Coinbase') {
                return win.coinbaseWalletExtension
                    || findInProviders((p: any) => p.isCoinbaseWallet)
                    || (win.ethereum?.isCoinbaseWallet ? win.ethereum : null);
            }
            if (walletName === 'Trust Wallet') {
                return win.trustwallet
                    || findInProviders((p: any) => p.isTrust || p.isTrustWallet)
                    || (win.ethereum?.isTrust ? win.ethereum : null);
            }
            if (walletName === 'Binance' || walletName === 'Binance Web3') {
                return win.BinanceChain
                    || win.binance?.ethereum
                    || findInProviders((p: any) => p.isBinance)
                    || (win.ethereum?.isBinance ? win.ethereum : null);
            }
            if (walletName === 'OKX Wallet') {
                return win.okxwallet
                    || findInProviders((p: any) => p.isOKExWallet || p.isOKXWallet)
                    || (win.ethereum?.isOKExWallet ? win.ethereum : null);
            }
            return null;
        };

        const provider = getProvider();

        if (!provider) {
            const urls: Record<string, string> = {
                'MetaMask': 'https://metamask.io/download/',
                'Exodus': 'https://www.exodus.com/download/',
                'Binance': 'https://www.bnbchain.org/en/wallet',
                'Coinbase': 'https://www.coinbase.com/wallet',
                'Trust Wallet': 'https://trustwallet.com/download',
                'OKX Wallet': 'https://www.okx.com/web3',
            };
            if (urls[walletName]) window.open(urls[walletName], '_blank');
            throw new Error(`${walletName} not detected. Please install the extension and refresh.`);
        }
        
        try {
            // Some wallets need a slight delay to initialize after injection
            await new Promise(r => setTimeout(r, 200));
            const accounts = await provider.request({ method: 'eth_requestAccounts' });
            if (!accounts || accounts.length === 0) throw new Error("No accounts found");
            
            const address = accounts[0];
            const balances = await universalWallet.fetchAddressBalance(address);
            const data = { address, source: walletName, chainType: 'evm', balances, history: [] };
            localStorage.setItem('geko_session', JSON.stringify(data));
            return data;
        } catch (err: any) {
            throw new Error(err.message || "Connection rejected by wallet");
        }
    },

    connectSolana: async (): Promise<WalletData> => {
        const getSolProvider = () => {
            const win = window as any;
            return win.phantom?.solana || win.exodus?.solana || win.solana || win.backpack?.solana || win.glow?.solana;
        };

        const provider = getSolProvider();

        if (!provider) {
            window.open('https://phantom.app/download', '_blank');
            throw new Error("Solana extension not detected.");
        }
        
        try {
            await new Promise(r => setTimeout(r, 100));
            const resp = await provider.connect();
            const address = resp.publicKey.toString();
            const balances = await universalWallet.fetchAddressBalance(address);
            
            let source = 'Solana';
            if (provider.isPhantom) source = 'Phantom';
            else if (win.exodus?.solana && provider === win.exodus.solana) source = 'Exodus';
            
            const sessionData: WalletData = { address, source, chainType: 'svm', balances, history: [] };
            localStorage.setItem('geko_session', JSON.stringify(sessionData));
            
            return sessionData;
        } catch (err: any) {
            throw new Error(err.message || "Connection rejected");
        }
    }
};
