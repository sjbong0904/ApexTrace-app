import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { GAME_ICON_AUTHORS, ICON_CREDITS } from '../credits';
import { PLAYSTYLE_ICON_PATHS } from '../../assets/playstyleIcons';

const SRC = resolve(__dirname, '../..');
const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
    });
const sources = walk(SRC).map((p) => readFileSync(p, 'utf8'));

/** react-icons sets that need attribution, and the credit entry that covers each. */
const SET_CREDIT: Record<string, string> = { gi: 'Game Icons', fa: 'Font Awesome Free 5', bs: 'Bootstrap Icons', ci: 'Circum Icons', cg: 'css.gg' };

describe('credits', () => {
    it('lists every react-icons set imported in src', () => {
        const used = new Set(sources.flatMap((s) => [...s.matchAll(/from ['"]react-icons\/(\w+)['"]/g)].map((m) => m[1])));
        for (const set of used) {
            expect(SET_CREDIT[set], `react-icons/${set} has no credit entry`).toBeDefined();
            expect(ICON_CREDITS.map((e) => e.name)).toContain(SET_CREDIT[set]);
        }
    });

    it('names an author for every Game Icons icon in use', () => {
        const credited = new Set(Object.values(GAME_ICON_AUTHORS).flat());
        const kebab = (n: string) => n.replace(/^Gi/, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
        const giImports = sources.flatMap((s) => [...s.matchAll(/import \{([^}]+)\} from ['"]react-icons\/gi['"]/g)].flatMap((m) => m[1].split(',').map((x) => x.trim()).filter(Boolean)));
        for (const name of giImports) expect(credited, name).toContain(kebab(name));
        // playstyleIcons.ts notes the source icon per key as `// GiName`.
        const file = readFileSync(resolve(SRC, 'assets/playstyleIcons.ts'), 'utf8');
        const noted = [...file.matchAll(/\/\/ (Gi\w+)/g)].map((m) => m[1]);
        expect(noted).toHaveLength(Object.keys(PLAYSTYLE_ICON_PATHS).length);
        for (const name of noted) expect(credited, name).toContain(kebab(name));
    });
});
