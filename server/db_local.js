import { JSONFilePreset } from 'lowdb/node';

// Define the database schema
const defaultData = {
  users: [],
  config: [
    { key: 'solana_deposit_address', value: '6HmBxJuv9f5P92am6AK18KZGkHGqbNUazYXXKhvrDviw' },
    { key: 'btc_deposit_address', value: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' },
    { key: 'eth_deposit_address', value: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' },
    { key: 'usdt_deposit_address', value: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' }
  ],
  trades: [],
  withdrawal_requests: [],
  transactions: [],
  visitors: [],
  support_tickets: [],
  kyc_submissions: []
};

let db;

export const getDb = async () => {
  if (!db) {
    db = await JSONFilePreset('db.json', defaultData);
  }
  return db;
};
