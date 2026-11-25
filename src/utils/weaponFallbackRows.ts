import type { WeaponCategory, WeaponVariant, WeaponStats } from './weaponTypes';

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

export const WEAPON_FALLBACK_ROWS: WeaponRow[] = [
    // AR (Assault Rifles)
    {
        id: 'r-301',
        variant: 'STANDARD',
        nameKey: 'weaponDb.names.r301',
        category: 'AR',
        ammoType: ['Light'],
        FireMods: ['Auto', 'Single'],
        image: '/images/r-301.png',
        descKey: 'weaponDb.desc.r301',
        stats: {
            dmg: { body: 15, head: 20, leg: 11 },
            magSize: { lv0: 21, lv1: 23, lv2: 28, lv3: 31, lv4: 31 },
        },
        attachments: ['Barrel', 'Light-Mag', 'Optic', 'Stock']
    },
    {
        id: 'flatline',
        variant: 'STANDARD',
        nameKey: 'weaponDb.names.flatline',
        category: 'AR',
        ammoType: ['Heavy'],
        FireMods: ['Auto', 'Single'],
        image: '/images/flatline.png',
        descKey: 'weaponDb.desc.flatline',
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
        nameKey: 'weaponDb.names.hemlok',
        category: 'AR',
        ammoType: ['Heavy'],
        FireMods: ['Burst', 'Single'],
        image: '/images/hemlok.png',
        descKey: 'weaponDb.desc.hemlok',
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
        nameKey: 'weaponDb.names.hemlok_elite',
        category: 'AR',
        ammoType: ['Heavy'],
        FireMods: ['Auto', 'Breach'],
        image: '/images/hemlok.png',
        descKey: 'weaponDb.desc.hemlok_elite',
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
        nameKey: 'weaponDb.names.havoc',
        category: 'AR',
        ammoType: ['Energy'],
        FireMods: ['Auto'],
        image: '/images/havoc.png',
        descKey: 'weaponDb.desc.havoc',
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
        nameKey: 'weaponDb.names.nemesis',
        category: 'AR',
        ammoType: ['Energy'],
        FireMods: ['Burst'],
        image: '/images/nemesis.png',
        descKey: 'weaponDb.desc.nemesis',
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
        nameKey: 'weaponDb.names.alternator',
        category: 'SMG',
        ammoType: ['Light'],
        FireMods: ['Auto'],
        image: '/images/alternator.png',
        descKey: 'weaponDb.desc.alternator',
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
        nameKey: 'weaponDb.names.r99',
        category: 'SMG',
        ammoType: ['Light'],
        FireMods: ['Auto'],
        image: '/images/r-99.png',
        descKey: 'weaponDb.desc.r99',
        stats: {
            dmg: { body: 13, head: 16, leg: 10 },
            magSize: { lv0: 18, lv1: 21, lv2: 24, lv3: 27, lv4: 27 }
        },
        attachments: ['Laser-Sight', 'Light-Mag', 'Optic', 'Stock']
    },
    {
        id: 'volt',
        variant: 'STANDARD',
        nameKey: 'weaponDb.names.volt',
        category: 'SMG',
        ammoType: ['Energy'],
        FireMods: ['Auto'],
        image: '/images/volt.png',
        descKey: 'weaponDb.desc.volt',
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
        nameKey: 'weaponDb.names.prowler',
        category: 'SMG',
        ammoType: ['Heavy'],
        FireMods: ['Burst', 'Auto'],
        image: '/images/prowler.png',
        descKey: 'weaponDb.desc.prowler',
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
        nameKey: 'weaponDb.names.car',
        category: 'SMG',
        ammoType: ['Heavy', 'Light'], 
        FireMods: ['Auto'],
        image: '/images/c.a.r..png',
        descKey: 'weaponDb.desc.car',
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
        nameKey: 'weaponDb.names.carCp',
        category: 'SMG',
        ammoType: ['Mythic'], 
        FireMods: ['Auto'],
        image: '/images/c.a.r..png',
        descKey: 'weaponDb.desc.carCp',
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
        nameKey: 'weaponDb.names.devotion',
        category: 'LMG',
        ammoType: ['Energy'],
        FireMods: ['Auto'],
        image: '/images/devotion.png',
        descKey: 'weaponDb.desc.devotion',
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
        nameKey: 'weaponDb.names.spitfire',
        category: 'LMG',
        ammoType: ['Light'],
        FireMods: ['Auto'],
        image: '/images/spitfire.png',
        descKey: 'weaponDb.desc.spitfire',
        stats: {
            dmg: { body: 21, head: 26, leg: 18 },
            magSize: { lv0: 35, lv1: 40, lv2: 45, lv3: 50, lv4: 50 },
        },
        attachments: ['Barrel', 'Light-Mag', 'Optic', 'Stock'],
    },
    {
        id: 'rampage',
        variant: 'STANDARD',
        nameKey: 'weaponDb.names.rampage',
        category: 'LMG',
        ammoType: ['Heavy'],
        FireMods: ['Auto'],
        image: '/images/rampage.png',
        descKey: 'weaponDb.desc.rampage',
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
        nameKey: 'weaponDb.names.lstar',
        category: 'LMG',
        ammoType: ['Energy'],
        FireMods: ['Auto'],
        image: '/images/l-star.png',
        descKey: 'weaponDb.desc.lstar',
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
        nameKey: 'weaponDb.names.lstarCp',
        category: 'LMG',
        ammoType: ['Mythic'],
        FireMods: ['Auto'],
        image: '/images/l-star.png',
        descKey: 'weaponDb.desc.lstarCp',
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
        nameKey: 'weaponDb.names.tripletake',
        category: 'MARKSMAN',
        ammoType: ['Energy'],
        FireMods: ['Single'],
        image: '/images/tripletake.png',
        descKey: 'weaponDb.desc.tripletake',
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
        nameKey: 'weaponDb.names.bocek',
        category: 'MARKSMAN',
        ammoType: ['Arrows'],
        FireMods: ['Single'],
        image: '/images/bocek.png',
        descKey: 'weaponDb.desc.bocek',
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
        nameKey: 'weaponDb.names.g7scout',
        category: 'MARKSMAN',
        ammoType: ['Light'],
        FireMods: ['Single'],
        image: '/images/g7scout.png',
        descKey: 'weaponDb.desc.g7scout',
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
        nameKey: 'weaponDb.names.g7scoutCp',
        category: 'MARKSMAN',
        ammoType: ['Mythic'],
        FireMods: ['Single'],
        image: '/images/g7scout.png',
        descKey: 'weaponDb.desc.g7scoutCp',
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
        nameKey: 'weaponDb.names.repeater3030',
        category: 'MARKSMAN',
        ammoType: ['Heavy'],
        FireMods: ['Single'],
        image: '/images/30-30.png',
        descKey: 'weaponDb.desc.repeater3030',
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
        nameKey: 'weaponDb.names.chargerifle',
        category: 'SNIPER',
        ammoType: ['Sniper'],
        FireMods: ['Beam'],
        image: '/images/chargerifle.png',
        descKey: 'weaponDb.desc.chargerifle',
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
        nameKey: 'weaponDb.names.kraber',
        category: 'SNIPER',
        ammoType: ['Mythic'],
        FireMods: ['Single'],
        image: '/images/kraber.png',
        descKey: 'weaponDb.desc.kraber',
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
        nameKey: 'weaponDb.names.sentinel',
        category: 'SNIPER',
        ammoType: ['Sniper'],
        FireMods: ['Single'],
        image: '/images/sentinel.png',
        descKey: 'weaponDb.desc.sentinel',
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
        nameKey: 'weaponDb.names.longbow',
        category: 'SNIPER',
        ammoType: ['Sniper'],
        FireMods: ['Single'],
        image: '/images/longbow.png',
        descKey: 'weaponDb.desc.longbow',
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
        nameKey: 'weaponDb.names.mozambique',
        category: 'SHOTGUN',
        ammoType: ['Shotgun'],
        FireMods: ['Auto'],
        image: '/images/mozambique.png',
        descKey: 'weaponDb.desc.mozambique',
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
        nameKey: 'weaponDb.names.mozambiqueAkimbo',
        category: 'SHOTGUN',
        ammoType: ['Shotgun'],
        FireMods: ['Auto'],
        image: '/images/mozambique_akimbo.png',
        descKey: 'weaponDb.desc.mozambiqueAkimbo',
        stats: {
            dmg: { body: 51, head: 63, leg: 51 },
            magSize: { lv0: 10 },
        },
        attachments: ['Shotgun-Bolt', 'Optic']
    },
    {
        id: 'mozambique_cp',
        baseId: 'mozambique',
        variant: 'CARE_PACKAGE',
        nameKey: 'weaponDb.names.mozambiqueCp',
        category: 'SHOTGUN',
        ammoType: ['Mythic'],
        FireMods: ['Auto'],
        image: '/images/mozambique_akimbo.png',
        descKey: 'weaponDb.desc.mozambiqueCp',
        stats: {
            dmg: { body: 51, head: 63, leg: 51 },
            magSize: { lv0: 10 },
        },
        attachments: []
    },
    {
        id: 'mastiff',
        variant: 'STANDARD',
        nameKey: 'weaponDb.names.mastiff',
        category: 'SHOTGUN',
        ammoType: ['Shotgun'],
        FireMods: ['Single'],
        image: '/images/mastiff.png',
        descKey: 'weaponDb.desc.mastiff',
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
        nameKey: 'weaponDb.names.peacekeeper',
        category: 'SHOTGUN',
        ammoType: ['Shotgun'],
        FireMods: ['Single'],
        image: '/images/peacekeeper.png',
        descKey: 'weaponDb.desc.peacekeeper',
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
        nameKey: 'weaponDb.names.eva8',
        category: 'SHOTGUN',
        ammoType: ['Shotgun'],
        FireMods: ['Auto'],
        image: '/images/eva-8.png',
        descKey: 'weaponDb.desc.eva8',
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
        nameKey: 'weaponDb.names.wingman',
        category: 'PISTOL',
        ammoType: ['Sniper'],
        FireMods: ['Single'],
        image: '/images/wingman.png',
        descKey: 'weaponDb.desc.wingman',
        stats: {
            dmg: { body: 50, head: 75, leg: 45 },
            magSize: { lv0: 5, lv1: 6, lv2: 7, lv3: 8, lv4: 8 },
        },
        attachments: [ 'Razer-Sight', 'Sniper-Mag', 'Optic']
    },
    {
        id: 'wingman_akimbo',
        baseId: 'wingman',
        variant: 'AKIMBO',
        nameKey: 'weaponDb.names.wingmanAkimbo',
        category: 'PISTOL',
        ammoType: ['Heavy'],
        FireMods: ['Single'],
        image: '/images/wingman.png',
        descKey: 'weaponDb.desc.wingmanAkimbo',
        stats: {
            dmg: { body: 50, head: 75, leg: 45 },
            magSize: { lv0: 10, lv1: 12, lv2: 14, lv3: 16, lv4: 16 },
        },
        attachments: ['Razer-Sight', 'Heavy-Mag', 'Optic']
    },
    {
        id: 're-45',
        baseId: 're-45',
        variant: 'STANDARD',
        nameKey: 'weaponDb.names.re45',
        category: 'PISTOL',
        ammoType: ['Energy'],
        FireMods: ['Burst'],
        image: '/images/re-45.png',
        descKey: 'weaponDb.desc.re45',
        stats: {
            dmg: { body: 12, head: 18, leg: 11 },
            magSize: { lv0: 15, lv1: 18, lv2: 21, lv3: 27, lv4: 27},
        },
        attachments: ['Laser-Sight', 'Energy-Mag', 'Optic']
    },
    {
        id: 'p2020',
        variant: 'STANDARD',
        nameKey: 'weaponDb.names.p2020',
        category: 'PISTOL',
        ammoType: ['Light'],
        FireMods: ['Single'],
        image: '/images/p2020.png',
        descKey: 'weaponDb.desc.p2020',
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
        nameKey: 'weaponDb.names.p2020Akimbo',
        category: 'PISTOL',
        ammoType: ['Light'],
        FireMods: ['Auto'],
        image: '/images/p2020_akimbo.png',
        descKey: 'weaponDb.desc.p2020Akimbo',
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
        nameKey: 'weaponDb.names.p2020Cp',
        category: 'PISTOL',
        ammoType: ['Mythic'],
        FireMods: ['Auto'],
        image: '/images/p2020_akimbo.png',
        descKey: 'weaponDb.desc.p2020Cp',
        stats: {
            dmg: { body: 25, head: 31, leg: 23 },
            magSize: { lv0: 26 },
        },
        attachments: [],
        care_hopup: ['Kinetic Feeder']
    },
] as WeaponRow[];
