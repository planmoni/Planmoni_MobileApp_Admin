/**
 * Icons for payout plans and vaults, from assets/images/payout-icons and
 * assets/images/vault-icons.
 *
 * Payout plans are matched on `payout_plans.purpose` (e.g. "rent_service_charge").
 * Vaults are matched on the first of `budget_plans.categories` (e.g. "housing_rent"),
 * falling back to the first subcategory.
 * Plans without a usable category ("others", custom names) fall back to keywords in
 * the plan name, and finally to no icon (the UI shows a neutral placeholder).
 */

const payoutFiles = import.meta.glob<string>('../../assets/images/payout-icons/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

const vaultFiles = import.meta.glob<string>('../../assets/images/vault-icons/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

const compact = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const indexFiles = (files: Record<string, string>): Record<string, string> => {
  const index: Record<string, string> = {};
  for (const [path, url] of Object.entries(files)) {
    const stem = path.split('/').pop()!.replace(/\.png$/, '');
    index[compact(stem)] = url;
  }
  return index;
};

const payoutIndex = indexFiles(payoutFiles);
const vaultIndex = indexFiles(vaultFiles);

// slug (compacted) -> icon key (compacted file name)
const PAYOUT_ALIASES: Record<string, string> = {
  personalsalaryallowance: 'personalsalary',
  minisalarypayroll: 'minisalary',
  groceriesfood: 'groceries',
  loanrepayments: 'loans',
  loanrepayment: 'loans',
  rentservicecharge: 'rent',
  onlinesubscriptions: 'subscriptionservice',
  subscriptionservices: 'subscriptionservice',
  internetanddata: 'internetdata',
  familysupport: 'familysupport',
};

const VAULT_ALIASES: Record<string, string> = {
  housingrent: 'housing',
  airtravel: 'airandtravel',
  clothingfashion: 'clothing',
  vehicles: 'vehicle',
  giftsceremonies: 'gifts',
  datacommunication: 'datacommunications',
  ittechnology: 'ittechnologies',
  businessutilities: 'businessutilitybills',
  infrastructuretax: 'taxes',
  businesstaxeslicenses: 'businesstaxes',
  utilitiesbills: 'utilitybills',
  businesssubscriptions: 'businesssubcriptions',
  legalservices: 'legalservice',
  legalservicesbusiness: 'legalservice',
  marketingadvertising: 'marketingadvertisement',
  researchanddevelopment: 'researchdevelopment',
  sportsandfitness: 'sportsfitness',
  foodanddrinks: 'fooddrinks',
};

// Keywords in a plan/vault name -> icon key, used when there is no usable category.
const PAYOUT_KEYWORDS: Array<[RegExp, string]> = [
  [/\bmini.?salary\b|\bpayroll\b/i, 'minisalary'],
  [/\bsalary\b|\ballowance\b/i, 'personalsalary'],
  [/\btransport|\bfuel\b|\btaxi\b|\bbus fare\b|\buber\b|\bbolt\b/i, 'transportation'],
  [/\bgrocer|\bfood\b/i, 'groceries'],
  [/\brent\b|\bservice charge\b/i, 'rent'],
  [/\binternet\b|\bdata\b|\bwifi\b/i, 'internetdata'],
  [/\butilit|\belectric|\bbills?\b/i, 'utilitybills'],
  [/\bsubscription|\bnetflix\b|\bspotify\b/i, 'subscriptionservice'],
  [/\bloans?\b|\bdebt\b/i, 'loans'],
  [/\bfamily\b|\bmom\b|\bdad\b|\bparents?\b/i, 'familysupport'],
  [/\bpersonal care\b|\bsalon\b|\bbarber\b|\bhair\b/i, 'personalcare'],
  [/\bcommitments?\b/i, 'commitments'],
  [/\bcontribution|\bajo\b|\besusu\b/i, 'contribution'],
];

const VAULT_KEYWORDS: Array<[RegExp, string]> = [
  [/\brent\b|\bhouse\b|\bapartment\b|\bhousing\b|\bproperty\b|\bplot\b|\bland\b/i, 'housing'],
  [/\bschool\b|\btuition\b|\beducation\b|\bfees?\b|\bexams?\b/i, 'education'],
  [/\btravel|\btrip\b|\bflight|\bvacation\b|\bholiday|\bvisa\b|\brelocat/i, 'airandtravel'],
  [/\bfood\b|\bgroceries\b|\brestaurant|\bchow\b/i, 'food'],
  [/\bbusiness\b|\bstart.?up\b|\bcapital\b/i, 'businessservices'],
  [/\bsaving|\bemergency\b|\binvest|\breserves?\b|\bgoals?\b/i, 'financialgoals'],
  [/\bcar\b|\bvehicle|\bmotor\b|\bauto\b/i, 'vehicle'],
  [/\bhealth|\bmedical\b|\bhospital\b|\bmeds\b|\bdrugs?\b/i, 'healthcare'],
  [/\bloans?\b|\bdebt\b|\bdept\b/i, 'debtpayments'],
  [/\bgifts?\b|\bbirthday\b|\bwedding\b|\bburial\b|\bceremon/i, 'gifts'],
  [/\bbaby\b|\bchild|\bkids?\b/i, 'childcare'],
  [/\butilit|\bbills?\b|\belectric/i, 'utilitybills'],
  [/\bfuel\b|\btransport|\bcommute\b/i, 'transportation'],
  [/\bdata\b|\binternet\b/i, 'datacommunications'],
  [/\btax/i, 'taxes'],
  [/\bcloth|\bfashion\b|\bshoes?\b/i, 'clothing'],
  [/\bphone\b|\blaptop\b|\bgadget|\bshopping\b/i, 'shopping'],
  [/\binsurance\b/i, 'insurance'],
  [/\bpets?\b/i, 'petcare'],
];

const lookupSlug = (
  slug: string | null | undefined,
  index: Record<string, string>,
  aliases: Record<string, string>
): string | null => {
  if (!slug) return null;
  const key = compact(slug);
  if (!key) return null;

  const aliased = aliases[key];
  if (aliased && index[aliased]) return index[aliased];
  if (index[key]) return index[key];

  // tolerate simple plural / suffix differences ("vehicles" vs "vehicle")
  if (key.endsWith('s') && index[key.slice(0, -1)]) return index[key.slice(0, -1)];
  if (index[`${key}s`]) return index[`${key}s`];

  return null;
};

const lookupKeywords = (
  name: string | null | undefined,
  index: Record<string, string>,
  keywords: Array<[RegExp, string]>
): string | null => {
  if (!name) return null;
  for (const [pattern, key] of keywords) {
    if (pattern.test(name) && index[key]) return index[key];
  }
  return null;
};

export function getPayoutPlanIcon(purpose?: string | null, name?: string | null): string | null {
  const bySlug = purpose && purpose !== 'others' ? lookupSlug(purpose, payoutIndex, PAYOUT_ALIASES) : null;
  if (bySlug) return bySlug;

  // "Others: Fuel" -> look at the custom part; plain names are tried as-is
  const label = (name || '').replace(/^others?:?\s*/i, '');
  return lookupSlug(label, payoutIndex, PAYOUT_ALIASES) || lookupKeywords(label, payoutIndex, PAYOUT_KEYWORDS);
}

type VaultSubcategory = { category_id?: string; subcategory_id?: string } | string;

export function getVaultIcon(
  categories?: unknown,
  subcategories?: unknown,
  name?: string | null
): string | null {
  const cats = Array.isArray(categories) ? (categories as unknown[]) : [];
  for (const cat of cats) {
    if (typeof cat === 'string') {
      const found = lookupSlug(cat, vaultIndex, VAULT_ALIASES);
      if (found) return found;
    }
  }

  const subs = Array.isArray(subcategories) ? (subcategories as VaultSubcategory[]) : [];
  for (const sub of subs) {
    const slugs = typeof sub === 'string' ? [sub] : [sub?.category_id, sub?.subcategory_id];
    for (const slug of slugs) {
      const found = lookupSlug(slug, vaultIndex, VAULT_ALIASES);
      if (found) return found;
    }
  }

  return lookupSlug(name, vaultIndex, VAULT_ALIASES) || lookupKeywords(name, vaultIndex, VAULT_KEYWORDS);
}
