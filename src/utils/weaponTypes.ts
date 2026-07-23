export type WeaponCategory = 'AR' | 'SMG' | 'LMG' | 'MARKSMAN' | 'SNIPER' | 'SHOTGUN' | 'PISTOL' | 'CARE_PACKAGE';
export type WeaponVariant = 'STANDARD' | 'AKIMBO' | 'CARE_PACKAGE' | 'ELITE';

export interface LevelStats {
    lv0: number;
    lv1?: number;
    lv2?: number;
    lv3?: number;
    lv4?: number;
}

export interface WeaponStats {
    dmg: { body: number; head: number; leg: number };
    charged_dmg?: { body: number; head: number; leg: number };
    hopup_dmg?: { body: number; head: number; leg: number };
    shield_dmg?: { body: number; head: number; leg: number };
    health_dmg?: { body: number; head: number; leg: number };
    dps?: number;
    bolt_dps?: LevelStats;
    hopup_dps?: number;
    hopup_bolt_dps?: LevelStats;
    charged_dps?: number;
    shield_dps?: number;
    health_dps?: number;
    magSize: LevelStats;
    hopup_magSize?: LevelStats;
}

export interface WeaponInfo {
    id: string;
    baseId?: string;
    variant: WeaponVariant;
    name: () => string;
    category: WeaponCategory;
    FireMods: string[];
    ammoType: string[];
    image: string;
    description: () => string;
    stats: WeaponStats;
    attachments: string[];
    hopup?: string[];
    care_hopup?: string[];
    hopup_point?: number;
}

export type WeaponDbRow = {
    id: string;
    base_id?: string | null;
    variant: string;
    category: string;
    fire_modes?: string[] | null;
    ammo_types?: string[] | null;
    image_url?: string | null;
    stats?: WeaponStats | null;
    attachments?: string[] | null;
    hopup?: string[] | null;
    care_hopup?: string[] | null;
    hopup_point?: number | null;
    name_key: string;
    desc_key: string;
    schema_version?: number | null;
    is_active?: boolean | null;
    sort_order?: number | null;
};
