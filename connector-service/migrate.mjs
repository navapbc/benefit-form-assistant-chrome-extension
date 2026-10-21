// Applies connector-service/schema.sql and seeds the preset scenarios. Idempotent. Needs DATABASE_URL_UNPOOLED
// (schema changes use the direct connection); run through `npm run connector:migrate` so .env.local is loaded.
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { createPostgresStore } from './store.mjs';

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL_UNPOOLED (run `neon deploy` to pull it into .env.local).');
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 15_000 });
try {
  await pool.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
  const store = createPostgresStore(pool);
  await store.seed();
  const { rows } = await pool.query('select (select count(*) from mock_records) as records, (select count(*) from mock_datasets) as datasets');
  console.log(`Schema applied. mock_records=${rows[0].records} mock_datasets=${rows[0].datasets}`);
} finally {
  await pool.end();
}
