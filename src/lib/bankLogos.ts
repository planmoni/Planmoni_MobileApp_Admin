/**
 * Matches a bank (by name and/or bank code) to a logo in assets/images/banks.
 *
 * Bank names in the database are inconsistent ("OPAY", "OPay Digital Services
 * Limited (OPay)", "GTBANK PLC", "Guaranty Trust Bank", or even a bare code like
 * "000016"), so matching works in this order:
 *   1. bank code (NIBSS / Paystack / Safe Haven)
 *   2. explicit alias for the normalised name
 *   3. exact match on the logo's own name
 *   4. partial match (longest logo name contained in the bank name, or vice versa)
 */

const logoFiles = import.meta.glob<string>('../../assets/images/banks/*.{png,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const STOP_WORDS = new Set([
  'bank', 'banks', 'plc', 'microfinance', 'micro', 'mfb', 'mfbank', 'limited', 'ltd',
  'nigeria', 'nig', 'ng', 'of', 'for', 'the', 'and', 'by', 'digital', 'services',
]);

const normalize = (value: string): string => {
  const tokens = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t && !STOP_WORDS.has(t));
  return Array.from(new Set(tokens)).join('');
};

// file stem (without extension) -> url
const urlByStem: Record<string, string> = {};
// normalised logo name -> file stem
const stemByKey: Record<string, string> = {};

for (const [path, url] of Object.entries(logoFiles)) {
  const stem = path.split('/').pop()!.replace(/\.(png|svg)$/, '');
  if (stem.endsWith('-white')) continue; // dark-background variants
  urlByStem[stem] = url;
  stemByKey[normalize(stem.replace(/_/g, ' '))] = stem;
}

const KEYS_BY_LENGTH = Object.keys(stemByKey).sort((a, b) => b.length - a.length);

// normalised bank name -> logo stem, for names that do not match the file name
const ALIASES: Record<string, string> = {
  gtbank: 'gt_bank',
  gtb: 'gt_bank',
  gtco: 'gt_bank',
  guarantytrust: 'gt_bank',
  unitedafrica: 'united_bank',
  uba: 'united_bank',
  firstcitymonument: 'fcmb_bank',
  fcmb: 'fcmb_bank',
  firstbank: 'first_bank',
  accessdiamond: 'access_diamond_bank',
  ecobank: 'eco_bank',
  alat: 'alat_wema_bank',
  alatwema: 'alat_wema_bank',
  smartcash: 'airtel_smartcash_bank',
  standardchartered: 'standard_chartered_bank',
  stanbicibtc: 'stanbic_bank',
  stanbic: 'stanbic_bank',
  citibank: 'citi_bank',
  citi: 'citi_bank',
  parallex: 'parrallex_bank',
  '9psb': '9mobile_bank',
  mtnmomo: 'mtn_mono_bank',
  safehavenmfb: 'safe_haven_bank',
};

// bank code -> logo stem (NIBSS / Paystack / provider codes)
const CODES: Record<string, string> = {
  '044': 'access_bank',
  '000014': 'access_bank',
  '063': 'access_diamond_bank',
  '035': 'wema_bank',
  '000017': 'wema_bank',
  '035A': 'alat_wema_bank',
  '050': 'eco_bank',
  '000010': 'eco_bank',
  '070': 'fidelity_bank',
  '000007': 'fidelity_bank',
  '011': 'first_bank',
  '000016': 'first_bank',
  '214': 'fcmb_bank',
  '000003': 'fcmb_bank',
  '058': 'gt_bank',
  '000013': 'gt_bank',
  '030': 'heritage_bank',
  '301': 'jaiz_bank',
  '082': 'keystone_bank',
  '076': 'polaris_bank',
  '101': 'providus_bank',
  '221': 'stanbic_bank',
  '000012': 'stanbic_bank',
  '068': 'standard_chartered_bank',
  '232': 'sterling_bank',
  '000001': 'sterling_bank',
  '100': 'suntrust_bank',
  '032': 'union_bank',
  '033': 'united_bank',
  '000004': 'united_bank',
  '215': 'unity_bank',
  '057': 'zenith_bank',
  '000015': 'zenith_bank',
  '103': 'globus_bank',
  '023': 'citi_bank',
  '559': 'coronation_bank',
  '566': 'vfd_bank',
  '104': 'parrallex_bank',
  '105': 'premium_trust_bank',
  '102': 'titan_bank',
  '999992': 'opay_bank',
  '999991': 'palmpay',
  '090405': 'moniepoint_bank',
  '50211': 'kuda_bank',
  '090267': 'kuda_bank',
  '51113': 'safe_haven_bank',
  '50200': 'kredi_bank',
};

export function getBankLogo(bankName?: string | null, bankCode?: string | null): string | null {
  const name = (bankName || '').trim();

  // 1. bank code (also covers rows where the name column holds a code)
  for (const candidate of [bankCode?.trim().toUpperCase(), /^[0-9]+[A-Za-z]?$/.test(name) ? name.toUpperCase() : undefined]) {
    if (candidate && CODES[candidate] && urlByStem[CODES[candidate]]) {
      return urlByStem[CODES[candidate]];
    }
  }

  const key = normalize(name);
  if (!key) return null;

  // 2. alias
  if (ALIASES[key] && urlByStem[ALIASES[key]]) return urlByStem[ALIASES[key]];

  // 3. exact match on the logo name
  if (stemByKey[key]) return urlByStem[stemByKey[key]];

  // 4. partial match
  for (const logoKey of KEYS_BY_LENGTH) {
    if (logoKey.length >= 4 && key.includes(logoKey)) return urlByStem[stemByKey[logoKey]];
  }
  if (key.length >= 5) {
    for (const logoKey of KEYS_BY_LENGTH) {
      if (logoKey.includes(key)) return urlByStem[stemByKey[logoKey]];
    }
  }

  return null;
}
