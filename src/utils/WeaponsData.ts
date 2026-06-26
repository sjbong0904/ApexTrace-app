// src/utils/WeaponsData.ts

// 🌟 다국어 사전 임포트 (i18next의 전역 인스턴스 사용)
import i18n from '../i18n';

export type WeaponCategory = 'AR' | 'SMG' | 'LMG' | 'MARKSMAN' | 'SNIPER' | 'SHOTGUN' | 'PISTOL' | 'CARE_PACKAGE';
export type WeaponVariant = 'STANDARD' | 'AKIMBO' | 'CARE_PACKAGE' | 'ELITE';

// 레벨별 수치 (공용)
export interface LevelStats {
    lv0: number; // Base
    lv1?: number; // White
    lv2?: number; // Blue
    lv3?: number; // Purple
    lv4?: number; // Gold
}

export interface WeaponStats {
    // === [1] 기본 대미지 ===
    dmg: { body: number; head: number; leg: number }; 
    
    // 특수 상황 대미지 (내부 모드 스위칭용)
    charged_dmg?: { body: number; head: number; leg: number };
    hopup_dmg?: { body: number; head: number; leg: number };
    shield_dmg?: { body: number; head: number; leg: number };
    health_dmg?: { body: number; head: number; leg: number };

    // === [2] DPS ===
    dps?: number; 
    
    // 부착물/모드에 따른 DPS 변화
    bolt_dps?: LevelStats;
    hopup_dps?: number;
    hopup_bolt_dps?: LevelStats;
    
    charged_dps?: number;
    shield_dps?: number;
    health_dps?: number;

    // === [3] 탄창 ===
    magSize: LevelStats;            
    hopup_magSize?: LevelStats;
}

export interface WeaponInfo {
    id: string;
    baseId?: string;
    variant: WeaponVariant;
    
    name: () => string; // 🌟 동적 번역을 위해 함수형으로 변경
    category: WeaponCategory;
    FireMods: string[];
    ammoType: string[]; 
    image: string;
    description: () => string; // 🌟 동적 번역을 위해 함수형으로 변경
    stats: WeaponStats;
    attachments: string[];
    
    hopup?: string[]; 
    care_hopup?: string[];
    hopup_point?: number; 
}

