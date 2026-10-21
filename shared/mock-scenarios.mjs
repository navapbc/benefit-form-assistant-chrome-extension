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
    description: 'Has everything the applications ask for, so there is nothing left to answer.',
    payload: copy(base),
  },
  {
    id: 'missing-home-zip',
    label: 'Missing ZIP code',
    scenario: 'missing-source-value',
    description: 'The home ZIP code is blank. See how the assistant asks you for it.',
    payload: variant((record) => { record.address.residential.zip = ''; }),
  },
  {
    id: 'different-mailing-address',
    label: 'Different mailing address',
    scenario: 'conditional-field',
    description: 'Mail goes somewhere other than home. See how the assistant fills in both.',
    payload: variant((record) => {
      Object.assign(record.address.mailing, { street: '400 Mailing Ave', unit: '', city: 'RIVERSIDE', zip: '92501' });
    }),
  },
  {
    id: 'homeless',
    label: 'Housing not stable',
    scenario: 'semantic-transform',
    description: 'See how housing questions are answered when a client does not have stable housing.',
    payload: variant((record) => { record.participant.housing_status = 'Homeless'; }),
  },
];
