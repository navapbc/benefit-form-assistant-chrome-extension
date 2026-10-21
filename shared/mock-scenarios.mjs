// Fictional scenario datasets for the mock connector's quick-load buttons. Each is a client record in the
// extension's record shape, derived from the bundled record 339619 so the scenarios differ in one thing at a time.
import { CLIENT_RECORDS } from './demo-connector-data.mjs';

const base = CLIENT_RECORDS.find((record) => record.record_id === '339619');
const copy = (value) => JSON.parse(JSON.stringify(value));

function variant(change) {
  const record = copy(base);
  change(record);
  return record;
}

export const SCENARIOS = [
  {
    id: 'complete',
    label: 'Complete record',
    scenario: 'complete',
    description: 'Every field the demo forms ask for is present; mailing address matches home.',
    payload: copy(base),
  },
  {
    id: 'missing-home-zip',
    label: 'Missing home ZIP',
    scenario: 'missing-source-value',
    description: 'Residential ZIP is blank, so a full home address cannot be written.',
    payload: variant((record) => { record.address.residential.zip = ''; }),
  },
  {
    id: 'different-mailing-address',
    label: 'Different mailing address',
    scenario: 'conditional-field',
    description: 'Mailing address differs from the home address.',
    payload: variant((record) => {
      Object.assign(record.address.mailing, { street: '400 Mailing Ave', unit: '', city: 'RIVERSIDE', zip: '92501' });
    }),
  },
  {
    id: 'homeless',
    label: 'Homeless housing status',
    scenario: 'semantic-transform',
    description: 'Housing status is not "Stable housing"; exercises the CalFresh homelessness question.',
    payload: variant((record) => { record.participant.housing_status = 'Homeless'; }),
  },
];
