import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedsDir = join(__dirname, 'locale-seeds');
const outPath = join(__dirname, '..', 'supabase', 'migrations', '20260522110000_add_es_mx_pt_pt_languages.sql');

/** Regenerate full SQL upsert migration (optional; prefer npm run seed:languages). */
const NEW_PACKS = [
    { lang: 'es-mx', display_name: 'Español (México)', file: 'es-mx.json' },
    { lang: 'pt-pt', display_name: 'Português (Portugal)', file: 'pt-pt.json' },
];

let sql = '-- Regional locales: es-mx, pt-pt; clarify es/pt display names\n';

for (const pack of NEW_PACKS) {
    const json = readFileSync(join(seedsDir, pack.file), 'utf8');
    const tag = `lng_${pack.lang.replace(/-/g, '_')}`;
    sql += `select upsert_language_pack('${pack.lang}', '${pack.display_name.replace(/'/g, "''")}', $${tag}$${json}$${tag}$::jsonb, false, 1);\n`;
}

sql += `update public.languages set display_name = 'Español (España)' where lang = 'es';\n`;
sql += `update public.languages set display_name = 'Português (Brasil)' where lang = 'pt';\n`;

writeFileSync(outPath, sql);
console.log(`Wrote ${outPath} (${sql.length} bytes)`);
