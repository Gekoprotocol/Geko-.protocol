import { WalletData } from "../types";

const USERS_KEY = 'geko_users_db_v1';
const SESSION_KEY = 'geko_active_session_v1';

// Cross-tab sync channel - SAFE WRAPPER
let syncChannel: any = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    syncChannel = new BroadcastChannel('geko_protocol_sync');
  }
} catch (e) {
  console.warn("[Sync] BroadcastChannel unavailable:", e);
}

export interface UserRecord {
    walletData: WalletData;
    lastActive: number;
}

export const authService = {
  saveSession: (walletData: WalletData) => {
    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(walletData));
    } catch (e) { console.warn("[Storage] localStorage failed", e); }
    
    if (syncChannel) syncChannel.postMessage({ type: 'SESSION_UPDATE', walletData });
    window.dispatchEvent(new CustomEvent('geko-session-local-update', { detail: walletData }));
  },

  getSession: (): WalletData | null => {
    try {
      const data = localStorage.getItem(SESSION_KEY);
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  },

  getAllUsers: (): Record<string, UserRecord> => {
    try {
      const data = localStorage.getItem(USERS_KEY);
      return data ? JSON.parse(data) : {};
    } catch { return {}; }
  },

  login: async (email: string, password: string): Promise<WalletData> => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    let result;
    const text = await response.text();
    try {
      result = JSON.parse(text);
    } catch (e) {
      console.error('Server response was not JSON:', text);
      throw new Error(`Malformed server response (Status ${response.status}).`);
    }
    
    if (!response.ok) throw new Error(result.error || "Authentication failed");
    
    const walletData = { 
      ...result.user.wallet_data, 
      email: result.user.email,
      address: result.user.address,
      id: result.user.id,
      status: result.user.status,
      role: result.user.role,
      pending_deposit_currency: result.user.pending_deposit_currency,
      pending_deposit_amount: result.user.pending_deposit_amount
    };
    
    authService.saveSession(walletData);
    return walletData;
  },

  signup: async (email: string, password: string, invitationCode: string): Promise<any> => {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, invitationCode })
    });
    
    let result;
    const text = await response.text();
    try {
      result = JSON.parse(text);
    } catch (e) {
      console.error('Server response was not JSON:', text);
      throw new Error(`Malformed server response (Status ${response.status}).`);
    }
    
    if (!response.ok) throw new Error(result.error || "Signup failed");
    return result;
  },

  updateUser: async (key: string, walletData: WalletData): Promise<boolean> => {
      const users = authService.getAllUsers();
      if (users[key]) {
          users[key].walletData = walletData;
          users[key].lastActive = Date.now();
          try {
              localStorage.setItem(USERS_KEY, JSON.stringify(users));
          } catch (e) {}
          if (syncChannel) syncChannel.postMessage({ type: 'USER_REGISTRY_UPDATE' });
          window.dispatchEvent(new Event('geko-user-update'));
          return true;
      }
      return false;
  },

  logout: async (email?: string) => {
      if (email) {
          try {
              await fetch('/api/auth/logout-and-forget', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email })
              });
          } catch (e) {
              console.error('Logout sync failed', e);
          }
      }
      try {
          localStorage.removeItem(SESSION_KEY);
      } catch (e) {}
      if (syncChannel) syncChannel.postMessage({ type: 'LOGOUT_EVENT' });
      window.dispatchEvent(new CustomEvent('geko-session-local-update', { detail: null }));
  },

  observeSession: (callback: (wallet: WalletData | null) => void) => {
    const check = () => callback(authService.getSession());
    
    const listener = (e: any) => {
        if (e instanceof MessageEvent) {
          if (e.data.type === 'SESSION_UPDATE' || e.data.type === 'LOGOUT_EVENT') check();
        } else if (e.type === 'geko-session-local-update') {
          callback(e.detail);
        }
    };
    
    if (syncChannel) syncChannel.addEventListener('message', listener);
    window.addEventListener('geko-session-local-update', listener);
    
    check();
    
    return () => {
      if (syncChannel) syncChannel.removeEventListener('message', listener);
      window.removeEventListener('geko-session-local-update', listener);
    };
  }
};
