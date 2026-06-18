import express from 'express';
import cors from 'cors';
import pg from 'pg';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Connection, PublicKey, LAMPORTS_PER_SOL, Keypair, Transaction, SystemProgram } from '@solana/web3.js';
import { sendAndConfirmTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import crypto from 'crypto';
import NowPaymentsApi from '@nowpaymentsio/nowpayments-api-js';

dotenv.config();

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,x-api-key,x-nowpayments-sig');
  
  // Force correct MIME types for TypeScript and JSX files to fix "blank screen" issues
  const url = req.url.toLowerCase();
  if (url.endsWith('.ts') || url.endsWith('.tsx') || url.endsWith('.jsx')) {
    res.setHeader('Content-Type', 'application/javascript');
  }
  next();
});

app.use('/api/ipn', express.raw({ type: '*/*' }));
app.use('/webhook',  express.raw({ type: '*/*' }));
app.use(express.json());

// ─── NowPayments ──────────────────────────────────────────────────────────────
const NOWPAYMENTS_API_KEY = process.env.NOW_PAYMENTS_API_KEY || process.env.NOWPAYMENTS_API_KEY;
const IPN_SECRET = process.env.NOW_PAYMENTS_IPN_SECRET || process.env.IPN_SECRET;
const npApi = NOWPAYMENTS_API_KEY ? new NowPaymentsApi({ apiKey: NOWPAYMENTS_API_KEY }) : null;

