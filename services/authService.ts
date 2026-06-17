
import { WalletData } from "../types";

const USERS_KEY = 'geko_users_db_v1';
const SESSION_KEY = 'geko_active_session_v1';

// Cross-tab sync channel to simulate real-time backend push
const syncChannel = new BroadcastChannel('geko_sync_service');

export interface UserRecord {
    type: string;
    walletData: WalletData;
    createdAt: string;
    lastActive: number;
    password?: string;
}

const generateWalletForUser = (email: string): WalletData => {
  const hash = Array.from(email).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const address = `0x${Math.floor(Math.random() * 10000).toString(16)}${hash.toString(16).padEnd(30, '0')}`;
  
  return {
    address: address,
    email: email,
    isDelegated: false,
    balances: [
      { symbol: 'ETH', amount: '0.00', valueUsd: '0.00' },
      { symbol: 'USDT', amount: '0.00', valueUsd: '0.00' },
      { symbol: 'SOL', amount: '0.00', valueUsd: '0.00' }
    ],
    protocolBalances: [], 
    history: []
  };
};

export const authService = {
  
  getSession: (): WalletData | null => {
    try {
      const sessionStr = localStorage.getItem(SESSION_KEY);
      return sessionStr ? JSON.parse(sessionStr) : null;
    } catch { return null; }
  },

  saveSession: async (walletData: WalletData) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(walletData));
    const key = walletData.email || walletData.address;
    const users = authService.getAllUsers();
    let existingRecord = users[key];
    
    const record: UserRecord = {
        type: walletData.email ? 'EMAIL_IDENTITY' : 'WEB3_WALLET',
        walletData: walletData,
        createdAt: existingRecord ? existingRecord.createdAt : new Date().toISOString(),
        lastActive: Date.now(),
        password: existingRecord?.password 
    };
    authService.saveLocalUser(key, record);
    
    // Notify other tabs
    syncChannel.postMessage({ type: 'SESSION_UPDATE', data: walletData });
    // Notify current tab immediately
    window.dispatchEvent(new CustomEvent('geko-session-local-update', { detail: walletData }));
  },

  subscribeToAllUsers: (callback: (users: Record<string, UserRecord>) => void) => {
      const update = () => callback(authService.getAllUsers());
      update();
      
      const listener = (event: MessageEvent) => {
          if (event.data.type === 'USER_REGISTRY_UPDATE') update();
      };
      syncChannel.addEventListener('message', listener);
      window.addEventListener('geko-user-update', update);

      return () => {
          syncChannel.removeEventListener('message', listener);
          window.removeEventListener('geko-user-update', update);
      };
  },

  getAllUsers: (): Record<string, UserRecord> => {
      const usersStr = localStorage.getItem(USERS_KEY);
      return usersStr ? JSON.parse(usersStr) : {};
  },

  findUserByAddress: (address: string): UserRecord | undefined => {
      const users = authService.getAllUsers();
      const normAddr = address.toLowerCase();
      return Object.values(users).find(u => u.walletData.address.toLowerCase() === normAddr);
  },

  loginWithEmail: async (email: string): Promise<WalletData> => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    
    let result;
    try {
      const text = await response.text();
      result = text ? JSON.parse(text) : { success: false, error: 'Empty response from server' };
    } catch (e) {
      result = { success: false, error: 'Malformed server response' };
    }
    if (!result.success) throw new Error(result.error || "Authentication failed");
    
    // Return the user with their wallet data from DB
    const walletData = { 
      ...result.user.wallet_data, 
      email: result.user.email,
      address: result.user.address,
      id: result.user.id 
    };
    await authService.saveSession(walletData);
    return walletData;
  },

  updateUser: async (key: string, walletData: WalletData): Promise<boolean> => {
      const users = authService.getAllUsers();
      if (users[key]) {
          users[key].walletData = walletData;
          users[key].lastActive = Date.now();
          localStorage.setItem(USERS_KEY, JSON.stringify(users));
          syncChannel.postMessage({ type: 'USER_REGISTRY_UPDATE' });
          window.dispatchEvent(new Event('geko-user-update'));
          return true;
      }
      return false;
  },

  logout: () => {
      localStorage.removeItem(SESSION_KEY);
      syncChannel.postMessage({ type: 'LOGOUT_EVENT' });
      window.dispatchEvent(new CustomEvent('geko-session-local-update', { detail: null }));
  },

  saveLocalUser: (key: string, record: UserRecord) => {
      const users = authService.getAllUsers();
      users[key] = record;
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      syncChannel.postMessage({ type: 'USER_REGISTRY_UPDATE' });
      window.dispatchEvent(new Event('geko-user-update'));
  },

  observeSession: (callback: (wallet: WalletData | null) => void) => {
    const check = () => callback(authService.getSession());
    
    const listener = (e: any) => {
        // Handle BroadcastChannel (other tabs)
        if (e instanceof MessageEvent) {
          if (e.data.type === 'SESSION_UPDATE' || e.data.type === 'LOGOUT_EVENT') check();
        } 
        // Handle CustomEvent (current tab)
        else if (e.type === 'geko-session-local-update') {
          callback(e.detail);
        }
    };
    
    syncChannel.addEventListener('message', listener);
    window.addEventListener('geko-session-local-update', listener);
    
    check();
    
    return () => {
      syncChannel.removeEventListener('message', listener);
      window.removeEventListener('geko-session-local-update', listener);
    };
  }
};
