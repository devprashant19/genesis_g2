import 'dotenv/config';
import { Pool } from 'pg';

export const pool = new Pool({
  user: process.env.POSTGRES_USER || 'spidey',
  password: process.env.POSTGRES_PASSWORD || 'password',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'spidey_db',
});

// Setup schema
export const initDb = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS players (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        phone_number TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS match_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id UUID REFERENCES players(id),
        global_ability TEXT CHECK (global_ability IN ('SPEED','STRENGTH','DEFENCE')),
        total_score INT NOT NULL,
        completion_time_ms INT NOT NULL,
        round INT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('Database schema initialized.');
  } finally {
    client.release();
  }
};