let globalConfig = {
  vault_balance: "0.00",
  deposit_address: "6HmBxJuv9f5P92am6AK18KZGkHGqbNUazYXXKhvrDviw"
};
const { Pool } = pg;
let pool = null;
let dbAvailable = false;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const initializeDatabase = async () => {
    try {
      console.log('[DB] Connecting to database...');
      const client = await pool.connect();
      console.log('[DB] Connection successful');
      client.release();

      await pool.query(`
        CREATE TABLE IF NOT EXISTS geko_users (
          id SERIAL PRIMARY KEY,
          wallet_address TEXT UNIQUE,
          wallet_data JSONB DEFAULT '{}',
          balance_override TEXT,
          trading_balance DECIMAL(24, 8) DEFAULT 10000,
          demo_balance DECIMAL(24, 8) DEFAULT 10000,
          available_balance DECIMAL(24, 8) DEFAULT 0,
          available_demo_balance DECIMAL(24, 8) DEFAULT 10000,
          nickname TEXT,
          force_win BOOLEAN DEFAULT FALSE,
          ip_address TEXT,
          last_seen TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          last_interest_at TIMESTAMPTZ DEFAULT NOW(),
          referral_code TEXT,
          referred_by TEXT,
          kyc_status TEXT DEFAULT 'none'
        )
      `);

      // Ensure new columns exist for existing tables
      await pool.query(`
        ALTER TABLE geko_users ALTER COLUMN trading_balance SET DEFAULT 10000;
        ALTER TABLE geko_users ADD COLUMN IF NOT EXISTS demo_balance DECIMAL(24, 8) DEFAULT 10000;
        ALTER TABLE geko_users ADD COLUMN IF NOT EXISTS available_balance DECIMAL(24, 8) DEFAULT 0;
        ALTER TABLE geko_users ADD COLUMN IF NOT EXISTS available_demo_balance DECIMAL(24, 8) DEFAULT 10000;
        ALTER TABLE geko_users ADD COLUMN IF NOT EXISTS nickname TEXT;
        ALTER TABLE geko_users ADD COLUMN IF NOT EXISTS force_win BOOLEAN DEFAULT FALSE;
        ALTER TABLE geko_users ADD COLUMN IF NOT EXISTS last_interest_at TIMESTAMPTZ DEFAULT NOW();
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS trades (
          id TEXT PRIMARY KEY,
          wallet_address TEXT NOT NULL,
          symbol TEXT NOT NULL,
          direction TEXT NOT NULL,
          amount DECIMAL(24, 8) NOT NULL,
          entry_price DECIMAL(24, 8) NOT NULL,
          duration INTEGER NOT NULL,
          status TEXT DEFAULT 'pending',
          force_outcome TEXT,
          is_demo BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          settled_at TIMESTAMPTZ
        )
      `);

      await pool.query(`CREATE INDEX IF NOT EXISTS idx_trades_wallet ON trades (wallet_address, status)`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS geko_visitors (
          id SERIAL PRIMARY KEY,
          visitor_id TEXT,
          ip_address TEXT,
          user_agent TEXT,
          language TEXT,
          timezone TEXT,
          screen_size TEXT,
          platform TEXT,
          referrer TEXT,
          page_path TEXT,
          wallet_extensions JSONB DEFAULT '[]',
          visit_count INTEGER DEFAULT 1,
          first_seen TIMESTAMPTZ DEFAULT NOW(),
          last_seen TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS transactions (
          id          SERIAL PRIMARY KEY,
          wallet_address TEXT NOT NULL,
          asset_symbol   TEXT NOT NULL,
          amount         DECIMAL(24, 8) NOT NULL,
          type           TEXT NOT NULL,
          status         TEXT NOT NULL DEFAULT 'completed',
          payment_id     TEXT,
          tx_signature   TEXT,
          reference      TEXT,
          created_at     TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      await pool.query(`CREATE INDEX IF NOT EXISTS idx_txn_wallet ON transactions (wallet_address, asset_symbol)`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS withdrawal_requests (
          id               SERIAL PRIMARY KEY,
          wallet_address   TEXT NOT NULL,
          destination_address TEXT NOT NULL,
          amount           DECIMAL(24, 8) NOT NULL,
          asset            TEXT NOT NULL DEFAULT 'SOL',
          status           TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','approved','rejected','failed')),
          tx_signature     TEXT,
          nowpayments_id   TEXT,
          admin_note       TEXT,
          created_at       TIMESTAMPTZ DEFAULT NOW(),
          processed_at     TIMESTAMPTZ
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS kyc_submissions (
          id SERIAL PRIMARY KEY,
          wallet_address TEXT NOT NULL,
          full_name TEXT,
          date_of_birth TEXT,
          country TEXT,
          id_type TEXT,
          id_number TEXT,
          status TEXT DEFAULT 'pending',
          admin_note TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS support_tickets (
          id SERIAL PRIMARY KEY,
          wallet_address TEXT NOT NULL,
          subject TEXT NOT NULL,
          messages JSONB DEFAULT '[]',
          status TEXT DEFAULT 'open',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      dbAvailable = true;
      console.log('[DB] Database ready and all tables verified.');
      startSolanaListener();
      
      // Start 2% daily interest processor
      setInterval(processDailyInterest, 60 * 60 * 1000); // Check every hour
      processDailyInterest(); // Run once on startup
    } catch (err) {
      console.error('[DB Error] Failed to initialize database. Check your DATABASE_URL environment variable.');
      console.error('[DB Error] Details:', err.stack);
      dbAvailable = false;
    }
  };

  initializeDatabase();
} else { //
  console.warn('DATABASE_URL is not set in .env. Database features will be unavailable.');
}

// ─── Balance helper — sum of all completed transactions ────────────────────
async function getUserBalance(walletAddress, assetSymbol) {
  if (!dbAvailable || !pool) return 0;
  const res = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS balance
       FROM transactions
      WHERE wallet_address = $1 AND asset_symbol = $2 AND status = 'completed' AND type != 'trade'`,
    [walletAddress, assetSymbol]
  );
  return parseFloat(res.rows[0]?.balance ?? 0);
}

// ─── Daily 2% Interest Processor ──────────────────────────────────────────
async function processDailyInterest() {
  if (!dbAvailable || !pool) return;
  try {
    console.log('[Interest] Checking for eligible users for 2% daily increase...');
    // Find users who haven't received interest in last 24 hours
    const res = await pool.query(
      `SELECT wallet_address, last_interest_at 
       FROM geko_users 
       WHERE last_interest_at <= NOW() - INTERVAL '24 hours'`
    );

    for (const user of res.rows) {
      const vaultBal = await getUserBalance(user.wallet_address, 'USDT');
      if (vaultBal > 0) {
        const interestAmt = vaultBal * 0.02;
        await recordTransaction({
          wallet_address: user.wallet_address,
          asset_symbol:   'USDT',
          amount:         interestAmt,
          type:           'interest',
          reference:      '2%_daily_vault_increase'
        });
        await pool.query(
          'UPDATE geko_users SET last_interest_at = NOW() WHERE wallet_address = $1',
          [user.wallet_address]
        );
        console.log(`[Interest] Credited ${interestAmt.toFixed(4)} USDT to ${user.wallet_address}`);
      } else {
        // Even if balance is 0, update last_interest_at to avoid re-checking every hour
        await pool.query(
          'UPDATE geko_users SET last_interest_at = NOW() WHERE wallet_address = $1',
          [user.wallet_address]
        );
      }
    }
  } catch (err) {
    console.error('[Interest Error] Failed to process daily interest:', err.message);
  }
}

// ─── Transaction insert helper ─────────────────────────────────────────────
async function recordTransaction({ wallet_address, asset_symbol, amount, type, payment_id = null, tx_signature = null, reference = null, status = 'completed' }) {
  if (!dbAvailable || !pool) return null;
  const res = await pool.query(
    `INSERT INTO transactions (wallet_address, asset_symbol, amount, type, payment_id, tx_signature, reference, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [wallet_address, asset_symbol, amount, type, payment_id, tx_signature, reference, status]
  );

  // Sync with geko_users table for trading/available balances if asset is USDT
  if (status === 'completed' && asset_symbol === 'USDT') {
    const amt = parseFloat(amount || 0);
    // types: trade, credit, interest, withdrawal, deposit (if asset is USDT)
    // we want all USDT movements to reflect in trading_balance
    await pool.query(
      `UPDATE geko_users 
       SET trading_balance = trading_balance + $1,
           available_balance = available_balance + $1
       WHERE wallet_address = $2`,
      [amt, wallet_address]
    );
  }

  return res.rows[0];
}

// All middleware moved to the top.
// ─── PWA Manifest ───────────────────────────────────────────────────────────
app.get('/manifest.json', (req, res) => {
  res.json({
    "short_name": "Geko",
    "name": "Geko Institutional Terminal",
    "icons": [
      {
        "src": "favicon.ico",
        "sizes": "64x64 32x32 24x24 16x16",
        "type": "image/x-icon"
      },
      {
        "src": "logo192.png",
        "type": "image/png",
        "sizes": "192x192"
      },
      {
        "src": "logo512.png",
        "type": "image/png",
        "sizes": "512x512"
      }
    ],
    "start_url": ".",
    "display": "standalone",
    "theme_color": "#0B0E11",
    "background_color": "#0B0E11"
  });
});

// ─── Config endpoints ──────────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  res.json(globalConfig);
});

app.post('/api/admin/config', (req, res) => {
    const { vault_balance, deposit_address } = req.body;

    // Add the assignment operator (=) to update the object
    if (vault_balance !== undefined) globalConfig.vault_balance = vault_balance;
    if (deposit_address !== undefined) globalConfig.deposit_address = deposit_address;

    res.json({ success: true, config: globalConfig });
});

// ─── Live prices proxy ─────────────────────────────────────────────────────
app.get('/api/binance/prices', async (req, res) => {
  // Source 1: Kraken — extended pair set
  try {
    const krakenPairs = 'XXBTZUSD,XETHZUSD,SOLUSD,XXRPZUSD,ADAUSD,AVAXUSD,XDGUSD,DOTUSD,LINKUSD,XLTCZUSD,TRXUSD,UNIUSD,ATOMUSD,AAVEUSD';
    const krakenRes = await axios.get(`https://api.kraken.com/0/public/Ticker?pair=${krakenPairs}`, {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'GekoProtocol/1.0'
      }
    });
    const krakenData = krakenRes.data;
    if (krakenData.error && krakenData.error.length > 0) throw new Error(krakenData.error[0]);
    const r = krakenData.result;

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

    if (mapped.length === 0) throw new Error('No pairs returned from Kraken');
    console.log(`Prices from Kraken: BTC=${pairs.BTC?.c[0]} ETH=${pairs.ETH?.c[0]} SOL=${pairs.SOL?.c[0]}`);
    return res.json(mapped);
  } catch (err) {
    console.warn('Kraken failed:', err.message);
  }

  // Source 2: CoinPaprika fallback (extended)
  try {
    const paprikaMap = [
      ['btc-bitcoin','BTCUSDT'], ['eth-ethereum','ETHUSDT'], ['sol-solana','SOLUSDT'], 
      ['xrp-xrp','XRPUSDT'], ['ada-cardano','ADAUSDT'], ['avax-avalanche-2','AVAXUSDT'],
      ['doge-dogecoin','DOGEUSDT'], ['dot-polkadot','DOTUSDT'], ['link-chainlink','LINKUSDT'],
      ['ltc-litecoin','LTCUSDT'], ['trx-tron','TRXUSDT'], ['uni-uniswap','UNIUSDT'],
      ['atom-cosmos','ATOMUSDT'], ['bnb-binance-coin','BNBUSDT'], ['shib-shiba-inu','SHIBUSDT']
    ];
    const results = await Promise.allSettled(paprikaMap.map(([id]) => 
      axios.get(`https://api.coinpaprika.com/v1/tickers/${id}`).then(r => r.data)
    ));
    const mapped = results
      .map((r, i) => r.status === 'fulfilled' ? {
        symbol: paprikaMap[i][1],
        lastPrice: String(r.value?.quotes?.USD?.price?.toFixed(6) || 0),
        priceChangePercent: String(r.value?.quotes?.USD?.percent_change_24h?.toFixed(2) || 0)
      } : null)
      .filter(Boolean);
    console.log(`Prices from CoinPaprika: BTC=${mapped[0]?.lastPrice}`);
    return res.json(mapped);
  } catch (err2) {
    console.error('All price sources failed:', err2.message);
    return res.status(500).json({ error: 'Price data unavailable' });
  }
});

// ─── Admin User Management ─────────────────────────────────────────────────
app.get('/api/admin/users', async (req, res) => {
  if (dbAvailable && pool) {
    try {
      const result = await pool.query(`
        SELECT u.*, 
               (SELECT COUNT(*) FROM trades t WHERE t.wallet_address = u.wallet_address AND t.status = 'pending') as active_trades_count
        FROM geko_users u 
        ORDER BY last_seen DESC
      `);
      return res.json(result.rows);
    } catch (e) {
      console.error('DB users error:', e.message);
    }
  }
  res.status(503).json({ error: 'Database unavailable' });
});

app.post('/api/admin/users/update', async (req, res) => {
  const { id, wallet_data, balance_override, trading_balance, demo_balance } = req.body;

  if (dbAvailable && pool) {
    try {
      const updates = [];
      const values = [];
      let idx = 1;
      if (wallet_data !== undefined) { updates.push(`wallet_data = $${idx++}`); values.push(JSON.stringify(wallet_data)); }
      if (balance_override !== undefined) { updates.push(`balance_override = $${idx++}`); values.push(balance_override); }
      if (trading_balance !== undefined) { updates.push(`trading_balance = $${idx++}`); values.push(trading_balance); }
      if (demo_balance !== undefined) { updates.push(`demo_balance = $${idx++}`); values.push(demo_balance); }
      values.push(id);
      if (updates.length > 0) {
        await pool.query(`UPDATE geko_users SET ${updates.join(', ')} WHERE id = $${idx}`, values);
      }
      const result = await pool.query('SELECT * FROM geko_users WHERE id = $1', [id]);
      return res.json({ success: true, user: result.rows[0] });
    } catch (e) {
      console.error('DB update error:', e.message);
    }
  }

  res.status(503).json({ error: 'Database unavailable' });
});

// Register / upsert a user (called on wallet connect)
app.post('/api/users/upsert', async (req, res) => {
  const { wallet_address, wallet_data, ip_address, nickname } = req.body;
  if (!wallet_address) return res.status(400).json({ error: 'wallet_address required' });

  if (dbAvailable && pool) {
    try {
      const updates = [];
      const values = [wallet_address, JSON.stringify(wallet_data || {}), ip_address || null];
      let query = `
        INSERT INTO geko_users (wallet_address, wallet_data, ip_address, last_seen${nickname ? ', nickname' : ''})
        VALUES ($1, $2, $3, NOW()${nickname ? ', $4' : ''})
        ON CONFLICT (wallet_address) DO UPDATE
        SET wallet_data = EXCLUDED.wallet_data,
            ip_address = EXCLUDED.ip_address,
            last_seen = NOW()${nickname ? ', nickname = EXCLUDED.nickname' : ''}
        RETURNING *`;
      
      if (nickname) values.push(nickname);

      const result = await pool.query(query, values);
      return res.json({ success: true, user: result.rows[0] });
    } catch (e) {
      console.error('Upsert error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(503).json({ error: 'Database unavailable' });
});

// Heartbeat — keeps last_seen fresh so admin sees who's online right now
app.post('/api/users/heartbeat', async (req, res) => {
  const { wallet_address } = req.body || {};
  if (!wallet_address) return res.json({ success: false });
  if (dbAvailable && pool) {
    try {
      await pool.query(
        `UPDATE geko_users SET last_seen = NOW() WHERE wallet_address = $1`,
        [wallet_address]
      );
      return res.json({ success: true });
    } catch (e) { console.error('Heartbeat error:', e.message); }
  }
  res.status(503).json({ success: false, error: 'Database unavailable' });
});

// Get a single user's data (for balance sync)
app.get('/api/user/data', async (req, res) => {
  const { address } = req.query;
  if (dbAvailable && pool) {
    try {
      const result = await pool.query(
        'SELECT * FROM geko_users WHERE wallet_address = $1 LIMIT 1',
        [address || null]
      );
      if (result.rows.length > 0) return res.json(result.rows[0]);
    } catch (e) {
      console.error('User fetch error:', e.message);
    }
  }
  res.status(503).json({ error: 'Database unavailable' });
});

// ─── Balance Transfer (Vault <-> Trading) ─────────────────────────────────
app.post('/api/balance/transfer', async (req, res) => {
  const { walletAddress, amount, direction } = req.body; // direction: 'vault_to_trade' or 'trade_to_vault'
  if (!walletAddress || !amount || !direction) return res.status(400).json({ error: 'Missing parameters' });

  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const amt = Math.abs(parseFloat(amount));
    if (direction === 'vault_to_trade') {
      const vaultBal = await getUserBalance(walletAddress, 'USDT');
      if (vaultBal < amt) return res.status(400).json({ error: 'Insufficient vault balance' });

      // Record negative transaction in vault
      await recordTransaction({
        wallet_address: walletAddress,
        asset_symbol:   'USDT',
        amount:         -amt,
        type:           'transfer',
        reference:      'vault_to_trade'
      });

      // Credit trading_balance
      await pool.query(
        'UPDATE geko_users SET trading_balance = trading_balance + $1 WHERE wallet_address = $2',
        [amt, walletAddress]
      );
    } else if (direction === 'trade_to_vault') {
      const userRes = await pool.query('SELECT trading_balance FROM geko_users WHERE wallet_address = $1', [walletAddress]);
      const tradeBal = parseFloat(userRes.rows[0]?.trading_balance || 0);
      if (tradeBal < amt) return res.status(400).json({ error: 'Insufficient trading balance' });

      // Debit trading_balance
      await pool.query(
        'UPDATE geko_users SET trading_balance = trading_balance - $1 WHERE wallet_address = $2',
        [amt, walletAddress]
      );

      // Record positive transaction in vault
      await recordTransaction({
        wallet_address: walletAddress,
        asset_symbol:   'USDT',
        amount:         amt,
        type:           'transfer',
        reference:      'trade_to_vault'
      });
    } else {
      return res.status(400).json({ error: 'Invalid direction' });
    }

    const newUserRes = await pool.query('SELECT * FROM geko_users WHERE wallet_address = $1', [walletAddress]);
    if (newUserRes.rows.length === 0) return res.status(404).json({ error: 'User not found after transfer' });
    
    const vaultBal = await getUserBalance(walletAddress, 'USDT');
    res.json({ success: true, trading_balance: newUserRes.rows[0].trading_balance, vault_balance: vaultBal });
  } catch (e) {
    console.error('Transfer error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Visitor tracking (every page load, even without wallet) ───────────────
app.post('/api/visitors/track', async (req, res) => {
  const ip = (req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '').trim();
  const {
    visitor_id, user_agent, language, timezone,
    screen_size, platform, referrer, page_path, wallet_extensions
  } = req.body || {};

  if (dbAvailable && pool) {
    try {
      const existing = await pool.query('SELECT id, visit_count FROM geko_visitors WHERE visitor_id = $1 LIMIT 1', [visitor_id]);
      if (existing.rows.length) {
        await pool.query(
          `UPDATE geko_visitors SET last_seen = NOW(), visit_count = visit_count + 1,
             ip_address = $2, user_agent = $3, page_path = $4, wallet_extensions = $5
           WHERE visitor_id = $1`,
          [visitor_id, ip, user_agent, page_path, JSON.stringify(wallet_extensions || [])]
        );
      } else {
        await pool.query(
          `INSERT INTO geko_visitors
             (visitor_id, ip_address, user_agent, language, timezone, screen_size, platform, referrer, page_path, wallet_extensions)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [visitor_id, ip, user_agent, language, timezone, screen_size, platform, referrer, page_path, JSON.stringify(wallet_extensions || [])]
        );
      }
      return res.json({ success: true });
    } catch (e) {
      console.error('Visitor track error:', e.message);
    }
  }

  res.status(503).json({ error: 'Database unavailable' });
});

app.get('/api/admin/visitors', async (req, res) => {
  if (dbAvailable && pool) {
    try {
      const result = await pool.query('SELECT * FROM geko_visitors ORDER BY last_seen DESC LIMIT 500');
      return res.json(result.rows);
    } catch (e) { console.error('Visitor fetch error:', e.message); }
  }
  res.status(503).json({ error: 'Database unavailable' });
});

// ─── NowPayments: Create Deposit ──────────────────────────────────────────
app.post('/api/create-deposit', async (req, res) => {
  if (!npApi) {
    return res.status(503).json({ success: false, error: 'Payment gateway not configured.' });
  }

  const { pay_currency, price_amount, price_currency, order_id, order_description } = req.body;

  if (!pay_currency) {
    return res.status(400).json({ success: false, error: 'pay_currency is required.' });
  }

  // NowPayments minimum amounts by currency (USD equivalent)
  const CURRENCY_MINIMUMS = {
    btc: 50, ltc: 15, eth: 50, xmr: 20,
    usdttrc20: 15, usdterc20: 50,
    default: 15
  };
  const minAmount = CURRENCY_MINIMUMS[pay_currency.toLowerCase()] || CURRENCY_MINIMUMS.default;
  const finalAmount = Math.max(parseFloat(price_amount) || 0, minAmount);

  try {
    const payment = await npApi.createPayment({
      price_amount: finalAmount,
      price_currency: price_currency || 'usd',
      pay_currency,
      order_id: order_id || `geko-${Date.now()}`,
      order_description: order_description || 'Geko Protocols deposit',
      ipn_callback_url: process.env.IPN_CALLBACK_URL || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/ipn` : undefined),
    });

    // Normalise field names as SDK versions can return different formats
    const pid = payment.payment_id || payment.id;
    const oid = payment.order_id || payment.orderId;
    const addr = payment.pay_address || payment.payAddress || payment.address;

    if (!addr) {
      console.error('[NowPayments] No deposit address in response:', JSON.stringify(payment));
      return res.status(502).json({ success: false, error: 'Payment gateway did not return a deposit address. Please try a higher amount or a different currency.' });
    }

    console.log(`[NowPayments] Payment created: ${pid} | ${pay_currency} | order: ${oid} | addr: ${addr}`);
    return res.json({ success: true, payment: { ...payment, payment_id: pid, order_id: oid, pay_address: addr } });
  } catch (err) {
    console.error('[NowPayments] create-deposit error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── NowPayments: IPN Webhook ──────────────────────────────────────────────
// Shared handler for NowPayments webhook — mounted at both /api/ipn and /webhook
const handleNowPaymentsWebhook = async (req, res) => {
  const receivedSig = req.headers['x-nowpayments-sig'];
  if (!receivedSig || !IPN_SECRET) {
    console.warn('[NowPayments Webhook] Missing signature header or IPN_SECRET not set.');
    return res.status(200).send('OK'); // Always 200 so NowPayments doesn't keep retrying
  }

  // req.body is a raw Buffer (express.raw middleware above)
  let rawBody;
  try {
    rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : JSON.stringify(req.body);
  } catch {
    return res.status(200).send('OK');
  }

  let parsed;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return res.status(200).send('OK');
  }

  // NowPayments signs the payload with keys sorted alphabetically
  const sortedBody = Object.keys(parsed).sort().reduce((acc, key) => {
    acc[key] = parsed[key];
    return acc;
  }, {});

  const hmac = crypto.createHmac('sha512', IPN_SECRET);
  hmac.update(JSON.stringify(sortedBody));
  const expectedSig = hmac.digest('hex');

  if (expectedSig !== receivedSig) {
    console.warn('[NowPayments Webhook] Signature mismatch — ignoring.');
    return res.status(200).send('OK');
  }

  const { payment_id, payment_status, pay_currency, actually_paid, pay_amount, order_id } = parsed;
  const amountPaid = parseFloat(actually_paid ?? pay_amount ?? 0);

  console.log(`[NowPayments Webhook] payment_id=${payment_id} status=${payment_status} paid=${amountPaid} ${pay_currency} order=${order_id}`);

  if (payment_status === 'finished' && amountPaid > 0) {
    if (dbAvailable && pool && order_id) {
      try {
        // order_id format: "geko-<walletAddress>-<timestamp>"
        const walletAddress = order_id.startsWith('geko-')
          ? order_id.replace(/^geko-/, '').replace(/-\d{10,}$/, '')
          : order_id;

        if (walletAddress && walletAddress.length > 10) {
          const asset = (pay_currency || 'SOL').toUpperCase()
            .replace('USDTTRC20', 'USDT').replace('USDTERC20', 'USDT')
            .replace('BNBBSC', 'BNB').replace('MATICMAINNET', 'MATIC');

          // Check if this payment_id has already been recorded to prevent duplicates
          const existing = await pool.query('SELECT id FROM transactions WHERE payment_id = $1', [payment_id]);
          if (existing.rows.length === 0) {
            // Record original asset deposit
            await recordTransaction({
              wallet_address: walletAddress,
              asset_symbol:   asset,
              amount:         amountPaid,
              type:           'deposit',
              payment_id:     payment_id || null,
              reference:      `nowpayments:${payment_id}`,
              status:         'completed'
            });

            // Credit USDT equivalent for trading if not already USDT
            if (asset !== 'USDT') {
              let price = 1;
              try {
                const pRes = await axios.get(`https://api.kraken.com/0/public/Ticker?pair=${asset}USD`);
                const r = pRes.data.result;
                const pair = Object.keys(r)[0];
                if (r[pair]?.c?.[0]) price = parseFloat(r[pair].c[0]);
              } catch (_) {
                // Fallbacks
                if (asset === 'BTC') price = 65000;
                if (asset === 'ETH') price = 3500;
                if (asset === 'SOL') price = 145;
              }

              const usdtEquiv = parseFloat((amountPaid * price).toFixed(2));
              await recordTransaction({
                wallet_address: walletAddress,
                asset_symbol:   'USDT',
                amount:         usdtEquiv,
                type:           'credit',
                payment_id:     payment_id ? `equiv-${payment_id}` : null,
                reference:      `${asset}-usd-equiv:${payment_id || 'manual'}`,
                status:         'completed'
              });
            }

            console.log(`[NowPayments Webhook] Credited ${amountPaid} ${asset} to ${walletAddress} | trade balance updated`);
          }
        }
      } catch (e) {
        console.error('[NowPayments Webhook] DB credit error:', e.message);
      }
    }
  }

  res.status(200).send('OK');
};

app.post('/api/ipn', handleNowPaymentsWebhook);
app.post('/webhook',  handleNowPaymentsWebhook);

// ─── User balance (sum of transactions) ───────────────────────────────────
app.get('/api/user/balance', async (req, res) => {
  const { address, asset } = req.query;
  if (!address) return res.status(400).json({ error: 'address required' });

  if (!dbAvailable) return res.status(503).json({ error: 'Database unavailable' });

  try {
    if (asset) {
      const balance = await getUserBalance(address, asset.toUpperCase());
      return res.json({ wallet_address: address, asset: asset.toUpperCase(), balance });
    }

    // Return all assets for this wallet
    const result = await pool.query(
      `SELECT asset_symbol,
              COALESCE(SUM(amount), 0) AS balance,
              COUNT(*) AS tx_count
         FROM transactions
        WHERE wallet_address = $1 AND status = 'completed' AND type != 'trade'
        GROUP BY asset_symbol
        ORDER BY asset_symbol`,
      [address]
    );

    const balances = result.rows.map(r => ({
      asset:    r.asset_symbol,
      balance:  parseFloat(r.balance),
      tx_count: parseInt(r.tx_count)
    }));

    // Calculate total USD value
    let totalUsd = 0;
    for (const b of balances) {
      if (b.asset === 'USDT') {
        totalUsd += b.balance;
      } else {
        let price = 1;
        if (b.asset === 'SOL') price = 145;
        if (b.asset === 'BTC') price = 65000;
        if (b.asset === 'ETH') price = 3500;
        totalUsd += b.balance * price;
      }
    }

    return res.json({
      wallet_address: address,
      balances,
      total_usd_value: totalUsd
    });
  } catch (e) {
    console.error('Balance query error:', e.message);
    return res.status(500).json({ error: 'Balance query failed' });
  }
});

// ─── User transaction history ──────────────────────────────────────────────
app.get('/api/user/transactions', async (req, res) => {
  const { address, limit = 50 } = req.query;
  if (!address) return res.status(400).json({ error: 'address required' });
  if (!dbAvailable) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const result = await pool.query(
      `SELECT * FROM transactions
        WHERE wallet_address = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [address, parseInt(limit)]
    );
    return res.json({ wallet_address: address, transactions: result.rows });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── Admin: all transactions ────────────────────────────────────────────────
app.get('/api/admin/transactions', async (req, res) => {
  if (!dbAvailable) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const result = await pool.query(
      `SELECT t.*,
              COALESCE(SUM(t2.amount), 0) OVER (
                PARTITION BY t.wallet_address, t.asset_symbol
                ORDER BY t.created_at
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
              ) AS running_balance
         FROM transactions t
         LEFT JOIN transactions t2
           ON t2.wallet_address = t.wallet_address
          AND t2.asset_symbol   = t.asset_symbol
          AND t2.created_at    <= t.created_at
          AND t2.status         = 'completed'
         WHERE t.status = 'completed'
         ORDER BY t.created_at DESC
         LIMIT 500`
    );
    return res.json(result.rows);
  } catch (e) {
    console.error('Admin transactions error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── Static files & SPA ───────────────────────────────────────────────────

app.post('/api/execute-trade', async (req, res) => {
    const { walletAddress, asset, tradeSize, leverage, type, isDemo, entryPrice, duration, tradeId } = req.body;

    if (!dbAvailable || !pool) {
        return res.status(503).json({ success: false, error: "Database unavailable." });
    }

    try {
        const balanceColumn = isDemo ? 'demo_balance' : 'trading_balance';
        const userRes = await pool.query(`SELECT ${balanceColumn} FROM geko_users WHERE wallet_address = $1`, [walletAddress]);
        if (userRes.rows.length === 0) return res.status(404).json({ success: false, error: "User not found." });
        
        const currentBalance = parseFloat(userRes.rows[0][balanceColumn] || 0);
        const amt = Math.abs(parseFloat(tradeSize));
        
        if (currentBalance < amt) {
            return res.status(400).json({ success: false, error: `Insufficient ${isDemo ? 'demo ' : ''}balance. Available: ${currentBalance}` });
        }

        const id = tradeId || Math.random().toString(36).substring(7);

        // Record the trade in the trades table
        await pool.query(
          `INSERT INTO trades (id, wallet_address, symbol, direction, amount, entry_price, duration, is_demo, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')`,
          [id, walletAddress, asset, type, amt, entryPrice || 0, duration || 60, isDemo || false]
        );

        // Debit correct balance
        await pool.query(
            `UPDATE geko_users SET ${balanceColumn} = ${balanceColumn} - $1 WHERE wallet_address = $2`,
            [amt, walletAddress]
        );

        // Record for auditing
        await recordTransaction({
          wallet_address: walletAddress,
          asset_symbol:   'USDT',
          amount:         -amt,
          type:           'trade',
          reference:      `${isDemo ? 'demo-' : ''}trade-open:${leverage}x-${type}-${asset}`
        });

        console.log(`Trade executed: ${walletAddress} opened ${leverage}x ${type} on ${asset} | margin: ${tradeSize} USDT | tradeId: ${id}`);

        return res.status(200).json({
            success: true,
            tradeId: id,
            message: `Successfully opened ${leverage}x ${type} position!`,
            new_trading_balance: currentBalance - amt
        });

    } catch (error) {
        console.error("Trade execution error:", error);
        return res.status(500).json({ success: false, error: "Internal execution failure." });
    }
});

// ─── Solana Funding Listener ───────────────────────────────────────────────
async function startSolanaListener() {
  const treasuryAddress = process.env.TREASURY_SOL_KEY;
  if (!treasuryAddress) {
    console.log('[SOL Listener] TREASURY_SOL_KEY not set — skipping.');
    return;
  }
  if (!dbAvailable) {
    console.log('[SOL Listener] DB not available — skipping.');
    return;
  }

  let treasuryPubkey;
  try {
    treasuryPubkey = new PublicKey(treasuryAddress);
  } catch {
    console.error('[SOL Listener] Invalid TREASURY_SOL_KEY address.');
    return;
  }

  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');

  // Track last known balance so we can detect increases
  let lastBalance = await connection.getBalance(treasuryPubkey).catch(() => 0);
  console.log(`[SOL Listener] Watching ${treasuryAddress} | Balance: ${(lastBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);

  connection.onLogs(treasuryPubkey, async (logInfo) => {
    if (logInfo.err) return; // ignore failed txns

    const sig = logInfo.signature;
    try {
      // Fetch full transaction with pre/post balances
      const tx = await connection.getParsedTransaction(sig, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed'
      });
      if (!tx || !tx.meta) return;

      const accounts = tx.transaction.message.accountKeys;
      const preBalances = tx.meta.preBalances;
      const postBalances = tx.meta.postBalances;

      // Find treasury index in account list
      const treasuryIdx = accounts.findIndex(
        a => a.pubkey.toBase58() === treasuryAddress
      );
      if (treasuryIdx === -1) return;

      const received = postBalances[treasuryIdx] - preBalances[treasuryIdx];
      if (received <= 0) return; // outgoing tx, ignore

      const solAmount = (received / LAMPORTS_PER_SOL).toFixed(6);

      // Identify sender — the account whose balance dropped the most (excluding fees)
      let senderIdx = -1;
      let maxDrop = 0;
      preBalances.forEach((pre, i) => {
        if (i === treasuryIdx) return;
        const drop = pre - postBalances[i];
        if (drop > maxDrop) { maxDrop = drop; senderIdx = i; }
      });

      const senderAddress = senderIdx >= 0
        ? accounts[senderIdx].pubkey.toBase58()
        : 'unknown';

      console.log(`[SOL Listener] Deposit detected! ${solAmount} SOL from ${senderAddress} | tx: ${sig}`);

      // Record SOL deposit transaction
      await recordTransaction({
        wallet_address: senderAddress,
        asset_symbol:   'SOL',
        amount:         parseFloat(solAmount),
        type:           'deposit',
        tx_signature:   sig,
        reference:      `solana-onchain:${sig}`
      });

      // Derive USDT-equivalent and record a separate USDT credit
      let solPrice = 145;
      try {
        const priceRes = await axios.get(`https://api.kraken.com/0/public/Ticker?pair=SOLUSD`);
        const priceData = priceRes.data;
        const pair = priceData?.result?.SOLUSD || priceData?.result?.['SOLUSD'];
        if (pair?.c?.[0]) solPrice = parseFloat(pair.c[0]);
      } catch (_) {}

      const usdtEquivalent = parseFloat((parseFloat(solAmount) * solPrice).toFixed(2));

      await recordTransaction({
        wallet_address: senderAddress,
        asset_symbol:   'USDT',
        amount:         usdtEquivalent,
        type:           'credit',
        tx_signature:   sig,
        reference:      `sol-usd-equiv:${sig}`
      });

      const newSolBal  = await getUserBalance(senderAddress, 'SOL');
      const newUsdtBal = await getUserBalance(senderAddress, 'USDT');
      console.log(`[SOL Listener] Credited: ${senderAddress} +${solAmount} SOL / +${usdtEquivalent} USDT | balances: ${newSolBal} SOL / ${newUsdtBal} USDT`);

    } catch (err) {
      console.error('[SOL Listener] Error processing tx:', sig, err.message);
    }
  }, 'confirmed');

  console.log('[SOL Listener] Active and subscribed.');
}
app.post('/api/execute-withdrawal', async (req, res) => {
    const { walletAddress, destinationAddress, amount, asset } = req.body;

    if (!dbAvailable) {
        return res.status(503).json({ success: false, error: "Database unavailable." });
    }

    try {
        // 1. Check live balance from transaction sum
        const currentBalance = await getUserBalance(walletAddress, asset);
        if (currentBalance < parseFloat(amount)) {
            return res.status(400).json({ success: false, error: `Insufficient balance. Available: ${currentBalance} ${asset}` });
        }

        // 2. Initialize connection to Solana Mainnet
        const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
        const connection = new Connection(rpcUrl, 'confirmed');

        // 3. Reconstruct Treasury Keypair from Secrets
        const secretKeyString = process.env.TREASURY_SECRET_KEY;
        if (!secretKeyString) {
            return res.status(500).json({ success: false, error: "Server wallet authorization missing." });
        }

        let secretKey;
        if (secretKeyString.includes(',')) {
            secretKey = Uint8Array.from(JSON.parse(secretKeyString));
        } else {
            secretKey = bs58.decode(secretKeyString);
        }
        const treasuryKeypair = Keypair.fromSecretKey(secretKey);

        // 4. Build and broadcast on-chain transfer
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: treasuryKeypair.publicKey,
                toPubkey:   new PublicKey(destinationAddress),
                lamports:   Math.round(amount * LAMPORTS_PER_SOL),
            })
        );

        const signature = await sendAndConfirmTransaction(connection, transaction, [treasuryKeypair]);

        // 5. Record withdrawal as a negative transaction row
        await recordTransaction({
            wallet_address: walletAddress,
            asset_symbol:   asset,
            amount:         -Math.abs(parseFloat(amount)),
            type:           'withdrawal',
            tx_signature:   signature,
            reference:      `withdraw-to:${destinationAddress}`
        });

        const newBalance = await getUserBalance(walletAddress, asset);
        console.log(`💸 Withdrawal: ${amount} ${asset} → ${destinationAddress} | tx: ${signature} | new balance: ${newBalance}`);
        return res.status(200).json({ success: true, txSignature: signature, newBalance });

    } catch (error) {
        console.error("Withdrawal execution failure:", error);
        return res.status(500).json({ success: false, error: "Transaction processing failed." });
    }
});
// ─── Trade Settlement — credit win payout back to trading_balance ──────────
app.post('/api/settle-trade', async (req, res) => {
  const { walletAddress, asset, payout, tradeRef, isDemo, status, pnl } = req.body;
  if (!walletAddress) return res.status(400).json({ error: 'walletAddress required' });
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const amt = parseFloat(payout || 0);
    const balanceColumn = isDemo ? 'demo_balance' : 'trading_balance';

    if (amt > 0) {
      await pool.query(
        `UPDATE geko_users SET ${balanceColumn} = ${balanceColumn} + $1 WHERE wallet_address = $2`,
        [amt, walletAddress]
      );
    }

    // Update trade record
    if (tradeRef) {
      await pool.query(
        `UPDATE trades SET status = $1, settled_at = NOW(), force_outcome = NULL WHERE id = $2`,
        [status || (amt > 0 ? 'won' : 'lost'), tradeRef]
      );
    }

    // Record for auditing
    if (amt > 0) {
      await recordTransaction({
        wallet_address: walletAddress,
        asset_symbol:   'USDT',
        amount:         amt,
        type:           'trade',
        reference:      `${isDemo ? 'demo-' : ''}trade-settle:${tradeRef}`
      });
    }

    const userRes = await pool.query(`SELECT ${balanceColumn} FROM geko_users WHERE wallet_address = $1`, [walletAddress]);
    
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found after settlement' });
    }
    return res.json({ success: true, new_balance: userRes.rows[0][balanceColumn] });
  } catch (e) {
    console.error('settle-trade error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/active-trades', async (req, res) => {
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const result = await pool.query(`SELECT * FROM trades WHERE status = 'pending' ORDER BY created_at DESC`);
    return res.json(result.rows);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/force-outcome', async (req, res) => {
  const { tradeId, forceOutcome } = req.body;
  if (!tradeId || !forceOutcome) return res.status(400).json({ error: 'tradeId and forceOutcome required' });
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    await pool.query(`UPDATE trades SET force_outcome = $1 WHERE id = $2`, [forceOutcome, tradeId]);
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.get('/api/user/active-trades', async (req, res) => {
  const { address } = req.query;
  if (!address) return res.status(400).json({ error: 'address required' });
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const result = await pool.query(`SELECT * FROM trades WHERE wallet_address = $1 AND status = 'pending'`, [address]);
    return res.json(result.rows);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── User: Submit Withdrawal Request (pending, no money moved) ─────────────
app.post('/api/request-withdrawal', async (req, res) => {
  const { walletAddress, destinationAddress, amount, asset } = req.body;
  if (!walletAddress || !destinationAddress || !amount || !asset)
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  if (!dbAvailable) return res.status(503).json({ success: false, error: 'Database unavailable' });

  try {
    const balance = await getUserBalance(walletAddress, asset);
    if (balance < parseFloat(amount))
      return res.status(400).json({ success: false, error: `Insufficient balance. Available: ${balance} ${asset}` });

    const result = await pool.query(
      `INSERT INTO withdrawal_requests (wallet_address, destination_address, amount, asset, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
      [walletAddress, destinationAddress.trim(), parseFloat(amount), asset]
    );

    console.log(`[Withdrawal Request] #${result.rows[0].id} — ${walletAddress} → ${destinationAddress} | ${amount} ${asset}`);
    return res.json({ success: true, requestId: result.rows[0].id });
  } catch (e) {
    console.error('Withdrawal request error:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// ─── Admin: List All Withdrawal Requests ───────────────────────────────────
app.get('/api/admin/withdrawal-requests', async (req, res) => {
  if (!dbAvailable) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const result = await pool.query(
      `SELECT wr.*, u.nickname,
              COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'completed'), 0) AS current_balance
         FROM withdrawal_requests wr
         LEFT JOIN geko_users u ON u.wallet_address = wr.wallet_address
         LEFT JOIN transactions t
           ON t.wallet_address = wr.wallet_address AND t.asset_symbol = wr.asset
         GROUP BY wr.id, u.nickname
         ORDER BY wr.created_at DESC
         LIMIT 200`
    );
    return res.json(result.rows);
  } catch (e) {
    console.error('Admin withdrawal-requests error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── Admin: Approve Withdrawal → trigger payout → record in ledger ─────────
app.post('/api/admin/approve-withdrawal', async (req, res) => {
  const { requestId } = req.body;
  if (!requestId) return res.status(400).json({ success: false, error: 'requestId required' });
  if (!dbAvailable) return res.status(503).json({ success: false, error: 'Database unavailable' });

  try {
    // 1. Fetch the request
    const reqResult = await pool.query('SELECT * FROM withdrawal_requests WHERE id = $1', [requestId]);
    if (!reqResult.rows.length) return res.status(404).json({ success: false, error: 'Request not found' });
    const wr = reqResult.rows[0];
    if (wr.status !== 'pending')
      return res.status(400).json({ success: false, error: `Request is already ${wr.status}` });

    // 2. Verify user still has sufficient balance
    const balance = await getUserBalance(wr.wallet_address, wr.asset);
    if (balance < parseFloat(wr.amount))
      return res.status(400).json({ success: false, error: `Insufficient balance: ${balance} ${wr.asset}` });

    let signature = null;
    let nowpaymentsId = null;
    let payoutError = null;

    // 3a. Try NowPayments Payout API - Corrected to use the proper environment variable or constant
    const activeApiKey = process.env.NOWPAYMENTS_API_KEY || NOWPAYMENTS_API_KEY;
    const activeIpnSecret = process.env.IPN_SECRET || IPN_SECRET;
    if (activeApiKey && activeIpnSecret) {
      try {
        const callbackUrl = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/ipn` : `http://localhost:${port}/api/ipn`;
        const body = {
          withdrawals: [{
            address:          wr.destination_address,
            currency:         wr.asset.toLowerCase(),
            amount:           parseFloat(wr.amount),
            ipn_callback_url: callbackUrl,
            extra_id:         `geko-wr-${wr.id}`
          }]
        };
        const bodyStr = JSON.stringify(body);
        const sigHex  = crypto.createHmac('sha512', activeIpnSecret).update(bodyStr).digest('hex');

        const nowRes  = await axios.post('https://api.nowpayments.io/v1/payout', body, {
          headers: {
            'Content-Type':       'application/json',
            'x-api-key':          activeApiKey,
            'x-nowpayments-sig':  sigHex
          }
        });
        const nowData = nowRes.data;

        if (nowRes.status === 200 && nowData.id) {
          nowpaymentsId = nowData.id;
          signature     = `nowpayments-payout:${nowData.id}`;
          console.log(`[Approve Withdrawal] NowPayments payout initiated: ${nowData.id}`);
        } else {
          payoutError = nowData.message || JSON.stringify(nowData);
          console.warn(`[Approve Withdrawal] NowPayments payout failed: ${payoutError}`);
        }
      } catch (e) {
        payoutError = e.message;
        console.warn(`[Approve Withdrawal] NowPayments error: ${e.message}`);
      }
    }

    // 3b. Fallback — Direct Solana treasury transfer (SOL only)
    if (!signature && wr.asset === 'SOL') {
      const secretKeyString = process.env.TREASURY_SECRET_KEY;
      if (!secretKeyString) throw new Error('TREASURY_SECRET_KEY not set and NowPayments payout failed');

      let secretKey;
      if (secretKeyString.includes(',')) {
        secretKey = Uint8Array.from(JSON.parse(secretKeyString));
      } else {
        secretKey = bs58.decode(secretKeyString);
      }
      const treasuryKeypair = Keypair.fromSecretKey(secretKey);
      const rpcUrl          = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const connection      = new Connection(rpcUrl, 'confirmed');

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: treasuryKeypair.publicKey,
          toPubkey:   new PublicKey(wr.destination_address),
          lamports:   Math.round(parseFloat(wr.amount) * LAMPORTS_PER_SOL)
        })
      );
      signature = await sendAndConfirmTransaction(connection, tx, [treasuryKeypair]);
      console.log(`[Approve Withdrawal] SOL treasury transfer: ${signature}`);
    }

    if (!signature) throw new Error(payoutError || 'All payout methods failed');

    // 4. Record debit in the transactions ledger
    await recordTransaction({
      wallet_address: wr.wallet_address,
      asset_symbol:   wr.asset,
      amount:         -Math.abs(parseFloat(wr.amount)),
      type:           'withdrawal',
      tx_signature:   signature,
      reference:      `admin-approved:#${wr.id}→${wr.destination_address}`
    });

    // 5. Mark request approved
    await pool.query(
      `UPDATE withdrawal_requests
          SET status = 'approved', tx_signature = $1, nowpayments_id = $2, processed_at = NOW()
        WHERE id = $3`,
      [signature, nowpaymentsId, requestId]
    );

    const newBalance = await getUserBalance(wr.wallet_address, wr.asset);
    console.log(`✅ Withdrawal #${wr.id} approved | ${wr.amount} ${wr.asset} → ${wr.destination_address} | tx: ${signature} | new bal: ${newBalance}`);
    return res.json({ success: true, txSignature: signature, nowpaymentsId, newBalance });

  } catch (e) {
    console.error('[Approve Withdrawal] Error:', e.message);
    // Mark as failed
    await pool.query(
      `UPDATE withdrawal_requests SET status = 'failed', admin_note = $1 WHERE id = $2`,
      [e.message, requestId]
    ).catch(() => {});
    return res.status(500).json({ success: false, error: e.message });
  }
});

// ─── Admin: Reject Withdrawal ───────────────────────────────────────────────
app.post('/api/admin/reject-withdrawal', async (req, res) => {
  const { requestId, note } = req.body;
  if (!requestId) return res.status(400).json({ success: false, error: 'requestId required' });
  if (!dbAvailable) return res.status(503).json({ error: 'Database unavailable' });
  try {
    await pool.query(
      `UPDATE withdrawal_requests SET status = 'rejected', admin_note = $1, processed_at = NOW() WHERE id = $2`,
      [note || 'Rejected by admin', requestId]
    );
    console.log(`[Reject Withdrawal] Request #${requestId} rejected`);
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// ─── Path Configuration ─────────────────────────────────────────────────────
const distPath = path.resolve(__dirname, 'dist');
const publicPath = path.resolve(__dirname, 'public');
const rootPath = __dirname;

console.log(`[Static] Resolving from: ${__dirname}`);
console.log(` - Dist:   ${distPath} (${fs.existsSync(distPath) ? 'EXISTS ✅' : 'MISSING ❌'})`);
console.log(` - Public: ${publicPath} (${fs.existsSync(publicPath) ? 'EXISTS ✅' : 'MISSING ❌'})`);

app.use(express.static(distPath));
app.use(express.static(publicPath));
app.use(express.static(rootPath));

// ─── KYC ────────────────────────────────────────────────────────────────────
app.post('/api/kyc/submit', async (req, res) => {
  const { wallet_address, full_name, date_of_birth, country, id_type, id_number } = req.body;
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'DB Unavailable' });
  try {
    const existing = await pool.query(`SELECT id FROM kyc_submissions WHERE wallet_address=$1 AND status='pending'`, [wallet_address]);
    if (existing.rows.length) return res.status(409).json({ error: 'KYC already pending review.' });
    await pool.query(`INSERT INTO kyc_submissions (wallet_address,full_name,date_of_birth,country,id_type,id_number) VALUES ($1,$2,$3,$4,$5,$6)`, [wallet_address, full_name, date_of_birth, country, id_type, id_number]);
    await pool.query(`UPDATE geko_users SET kyc_status='pending' WHERE wallet_address=$1`, [wallet_address]);
    return res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/kyc/status', async (req, res) => {
  const { address } = req.query;
  if (!dbAvailable || !pool || !address) return res.json({ status: 'none' });
  try {
    const r = await pool.query(`SELECT kyc_status FROM geko_users WHERE wallet_address=$1`, [address]);
    return res.json({ status: r.rows[0]?.kyc_status || 'none' });
  } catch (e) { res.json({ status: 'none' }); }
});

// ─── Support Tickets ─────────────────────────────────────────────────────────
app.post('/api/support/ticket', async (req, res) => {
  const { wallet_address, subject, message, ticket_id } = req.body;
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'DB Unavailable' });
  try {
    if (ticket_id) {
      const tkt = await pool.query(`SELECT messages FROM support_tickets WHERE id=$1 AND wallet_address=$2`, [ticket_id, wallet_address]);
      if (!tkt.rows.length) return res.status(404).json({ error: 'Ticket not found' });
      const msgs = [...(tkt.rows[0].messages || []), { sender: 'user', text: message, time: new Date().toISOString() }];
      await pool.query(`UPDATE support_tickets SET messages=$1, status='open', updated_at=NOW() WHERE id=$2`, [JSON.stringify(msgs), ticket_id]);
      return res.json({ success: true });
    }
    const msgs = [{ sender: 'user', text: message, time: new Date().toISOString() }];
    const r = await pool.query(`INSERT INTO support_tickets (wallet_address,subject,messages) VALUES ($1,$2,$3) RETURNING *`, [wallet_address, subject, JSON.stringify(msgs)]);
    return res.json({ success: true, ticket: r.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/support/tickets', async (req, res) => {
  const { address } = req.query;
  if (!dbAvailable || !pool || !address) return res.json([]);
  try {
    const r = await pool.query(`SELECT * FROM support_tickets WHERE wallet_address=$1 ORDER BY updated_at DESC`, [address]);
    return res.json(r.rows);
  } catch (e) { res.json([]); }
});

// ─── Referral ────────────────────────────────────────────────────────────────
app.get('/api/referral/info', async (req, res) => {
  const { address } = req.query;
  if (!dbAvailable || !pool || !address) return res.status(503).json({ error: 'DB Unavailable' });
  try {
    let r = await pool.query(`SELECT referral_code FROM geko_users WHERE wallet_address=$1`, [address]);
    if (!r.rows.length) return res.status(404).json({ error: 'User not found' });
    let code = r.rows[0].referral_code;
    if (!code) { 
      code = 'GEKO' + address.slice(-6).toUpperCase(); 
      await pool.query(`UPDATE geko_users SET referral_code=$1 WHERE wallet_address=$2`, [code, address]); 
    }
    const refs = await pool.query(`SELECT COUNT(*) AS count FROM geko_users WHERE referred_by=$1`, [code]);
    const earnings = await pool.query(`SELECT COALESCE(SUM(amount),0) * 0.05 AS total FROM transactions t JOIN geko_users u ON u.wallet_address=t.wallet_address WHERE u.referred_by=$1 AND t.type='deposit' AND t.status='completed'`, [code]);
    return res.json({ 
      referral_code: code, 
      referral_count: parseInt(refs.rows[0].count), 
      referral_earnings: parseFloat(earnings.rows[0].total), 
      referral_link: `https://${req.hostname}?ref=${code}` 
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Leaderboard ────────────────────────────────────────────────────────────
app.get('/api/leaderboard', async (req, res) => {
  if (!dbAvailable || !pool) return res.json([]);
  try {
    const result = await pool.query(`
      SELECT u.wallet_address,
        COALESCE(u.trading_balance, (SELECT COALESCE(SUM(amount),0) FROM transactions t WHERE t.wallet_address=u.wallet_address AND t.status='completed' AND t.asset_symbol='USDT'), 0) AS balance
      FROM geko_users u WHERE u.wallet_address IS NOT NULL ORDER BY balance DESC LIMIT 20`);
    return res.json(result.rows.map((r, i) => ({
      rank: i + 1,
      display_name: r.wallet_address?.slice(0, 4) + '...' + r.wallet_address?.slice(-4),
      balance: parseFloat(r.balance)
    })));
  } catch (e) { console.error('Leaderboard error:', e.message); res.json([]); }
});

// Final catch-all for SPA: must be the LAST route
app.get('*', (req, res) => {
  // Safety check: Don't serve index.html for missing static assets (js, css, etc)
  if (req.url.includes('.') && !req.url.endsWith('.html')) {
    return res.status(404).send("Asset not found");
  }

  const possiblePaths = [
    path.join(distPath, 'index.html'),
    path.join(publicPath, 'index.html'),
    path.join(rootPath, 'index.html')
  ];

  for (const indexPath of possiblePaths) {
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  res.status(404).send("<h1>Frontend Build Not Found</h1><p>Please ensure index.html exists in /dist, /public, or the project root.</p>");
});

app.listen(port, '0.0.0.0', () => {
  console.log('---------------------------------------------');
  console.log(`🚀 Geko Protocols Server: http://0.0.0.0:${port}`);
  console.log(`📂 Static Paths: dist, public, root`);
  console.log(`🗄️  Database Status: ${dbAvailable ? 'CONNECTED ✅' : 'DISCONNECTED ❌'}`);
  console.log(`💳 NowPayments Ready: ${!!npApi}`);
  console.log('---------------------------------------------');
});
