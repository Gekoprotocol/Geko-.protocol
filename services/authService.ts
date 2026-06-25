
import { WalletData } from "../types";

const USERS_KEY = 'geko_users_db_v1';
const SESSION_KEY = 'geko_active_session_v1';

// Cross-tab sync channel to simulate real-time backend push
const syncChannel = new BroadcastChannel('geko_protocol_sync');

export interface UserRecord {
    walletData: WalletData;
    lastActive: number;
}

export const authService = {
  saveSession: async (walletData: WalletData) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(walletData));
    syncChannel.postMessage({ type: 'SESSION_UPDATE', walletData });
    window.dispatchEvent(new CustomEvent('geko-session-local-update', { detail: walletData }));
  },

  getSession: (): WalletData | null => {
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  },

  getAllUsers: (): Record<string, UserRecord> => {
      const data = localStorage.getItem(USERS_KEY);
      return data ? JSON.parse(data) : {};
  },

  login: async (email: string, password: string): Promise<WalletData> => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    let result;
    try {
      const text = await response.text();
      result = text ? JSON.parse(text) : { success: false, error: 'Empty response from server' };
    } catch (e) {
      result = { success: false, error: 'Malformed server response' };
    }
    if (!response.ok) throw new Error(result.error || "Authentication failed");
    
    const walletData = { 
      ...result.user.wallet_data, 
      email: result.user.email,
      address: result.user.address,
      id: result.user.id,
      status: result.user.status,
      pending_deposit_currency: result.user.pending_deposit_currency,
      pending_deposit_amount: result.user.pending_deposit_amount
    };
    await authService.saveSession(walletData);
    return walletData;
  },

  signup: async (email: string, password: string, invitationCode: string): Promise<any> => {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, invitationCode })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Signup failed");
    return result;
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
