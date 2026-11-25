/**
 * Third-party assets and libraries shipped in the app, shown under Settings > App info > Open-source licenses.
 * Keep in sync with THIRD_PARTY_NOTICES.md (a test checks that every react-icons set imported in src is listed).
 */
export interface CreditEntry {
    name: string;
    url: string;
    license: string;
    licenseUrl: string;
    /** Authors / what is used / modifications. Proper nouns, not translated. */
    note?: string;
}

/**
 * Game Icons authors, verified against the game-icons/icons repository (folder = author) by matching path data.
 * Playstyle watermarks: src/assets/playstyleIcons.ts; also GiCrossedSwords (CombatLog), GiBullets/GiGunshot (Sidebar).
 */
export const GAME_ICON_AUTHORS: Record<string, string[]> = {
    Lorc: ['crown', 'crossed-swords', 'ankh', 'lightning-arc', 'trophy', 'broken-shield', 'broken-heart', 'crosshair-arrow', 'reaper-scythe', 'sword-clash', 'robot-golem', 'tombstone', 'spyglass', 'high-five', 'bullets', 'gunshot'],
    Delapouite: ['crosshair', 'star-medal', 'wave-surfer', 'peace-dove', 'backpack', 'atlas', 'angry-eyes', 'broom', 'shaking-hands', 'military-fort', 'life-bar', 'flag-objective', 'sitting-dog', 'rat', 'delivery-drone', 'photo-camera'],
    Sbed: ['falling', 'ammo-box'],
    'Carl Olsen': ['flame'],
    Aussiesim: ['card-ace-spades'],
    DarkZaitzev: ['hooded-assassin'],
    'John Colburn': ['pistol-gun'],
};

export const ICON_CREDITS: CreditEntry[] = [
    {
        name: 'Game Icons',
        url: 'https://game-icons.net',
        license: 'CC BY 3.0',
        licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
        note: `Icons by ${Object.keys(GAME_ICON_AUTHORS).join(', ')}. Playstyle icons are recolored, resized and rotated.`,
    },
    {
        name: 'Font Awesome Free 5',
        url: 'https://fontawesome.com',
        license: 'CC BY 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
        note: 'Icons by Fonticons, Inc.',
    },
    {
        name: 'Bootstrap Icons',
        url: 'https://icons.getbootstrap.com',
        license: 'MIT',
        licenseUrl: 'https://github.com/twbs/icons/blob/main/LICENSE',
    },
    {
        name: 'Circum Icons',
        url: 'https://github.com/Klarr-Agency/Circum-Icons',
        license: 'MPL-2.0',
        licenseUrl: 'https://www.mozilla.org/en-US/MPL/2.0/',
        note: 'Unmodified; source available at the link.',
    },
    {
        name: 'css.gg',
        url: 'https://github.com/astrit/css.gg',
        license: 'MIT',
        licenseUrl: 'https://github.com/astrit/css.gg/blob/master/LICENSE',
    },
];

const mit = (name: string, url: string): CreditEntry => ({ name, url, license: 'MIT', licenseUrl: 'https://opensource.org/licenses/MIT' });

export const LIBRARY_CREDITS: CreditEntry[] = [
    mit('React', 'https://react.dev'),
    mit('react-icons', 'https://github.com/react-icons/react-icons'),
    mit('i18next / react-i18next', 'https://www.i18next.com'),
    mit('Supabase JS', 'https://github.com/supabase/supabase-js'),
    mit('Recharts', 'https://recharts.org'),
    mit('Driver.js', 'https://driverjs.com'),
    mit('html2canvas', 'https://html2canvas.hertzen.com'),
];