export const WEAPONS_DB: WeaponInfo[] = [
    // AR (Assault Rifles)
    {
        id: 'r-301',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.r301'),
        category: 'AR',
        ammoType: ['Light'],
        FireMods: ['Auto', 'Single'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/r-301.png',
        description: () => i18n.t('weaponDb.desc.r301'),
        stats: {
            dmg: { body: 15, head: 20, leg: 11 },
            magSize: { lv0: 21, lv1: 23, lv2: 28, lv3: 31, lv4: 31 },
        },
        attachments: ['Barrel', 'Light-Mag', 'Optic', 'Stock']
    },
    {
        id: 'flatline',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.flatline'),
        category: 'AR',
        ammoType: ['Heavy'],
        FireMods: ['Auto', 'Single'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/flatline.png',
        description: () => i18n.t('weaponDb.desc.flatline'),
        stats: {
            dmg: { body: 20, head: 26, leg: 15 },
            magSize: { lv0: 19, lv1: 23, lv2: 27, lv3: 29, lv4: 29 }
        },
        attachments: ['Heavy-Mag', 'Optic', 'Stock'],
        hopup: ['Graffiti Mod'],
        hopup_point: 400
    },
    {
        id: 'hemlok',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.hemlok'),
        category: 'AR',
        ammoType: ['Heavy'],
        FireMods: ['Burst', 'Single'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/hemlok.png',
        description: () => i18n.t('weaponDb.desc.hemlok'),
        stats: {
            dmg: { body: 20, head: 28, leg: 15 },
            magSize: { lv0: 21, lv1: 24, lv2: 27, lv3: 30, lv4: 30 }
        },
        attachments: ['Barrel', 'Heavy-Mag', 'Optic', 'Stock']
    },
    {
        id: 'hemlok_elite',
        baseId: 'hemlok',
        variant: 'ELITE',
        name: () => i18n.t('weaponDb.names.hemlok_elite'),
        category: 'AR',
        ammoType: ['Heavy'],
        FireMods: ['Auto', 'Breach'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/hemlok.png',
        description: () => i18n.t('weaponDb.desc.hemlok_elite'),
        stats: {
            dmg: { body: 22, head: 31, leg: 17 },
            charged_dmg: { body: 38, head: 38, leg: 29 },
            magSize: { lv0: 18, lv1: 21, lv2: 24, lv3: 27, lv4: 27 }
        },
        attachments: ['Suppressor', 'Heavy-Mag', 'Optic', 'Stock']
    },
    {
        id: 'havoc',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.havoc'),
        category: 'AR',
        ammoType: ['Energy'],
        FireMods: ['Auto'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/havoc.png',
        description: () => i18n.t('weaponDb.desc.havoc'),
        stats: {
            dmg: { body: 20, head: 26, leg: 15 },
            magSize: { lv0: 18, lv1: 21, lv2: 25, lv3: 29, lv4: 29 }
        },
        attachments: ['Energy-Mag', 'Optic', 'Stock'],
        hopup: ['Turbocharger'],
        hopup_point: 600
    },
    {
        id: 'nemesis',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.nemesis'),
        category: 'AR',
        ammoType: ['Energy'],
        FireMods: ['Burst'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/nemesis.png',
        description: () => i18n.t('weaponDb.desc.nemesis'),
        stats: {
            dmg: { body: 17, head: 22, leg: 13 },
            magSize: { lv0: 20, lv1: 24, lv2: 28, lv3: 32, lv4: 32 }
        },
        attachments: ['Barrel', 'Energy-Mag', 'Optic', 'Stock'],
        hopup: ['Turbocharger'],
        hopup_point: 600
    },

    // SMG
    {
        id: 'alternator',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.alternator'),
        category: 'SMG',
        ammoType: ['Light'],
        FireMods: ['Auto'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/alternator.png',
        description: () => i18n.t('weaponDb.desc.alternator'),
        stats: {
            dmg: { body: 19, head: 24, leg: 15 },
            hopup_dmg: { body: 30, head: 38, leg: 24 },
            magSize: { lv0: 20, lv1: 24, lv2: 26, lv3: 30, lv4: 30 }
        },
        attachments: ['Laser-Sight', 'Light-Mag', 'Optic', 'Stock'],
        hopup: ['Double Tap Trigger'],  
        hopup_point: 375
    },
    {
        id: 'r-99',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.r99'),
        category: 'SMG',
        ammoType: ['Light'],
        FireMods: ['Auto'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/r-99.png',
        description: () => i18n.t('weaponDb.desc.r99'),
        stats: {
            dmg: { body: 13, head: 16, leg: 10 },
            magSize: { lv0: 18, lv1: 21, lv2: 24, lv3: 27, lv4: 27 }
        },
        attachments: ['Laser-Sight', 'Light-Mag', 'Optic', 'Stock']
    },
    {
        id: 'volt',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.volt'),
        category: 'SMG',
        ammoType: ['Energy'],
        FireMods: ['Auto'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/volt.png',
        description: () => i18n.t('weaponDb.desc.volt'),
        stats: {
            dmg: { body: 15, head: 23, leg: 12 },
            magSize: { lv0: 20, lv1: 22, lv2: 24, lv3: 27, lv4: 27 },
        },
        attachments: ['Laser-Sight', 'Energy-Mag', 'Optic', 'Stock'],
        hopup: ['Graffiti Mod'],
        hopup_point: 400
    },
    {
        id: 'prowler',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.prowler'),
        category: 'SMG',
        ammoType: ['Heavy'],
        FireMods: ['Burst', 'Auto'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/prowler.png',
        description: () => i18n.t('weaponDb.desc.prowler'),
        stats: {
            dmg: { body: 16, head: 20, leg: 13 },
            hopup_dmg: { body: 17, head: 21, leg: 14 },
            magSize: { lv0: 20, lv1: 25, lv2: 30, lv3: 35, lv4: 35 }
        },
        attachments: ['Laser-Sight', 'Heavy-Mag', 'Optic', 'Stock'],
        hopup: ['Selectfire Receiver'],
        hopup_point: 375
    },
    
    // C.A.R.
    {
        id: 'car',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.car'),
        category: 'SMG',
        ammoType: ['Heavy', 'Light'], 
        FireMods: ['Auto'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/c.a.r..png',
        description: () => i18n.t('weaponDb.desc.car'),
        stats: {
            dmg: { body: 14, head: 18, leg: 11 },
            magSize: { lv0: 20, lv1: 22, lv2: 24, lv3: 27, lv4: 27 }
        },
        attachments: ['Laser-Sight', 'Heavy-Mag', 'Light-Mag', 'Optic', 'Stock'],
    },
    {
        id: 'car_cp',
        baseId: 'car',
        variant: 'CARE_PACKAGE',
        name: () => i18n.t('weaponDb.names.carCp'),
        category: 'SMG',
        ammoType: ['Mythic'], 
        FireMods: ['Auto'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/c.a.r..png',
        description: () => i18n.t('weaponDb.desc.carCp'),
        stats: {
            dmg: { body: 0, head: 0, leg: 0 },
            magSize: { lv0: 28 },
            shield_dmg: { body: 16, head: 21, leg: 13 },
            health_dmg: { body: 16, head: 20, leg: 13 },
        },
        attachments: [],
        care_hopup: ['Disruptor Rounds', 'Hammerpoint Rounds']
    },

    // LMG
    {
        id: 'devotion',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.devotion'),
        category: 'LMG',
        ammoType: ['Energy'],
        FireMods: ['Auto'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/devotion.png',
        description: () => i18n.t('weaponDb.desc.devotion'),
        stats: {
            dmg: { body: 16, head: 20, leg: 14 },
            magSize: { lv0: 36, lv1: 40, lv2: 44, lv3: 48, lv4: 48 }
        },
        attachments: ['Barrel', 'Energy-Mag', 'Optic', 'Stock'],
        hopup: ['Turbocharger'],
        hopup_point: 500
    },
    {
        id: 'spitfire',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.spitfire'),
        category: 'LMG',
        ammoType: ['Light'],
        FireMods: ['Auto'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/spitfire.png',
        description: () => i18n.t('weaponDb.desc.spitfire'),
        stats: {
            dmg: { body: 21, head: 26, leg: 18 },
            magSize: { lv0: 35, lv1: 40, lv2: 45, lv3: 50, lv4: 50 },
        },
        attachments: ['Barrel', 'Light-Mag', 'Optic', 'Stock'],
    },
    {
        id: 'rampage',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.rampage'),
        category: 'LMG',
        ammoType: ['Heavy'],
        FireMods: ['Auto'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/rampage.png',
        description: () => i18n.t('weaponDb.desc.rampage'),
        stats: {
            dmg: { body: 29, head: 36, leg: 25 },
            charged_dmg: { body: 26, head: 42, leg: 22 },
            magSize: { lv0: 28, lv1: 32, lv2: 34, lv3: 40, lv4: 40 }
        },
        attachments: ['Barrel', 'Heavy-Mag', 'Optic', 'Stock'],
    },
    {
        id: 'l-star',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.lstar'),
        category: 'LMG',
        ammoType: ['Energy'],
        FireMods: ['Auto'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/l-star.png',
        description: () => i18n.t('weaponDb.desc.lstar'),
        stats: {
            dmg: { body: 17, head: 28, leg: 14 },
            magSize: { lv0: 22, lv1: 24, lv2: 26, lv3: 28, lv4: 28 },
            hopup_magSize: { lv0: 26, lv1: 28, lv2: 30, lv3: 32, lv4: 32 },
        },
        attachments: ['Energy-Mag', 'Optic', 'Stock'],
        hopup: ['Graffiti Mod'],
        hopup_point: 400
    },
    {
        id: 'l-star_cp',
        baseId: 'l-star',
        variant: 'CARE_PACKAGE',
        name: () => i18n.t('weaponDb.names.lstarCp'),
        category: 'LMG',
        ammoType: ['Mythic'],
        FireMods: ['Auto'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/l-star.png',
        description: () => i18n.t('weaponDb.desc.lstarCp'),
        stats: {
            dmg: { body: 17, head: 28, leg: 14 },
            magSize: { lv0: 28 },
            hopup_magSize: { lv0: 32 },
        },
        attachments: [],
        care_hopup: ['Graffiti Mod'],
    },

    // MARKSMAN
    {
        id: 'tripletake',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.tripletake'),
        category: 'MARKSMAN',
        ammoType: ['Energy'],
        FireMods: ['Single'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/tripletake.png',
        description: () => i18n.t('weaponDb.desc.tripletake'),
        stats: {
            dmg: { body: 22, head: 33, leg: 20 },
            charged_dmg: { body: 66, head: 99, leg: 60 },
            magSize: { lv0: 6, lv1: 7, lv2: 8, lv3: 10, lv4: 10 }
        },
        attachments: ['Energy-Mag', 'Optic', 'Sniper-Stock']
    },
    {
        id: 'bocek',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.bocek'),
        category: 'MARKSMAN',
        ammoType: ['Arrows'],
        FireMods: ['Single'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/bocek.png',
        description: () => i18n.t('weaponDb.desc.bocek'),
        stats: {
            dmg: { body: 60, head: 90, leg: 48 },
            magSize: { lv0: 40 },
            charged_dmg: { body: 75, head: 100, leg: 60 },
        },
        attachments: ['Optic', 'Sniper-Stock'],
    },
    {
        id: 'g7scout',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.g7scout'),
        category: 'MARKSMAN',
        ammoType: ['Light'],
        FireMods: ['Single'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/g7scout.png',
        description: () => i18n.t('weaponDb.desc.g7scout'),
        stats: {
            dmg: { body: 36, head: 52, leg: 27 },
            magSize: { lv0: 10, lv1: 15, lv2: 18, lv3: 20, lv4: 20 }
        },
        attachments: ['Barrel', 'Light-Mag', 'Optic', 'Sniper-Stock']
    },
    {
        id: 'g7scout_cp',
        baseId: 'g7scout',
        variant: 'CARE_PACKAGE',
        name: () => i18n.t('weaponDb.names.g7scoutCp'),
        category: 'MARKSMAN',
        ammoType: ['Mythic'],
        FireMods: ['Single'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/g7scout.png',
        description: () => i18n.t('weaponDb.desc.g7scoutCp'),
        stats: {
            dmg: { body: 37, head: 54, leg: 28 },
            magSize: { lv0: 18 },
        },
        attachments: [],
        care_hopup: ['Double Tap Trigger']
    },
    {
        id: '30-30',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.repeater3030'),
        category: 'MARKSMAN',
        ammoType: ['Heavy'],
        FireMods: ['Single'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/30-30.png',
        description: () => i18n.t('weaponDb.desc.repeater3030'),
        stats: {
            dmg: { body: 43, head: 60, leg: 37 },
            charged_dmg: { body: 60, head: 84, leg: 51 },
            magSize: { lv0: 6, lv1: 7, lv2: 8, lv3: 10, lv4: 10 },
        },
        attachments: ['Heavy-Mag', 'Optic', 'Sniper-Stock'],
        hopup: ['Dual Shell'],
        hopup_point: 300
    },

    // SNIPER
    {
        id: 'chargerifle',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.chargerifle'),
        category: 'SNIPER',
        ammoType: ['Sniper'],
        FireMods: ['Beam'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/chargerifle.png',
        description: () => i18n.t('weaponDb.desc.chargerifle'),
        stats: {
            dmg: { body: 75, head: 135, leg: 68 },
            hopup_dmg: { body: 45, head: 81, leg: 41 },
            magSize: { lv0: 6, lv1: 7, lv2: 8, lv3: 9, lv4: 9 }
        },
        attachments: ['Sniper-Mag', 'Optic', 'Sniper-Stock'],
        hopup: ['Selectfire Receiver'],
        hopup_point: 450
    },
    {
        id: 'kraber',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.kraber'),
        category: 'SNIPER',
        ammoType: ['Mythic'],
        FireMods: ['Single'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/kraber.png',
        description: () => i18n.t('weaponDb.desc.kraber'),
        stats: {
            dmg: { body: 150, head: 210, leg: 120 },
            magSize: { lv0: 4 }
        },
        attachments: [],
        care_hopup: []
    },
    {
        id: 'sentinel',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.sentinel'),
        category: 'SNIPER',
        ammoType: ['Sniper'],
        FireMods: ['Single'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/sentinel.png',
        description: () => i18n.t('weaponDb.desc.sentinel'),
        stats: {
            dmg: { body: 70, head: 126, leg: 63 },
            magSize: { lv0: 4, lv1: 5, lv2: 6, lv3: 7, lv4: 7 },
            charged_dmg: { body: 88, head: 158, leg: 79 },
        },
        attachments: ['Sniper-Mag', 'Optic', 'Sniper-Stock']
    },
    {
        id: 'longbow',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.longbow'),
        category: 'SNIPER',
        ammoType: ['Sniper'],
        FireMods: ['Single'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/longbow.png',
        description: () => i18n.t('weaponDb.desc.longbow'),
        stats: {
            dmg: { body: 60, head: 108, leg: 48 },
            magSize: { lv0: 6, lv1: 8, lv2: 10, lv3: 12, lv4: 12 },
        },
        attachments: ['Sniper-Mag', 'Optic', 'Sniper-Stock']
    },

    // SHOTGUN
    {
        id: 'mozambique',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.mozambique'),
        category: 'SHOTGUN',
        ammoType: ['Shotgun'],
        FireMods: ['Auto'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/mozambique.png',
        description: () => i18n.t('weaponDb.desc.mozambique'),
        stats: {
            dmg: { body: 51, head: 63, leg: 51 },
            magSize: { lv0: 5 },
        },
        attachments: ['Shotgun-Bolt', 'Optic']
    },
    {
        id: 'mozambique_akimbo',
        baseId: 'mozambique',
        variant: 'AKIMBO',
        name: () => i18n.t('weaponDb.names.mozambiqueAkimbo'),
        category: 'SHOTGUN',
        ammoType: ['Shotgun'],
        FireMods: ['Auto'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/mozambique_akimbo.png',
        description: () => i18n.t('weaponDb.desc.mozambiqueAkimbo'),
        stats: {
            dmg: { body: 51, head: 63, leg: 51 },
            magSize: { lv0: 10 },
        },
        attachments: ['Shotgun-Bolt', 'Optic']
    },
    {
        id: 'mastiff',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.mastiff'),
        category: 'SHOTGUN',
        ammoType: ['Shotgun'],
        FireMods: ['Single'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/mastiff.png',
        description: () => i18n.t('weaponDb.desc.mastiff'),
        stats: {
            dmg: { body: 95, head: 95, leg: 95 },
            magSize: { lv0: 5 },
        },
        attachments: ['Shotgun-Bolt', 'Optic', 'Stock'],
        hopup: ['Executioner'],
        hopup_point: 375
    },
    {
        id: 'peacekeeper',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.peacekeeper'),
        category: 'SHOTGUN',
        ammoType: ['Shotgun'],
        FireMods: ['Single'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/peacekeeper.png',
        description: () => i18n.t('weaponDb.desc.peacekeeper'),
        stats: {
            dmg: { body: 99, head: 99, leg: 99 },
            dps: 80,
            magSize: { lv0: 5 },
        },
        attachments: ['Shotgun-Bolt', 'Optic', 'Stock'],
        hopup: ['Executioner'],
        hopup_point: 375
    },
    {
        id: 'eva-8',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.eva8'),
        category: 'SHOTGUN',
        ammoType: ['Shotgun'],
        FireMods: ['Auto'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/eva-8.png',
        description: () => i18n.t('weaponDb.desc.eva8'),
        stats: {
            dmg: { body: 56, head: 56, leg: 56 },
            magSize: { lv0: 8 },
        },
        attachments: ['Shotgun-Bolt', 'Optic', 'Stock'],
        hopup: ['Double Tap Trigger'],
        hopup_point: 375
    },

    // PISTOL
    {
        id: 'wingman',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.wingman'),
        category: 'PISTOL',
        ammoType: ['Sniper'],
        FireMods: ['Single'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/wingman.png',
        description: () => i18n.t('weaponDb.desc.wingman'),
        stats: {
            dmg: { body: 50, head: 75, leg: 45 },
            magSize: { lv0: 5, lv1: 6, lv2: 7, lv3: 8, lv4: 8 },
        },
        attachments: [ 'Razer-Sight', 'Sniper-Mag', 'Optic']
    },
    {
        id: 're-45',
        baseId: 're-45',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.re45'),
        category: 'PISTOL',
        ammoType: ['Energy'],
        FireMods: ['Burst'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/re-45.png',
        description: () => i18n.t('weaponDb.desc.re45'),
        stats: {
            dmg: { body: 12, head: 18, leg: 11 },
            magSize: { lv0: 15, lv1: 18, lv2: 21, lv3: 27, lv4: 27},
        },
        attachments: ['Laser-Sight', 'Energy-Mag', 'Optic']
    },
    {
        id: 'p2020',
        variant: 'STANDARD',
        name: () => i18n.t('weaponDb.names.p2020'),
        category: 'PISTOL',
        ammoType: ['Light'],
        FireMods: ['Single'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/p2020.png',
        description: () => i18n.t('weaponDb.desc.p2020'),
        stats: {
            dmg: { body: 24, head: 30, leg: 22 },
            magSize: { lv0: 9, lv1: 10, lv2: 11, lv3: 12, lv4: 12 },
            health_dmg: { body: 25, head: 31, leg: 23 }
        },
        attachments: ['Laser-Sight', 'Light-Mag', 'Optic'],
        hopup: ['Hammerpoint Rounds'],
        hopup_point: 425
    },
    {
        id: 'p2020_akimbo',
        baseId: 'p2020',
        variant: 'AKIMBO',
        name: () => i18n.t('weaponDb.names.p2020Akimbo'),
        category: 'PISTOL',
        ammoType: ['Light'],
        FireMods: ['Auto'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/p2020_akimbo.png',
        description: () => i18n.t('weaponDb.desc.p2020Akimbo'),
        stats: {
            dmg: { body: 24, head: 30, leg: 22 },
            magSize: { lv0: 18, lv1: 20, lv2: 22, lv3: 24, lv4: 24 },
            health_dmg: { body: 25, head: 31, leg: 23 }
        },
        attachments: ['Laser-Sight', 'Light-Mag', 'Optic'],
        hopup: ['Hammerpoint Rounds'],
        hopup_point: 425
    },
    {
        id: 'p2020_cp',
        baseId: 'p2020',
        variant: 'CARE_PACKAGE',
        name: () => i18n.t('weaponDb.names.p2020Cp'),
        category: 'PISTOL',
        ammoType: ['Mythic'],
        FireMods: ['Auto'],
        image: 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/p2020_akimbo.png',
        description: () => i18n.t('weaponDb.desc.p2020Cp'),
        stats: {
            dmg: { body: 25, head: 31, leg: 23 },
            magSize: { lv0: 26 },
        },
        attachments: [],
        care_hopup: ['Kinetic Feeder']
    },
];