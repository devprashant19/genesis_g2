import 'dotenv/config';
import { pool, initDb } from './src/db';

async function run() {
  try {
    console.log('Testing Postgres connection...');
    await initDb();
    console.log('Postgres Primary: OK');
    process.exit(0);
  } catch (e) {
    console.error('Postgres Test Failed:', e);
    process.exit(1);
  }
}

run();
