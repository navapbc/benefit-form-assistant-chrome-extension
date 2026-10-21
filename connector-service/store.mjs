// Storage for the mock connector. Two interchangeable stores: in memory (the default, nothing to set up) and
// Postgres (when DATABASE_URL is set). Both hold fictional data only.
import { recordAttributes, FORM_ID, RECORD_ID } from '../shared/demo-connector-data.mjs';
import { SCENARIOS } from '../shared/mock-scenarios.mjs';

const DEMO_SOURCE = String(FORM_ID);
const DEMO_RECORD = String(RECORD_ID);

/** The demo record's stored attributes: the shared fixture without `mod_time`, which the store stamps on read. */
function demoAttributes() {
  const { mod_time: _modTime, ...attributes } = recordAttributes('');
  return attributes;
}

export function createMemoryStore() {
  const records = new Map([[`${DEMO_SOURCE}:${DEMO_RECORD}`, { attributes: demoAttributes(), updatedAt: new Date().toISOString() }]]);
  const datasets = new Map();
  return {
    kind: 'memory',
    async seed() { for (const scenario of SCENARIOS) datasets.set(scenario.id, { ...scenario, isPreset: true }); },
    async getRecord(sourceId, recordId) {
      const row = records.get(`${sourceId}:${recordId}`);
      return row ? { attributes: row.attributes, updatedAt: row.updatedAt } : null;
    },
    async putRecord(sourceId, recordId, attributes) {
      records.set(`${sourceId}:${recordId}`, { attributes, updatedAt: new Date().toISOString() });
    },
    async listDatasets() { return [...datasets.values()].map(({ payload: _payload, ...summary }) => summary); },
    async getDataset(id) { return datasets.get(id) || null; },
    async putDataset(dataset) {
      if (datasets.get(dataset.id)?.isPreset) throw Object.assign(new Error('Preset datasets cannot be replaced.'), { status: 409 });
      datasets.set(dataset.id, { ...dataset, isPreset: false });
    },
    async close() {},
  };
}

export function createPostgresStore(pool) {
  const summary = (row) => ({ id: row.id, label: row.label, scenario: row.scenario, description: row.description, isPreset: row.is_preset });
  return {
    kind: 'postgres',
    async seed() {
      await pool.query(
        `insert into mock_records (source_id, record_id, attributes) values ($1, $2, $3)
         on conflict (source_id, record_id) do nothing`,
        [DEMO_SOURCE, DEMO_RECORD, demoAttributes()],
      );
      for (const s of SCENARIOS) {
        await pool.query(
          `insert into mock_datasets (id, label, scenario, description, payload, is_preset) values ($1, $2, $3, $4, $5, true)
           on conflict (id) do update set label = excluded.label, scenario = excluded.scenario,
             description = excluded.description, payload = excluded.payload, updated_at = now()
           where mock_datasets.is_preset`,
          [s.id, s.label, s.scenario, s.description, s.payload],
        );
      }
    },
    async getRecord(sourceId, recordId) {
      const { rows } = await pool.query('select attributes, updated_at from mock_records where source_id = $1 and record_id = $2', [sourceId, recordId]);
      return rows[0] ? { attributes: rows[0].attributes, updatedAt: rows[0].updated_at.toISOString() } : null;
    },
    async putRecord(sourceId, recordId, attributes) {
      await pool.query(
        `insert into mock_records (source_id, record_id, attributes) values ($1, $2, $3)
         on conflict (source_id, record_id) do update set attributes = excluded.attributes, updated_at = now()`,
        [sourceId, recordId, attributes],
      );
    },
    async listDatasets() {
      const { rows } = await pool.query('select id, label, scenario, description, is_preset from mock_datasets order by is_preset desc, label');
      return rows.map(summary);
    },
    async getDataset(id) {
      const { rows } = await pool.query('select * from mock_datasets where id = $1', [id]);
      return rows[0] ? { ...summary(rows[0]), payload: rows[0].payload } : null;
    },
    async putDataset(dataset) {
      // A custom dataset can never overwrite a preset.
      const { rowCount } = await pool.query(
        `insert into mock_datasets (id, label, scenario, description, payload) values ($1, $2, $3, $4, $5)
         on conflict (id) do update set label = excluded.label, scenario = excluded.scenario,
           description = excluded.description, payload = excluded.payload, updated_at = now()
         where not mock_datasets.is_preset`,
        [dataset.id, dataset.label, dataset.scenario, dataset.description, dataset.payload],
      );
      if (!rowCount) throw Object.assign(new Error('Preset datasets cannot be replaced.'), { status: 409 });
    },
    async close() { await pool.end(); },
  };
}

/** Postgres when DATABASE_URL is set (unless MOCK_STORE=memory), otherwise memory. The pooled URL is for runtime; migrations use the direct one. */
export async function storeFromEnvironment(environment = process.env) {
  if (!environment.DATABASE_URL || environment.MOCK_STORE === 'memory') return createMemoryStore();
  const { default: pg } = await import('pg');
  return createPostgresStore(new pg.Pool({ connectionString: environment.DATABASE_URL, max: 4, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 10_000 }));
}
