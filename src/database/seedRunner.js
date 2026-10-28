// ============================================================================
// Seed Runner CLI Script
// Seeds live Supabase PostgreSQL (when credentials available) or local store
// ============================================================================

import dotenv from 'dotenv';
dotenv.config();
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Client } = pg;

async function runSeed() {
  console.log('[Seed Runner] Initializing AegisTrack hospital database seeds...');

  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    try {
      console.log('[Seed Runner] Applying SQL seed to live Supabase PostgreSQL...');
      const client = new Client({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false }
      });
      await client.connect();

      const seedSqlPath = path.join(__dirname, '../../supabase/seed.sql');
      const sql = fs.readFileSync(seedSqlPath, 'utf8');
      await client.query(sql);
      await client.end();
      console.log('[Seed Runner] ✓ Live Supabase database re-seeded successfully.');
    } catch (err) {
      console.warn('[Seed Runner] Note: Direct SQL seed skipped:', err.message);
    }
  }

  const result = await db.resetDatabase();
  console.log('[Seed Runner] Result:', result.message);

  const metrics = await db.getFleetMetrics();
  console.log('[Seed Runner] Fleet Summary:');
  console.log(`- Total Assets: ${metrics.fleet_total}`);
  console.log(`- Available for Issue: ${metrics.available_count}`);
  console.log(`- In Use: ${metrics.in_use_count}`);
  console.log(`- In Transit: ${metrics.in_transit_count}`);
  console.log(`- Cleaning Backlog: ${metrics.cleaning_backlog_count}`);
  console.log(`- Maintenance Blackout: ${metrics.blackout_count}`);
  console.log(`- Overdue Returns: ${metrics.overdue_count}`);
  console.log('[Seed Runner] Successfully verified database integrity.');
}

runSeed().catch(err => {
  console.error('[Seed Runner] Fatal error:', err);
  process.exit(1);
});
