import { readFileSync, writeFileSync } from 'fs';

const src = readFileSync('src/utils/WeaponsData.ts', 'utf8');
const start = src.indexOf('export const WEAPONS_DB');
const arrStart = src.indexOf('[', start);
const arrEnd = src.lastIndexOf('];');
const arr = src.slice(arrStart, arrEnd + 1);
const body = arr
    .replace(/name:\s*\(\)\s*=>\s*i18n\.t\('([^']+)'\),/g, "nameKey: '$1',")
    .replace(/description:\s*\(\)\s*=>\s*i18n\.t\('([^']+)'\),/g, "descKey: '$1',");

const header = `import type { WeaponCategory, WeaponVariant, WeaponStats } from './weaponTypes';

export type WeaponRow = {
  id: string;
  baseId?: string;
  variant: WeaponVariant;
  category: WeaponCategory;
  FireMods: string[];
  ammoType: string[];
  image: string;
  nameKey: string;
  descKey: string;
  stats: WeaponStats;
  attachments: string[];
  hopup?: string[];
  care_hopup?: string[];
  hopup_point?: number;
};

export const WEAPON_FALLBACK_ROWS: WeaponRow[] = `;

writeFileSync('src/utils/weaponFallbackRows.ts', `${header}${body} as const satisfies readonly WeaponRow[] as unknown as WeaponRow[];\n`);
console.log('wrote rows', (body.match(/\bid:/g) || []).length);
