// Expected answers are authored independently of the product formatter.
import { cases as frozenCases } from '../controlled-planning/cases.mjs';
export const wicUrl = 'https://www.ruhealth.org/appointments/apply-4-wic-form';
const known = structuredClone(frozenCases[0]);
const expected = {
  'edit-name': 'Synthetic Applicant', 'edit-date-of-birth': '01/02/2000',
  'edit-home-address': '5556 Test Blvd, Apt 556, WILDOMAR, CA, 92595',
  'edit-mobile': '2025550117', 'edit-email': 'test@example.invalid', 'edit-what-is-your-preferred-language': 'English',
  'wic:receive-texts': 'Yes', 'wic:medical': 'No',
  'edit-please-select-all-that-apply-pregnant': 'no', 'edit-please-select-all-that-apply-post-partum': 'no',
  'edit-please-select-all-that-apply-infant-breastfeeding': 'no', 'edit-please-select-all-that-apply-infant-formula': 'no',
  'edit-please-select-all-that-apply-childrentoddler-0-5': 'yes',
  'edit-i-authorize-my-wic-appointments-select-all-that-apply-in-person': 'yes',
  'edit-i-authorize-my-wic-appointments-select-all-that-apply-virtual-phone': 'no',
  'edit-i-authorize-my-wic-appointments-select-all-that-apply-telehealth-video': 'no',
  'edit-please-choose-the-wic-clinic-closest-to-you': 'Temecula WIC',
};
const conditional = ['edit-if-yes', 'edit-mailing-address-if-different-from-home-address-'];
const yes = structuredClone(known.participant);
yes.mediCalCoverage = 'Yes'; yes.mediCalCaseNumber = 'TEST-001';
yes.address.mailing = { street: '14 Other Test Street', city: 'Riverside', state: 'CA', zip: '92501' };
const missingCase = structuredClone(yes); delete missingCase.mediCalCaseNumber;
const missingZip = structuredClone(known.participant); delete missingZip.address.residential.zip;
export const cases = [
  { ...known, id: 'wic-no-same', url: wicUrl, expectedValues: expected, expectedGaps: [], expectedBlank: conditional, completeSource: true },
  { ...known, id: 'wic-yes-different', url: wicUrl, participant: yes,
    expectedMappings: { ...known.expectedMappings, 'edit-if-yes': 'mediCalCaseNumber', [conditional[1]]: 'alternateMailingAddress' },
    expectedValues: { ...expected, 'wic:medical': 'Yes', 'edit-if-yes': 'TEST-001', [conditional[1]]: '14 Other Test Street, Riverside, CA, 92501' },
    expectedGaps: [], expectedBlank: [], completeSource: true },
  { ...known, id: 'wic-missing-case', url: wicUrl, participant: missingCase,
    expectedValues: { ...expected, 'wic:medical': 'Yes', [conditional[1]]: '14 Other Test Street, Riverside, CA, 92501' },
    expectedMappings: { ...known.expectedMappings, [conditional[1]]: 'alternateMailingAddress' },
    expectedGaps: [conditional[0]], expectedBlank: [], completeSource: false },
  { ...known, id: 'wic-missing-zip', url: wicUrl, participant: missingZip,
    expectedValues: Object.fromEntries(Object.entries(expected).filter(([key]) => key !== 'edit-home-address')),
    expectedMappings: Object.fromEntries(Object.entries(known.expectedMappings).filter(([key]) => key !== 'edit-home-address')),
    expectedGaps: ['edit-home-address', conditional[1]], expectedBlank: [conditional[0]], completeSource: false },
  { ...structuredClone(frozenCases[1]), url: 'https://synthetic.test/ihss-diagnostic',
    expectedValues: { 'applicant-name': 'Synthetic Applicant', 'applicant-dob': '01/02/2000', 'applicant-ssn': '000-00-0000', ssi: 'No' },
    expectedBlank: ['signature'], completeSource: false },
  { ...structuredClone(frozenCases[2]), url: 'https://synthetic.test/calfresh-diagnostic',
    expectedValues: { street: '5556 Test Blvd', unit: 'Apt 556', city: 'WILDOMAR', state: 'CA', zip: '92595', homeless: 'No', county: 'Riverside' },
    expectedBlank: ['captcha'], completeSource: false },
];
