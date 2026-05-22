import React, { useState, useEffect, useMemo } from 'react';
import { FaArrowLeft } from 'react-icons/fa';
import { CiMedicalCross } from "react-icons/ci";
import { CgSmartphoneChip } from "react-icons/cg";
import type { TFunction } from 'i18next';
import { AMMO_COLORS } from '../utils/gameData';
import { type WeaponCategory, type WeaponInfo, WEAPONS_DB, type WeaponVariant } from '../utils/WeaponsData';
import { useTranslation } from 'react-i18next';

const CATEGORIES: WeaponCategory[] = ['AR', 'SMG', 'LMG', 'MARKSMAN', 'SNIPER', 'SHOTGUN', 'PISTOL'];

const ATTACHMENT_ICONS: Record<string, string> = {
    'Barrel':        'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/Barrel_Stabilizer.svg',
    'Mag':           'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/Extended_Heavy_Mag.svg',
    'Light-Mag':     'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/Extended_Light_Mag.svg',
    'Heavy-Mag':     'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/Extended_Heavy_Mag.svg',
    'Energy-Mag':    'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/Extended_Energy_Mag.svg',
    'Sniper-Mag':    'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/Extended_Sniper_Mag.svg',
    'Shotgun-Bolt':  'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/Shotgun_Bolt.svg',
    'Optic':         'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/2x_HCOG_Bruiser.svg',
    'Stock':         'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/Standard_Stock.svg',
    'Sniper-Stock':  'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/Sniper_Stock.svg',
    'Laser-Sight':   'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/Laser_Sight.svg',
    'Razer-Sight':   'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/Laser_Sight.svg',
};

const HOPUP_ICONS: Record<string, string> = {
    'Turbocharger':          'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/Turbocharger.svg',
    'Hammerpoint Rounds':    'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/Hammerpoint_Rounds.svg',
    'Disruptor Rounds':      'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/Disruptor_Rounds.svg',
    'Kinetic Feeder':        'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/Kinetic_Feeder.svg',
    'Gun Shield Generator':  'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/Gun_Shield_Generator.svg',
    'Double Tap Trigger':    'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/Double_Tap_Trigger.svg',
    'Selectfire Receiver':   'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/Selectfire_Receiver.svg',
    'Graffiti Mod':          'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/Splatter_Rounds.svg',
    'Elite':                 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/elite.png',
    'Boosted Loader':        'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/Boosted_Loader.svg',
    'Shatter Caps':          'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/Shatter_Caps.svg',
    'Dual Shell':            'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/Dual_Shell.svg',
};

const CHARGED_ICONS: Record<string, string> = {
    'Thermite': 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/Thermite_Grenade_white.svg',
    'Amped':    'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/Shield_Cell_white.svg',
    'Frag':     'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/Frag_Grenade_White.svg',
};

const MODE_ICONS: Record<string, string> = {
    'CarePackage': 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/carepackage.svg',
    'Elite':       'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/elite.svg',
    'Akimbo':      'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/akimbo.svg',
    'Charged':     'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/charged.png',
    'HopUp':       'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/hopup.svg',
    'Shield':      'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/disruptor.svg',
    'Health':      'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/hammerpoint.svg',
    'Graffiti Mod':'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/Splatter_Rounds.svg'
};

const CATEGORY_BG: Record<WeaponCategory, string> = {
    'AR':           'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/nemesis.png',
    'SMG':          'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/r-99.png',
    'LMG':          'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/rampage.png',
    'MARKSMAN':     'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/bocek.png',
    'SNIPER':       'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/kraber.png',
    'SHOTGUN':      'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/peacekeeper.png',
    'PISTOL':       'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/wingman.png',
    'CARE_PACKAGE': 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/kraber.png'
};

const CATEGORY_IMG_SCALE: Record<string, number> = {
    'AR': 1.4, 'SMG': 1.0, 'LMG': 1.3, 'MARKSMAN': 1.1,
    'SNIPER': 1.4, 'SHOTGUN': 1.5, 'PISTOL': 0.9, 'CARE_PACKAGE': 1.0
};

// ✅ t: any → TFunction
const getTranslatedAttachment = (part: string, t: TFunction): string => {
    const map: Record<string, string> = {
        'Barrel':       t('weaponDb.attachments.barrel'),
        'Mag':          t('weaponDb.attachments.mag'),
        'Light-Mag':    t('weaponDb.attachments.lightMag'),
        'Heavy-Mag':    t('weaponDb.attachments.heavyMag'),
        'Energy-Mag':   t('weaponDb.attachments.energyMag'),
        'Sniper-Mag':   t('weaponDb.attachments.sniperMag'),
        'Shotgun-Bolt': t('weaponDb.attachments.shotgunBolt'),
        'Optic':        t('weaponDb.attachments.optic'),
        'Stock':        t('weaponDb.attachments.stock'),
        'Sniper-Stock': t('weaponDb.attachments.sniperStock'),
        'Laser-Sight':  t('weaponDb.attachments.laserSight'),
        'Razer-Sight':  t('weaponDb.attachments.razerSight'),
    };
    return map[part] || part.replace(/-/g, ' ').replace('Mag', '').trim();
};

const getTranslatedHopup = (hopup: string, t: TFunction): string => {
    const map: Record<string, string> = {
        'Turbocharger':         t('weaponDb.hopups.turbocharger'),
        'Hammerpoint Rounds':   t('weaponDb.hopups.hammerpointRounds'),
        'Disruptor Rounds':     t('weaponDb.hopups.disruptorRounds'),
        'Kinetic Feeder':       t('weaponDb.hopups.kineticFeeder'),
        'Gun Shield Generator': t('weaponDb.hopups.gunShieldGenerator'),
        'Double Tap Trigger':   t('weaponDb.hopups.doubleTapTrigger'),
        'Selectfire Receiver':  t('weaponDb.hopups.selectfireReceiver'),
        'Graffiti Mod':         t('weaponDb.hopups.graffitiMod'),
        'Elite':                t('weaponDb.hopups.elite'),
        'Boosted Loader':       t('weaponDb.hopups.boostedLoader'),
        'Shatter Caps':         t('weaponDb.hopups.shatterCaps'),
        'Dual Shell':           t('weaponDb.hopups.dualShell'),
    };
    return map[hopup] || hopup.replace(' Rounds', '').replace(' Generator', '').replace(' Receiver', '');
};

const getChargedName = (weaponId: string, t: TFunction): string => {
    if (weaponId.includes('rampage'))  return t('weaponDb.consumables.thermite');
    if (weaponId.includes('sentinel')) return t('weaponDb.consumables.amped');
    if (weaponId.includes('bocek'))    return t('weaponDb.consumables.frag');
    return 'Charged';
};

const getAmmoIconSrc = (ammoType: string, category: string): string => {
    const base = 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/attachments/';
    const type = ammoType.toLowerCase();
    if (type === 'mythic') {
        if (category === 'SNIPER' || category === 'MARKSMAN') return `${base}mythic_sniper.svg`;
        if (category === 'SHOTGUN') return `${base}mythic_shotgun.svg`;
        return `${base}mythic_light.svg`;
    }
    return `${base}${type}.svg`;
};

const getWeaponVariants = (baseWeapon: WeaponInfo): WeaponInfo[] => {
    return WEAPONS_DB.filter(w =>
        w.baseId === baseWeapon.id || w.id === baseWeapon.id
    );
};

const getChargedId = (weaponId: string): string => {
    if (weaponId.includes('rampage'))  return 'Thermite';
    if (weaponId.includes('sentinel')) return 'Amped';
    if (weaponId.includes('bocek'))    return 'Frag';
    return 'Charged';
};

const getThemeStyles = (ammoTypes: string[], variant: WeaponVariant) => {
    if (variant === 'CARE_PACKAGE') {
        const c1 = AMMO_COLORS['Mythic'];
        return {
            borderColor: c1,
            listCardBg: '#252525',
            detailCardBg: `linear-gradient(135deg, #202020 0%, #2b1111 100%)`,
            activeBtnBg: `linear-gradient(90deg, ${c1}44, ${c1}22)`
        };
    }
    if (variant === 'ELITE') {
        const c1 = '#FFD700';
        const c2 = '#FFA500';
        return {
            borderColor: c1,
            listCardBg: `linear-gradient(145deg, #252525 40%, ${c1}15 70%, ${c2}15 100%)`,
            detailCardBg: `linear-gradient(135deg, #202020 0%, ${c1}22 50%, ${c2}11 100%)`,
            activeBtnBg: `linear-gradient(90deg, ${c1}44, ${c2}44)`
        };
    }
    if (ammoTypes.length > 1) {
        const c1 = AMMO_COLORS[ammoTypes[0]];
        const c2 = AMMO_COLORS[ammoTypes[1]];
        return {
            borderColor: c1,
            listCardBg: `linear-gradient(145deg, #252525 40%, ${c1}15 70%, ${c2}15 100%)`,
            detailCardBg: `linear-gradient(135deg, #202020 0%, ${c1}11 50%, ${c2}11 100%)`,
            activeBtnBg: `linear-gradient(90deg, ${c1}33, ${c2}33)`
        };
    }
    const color = AMMO_COLORS[ammoTypes[0]] || '#ccc';
    return {
        borderColor: color,
        listCardBg: `linear-gradient(145deg, #252525 50%, ${color}11 100%)`,
        detailCardBg: `linear-gradient(135deg, #202020 0%, ${color}1a 100%)`,
        activeBtnBg: `linear-gradient(90deg, ${color}33, ${color}11)`
    };
};

const INJECTED_STYLES = `
    .weapon-card { border: 1px solid #333; transition: all 0.2s ease-in-out; }
    .weapon-card:hover { background: #2f2f2f !important; transform: translateY(-4px); box-shadow: 0 10px 20px rgba(0,0,0,0.4); border-color: var(--hover-color) !important; }
    .weapon-card:hover .card-img { transform: scale(calc(var(--hover-scale) * 1.05)) rotate(-2deg) translateX(-5px); }

    .ammo-icon { width: 20px; height: 20px; object-fit: contain; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.8)); margin-right: 4px; }
    .ammo-icon-lg { width: 32px; height: 32px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8)); }

    .mode-icon-img {
        width: 18px; height: 18px; object-fit: contain; margin-right: 6px;
        filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5)) invert(1);
        vertical-align: middle;
    }
    .toggle-icon-img { width: 14px; height: 14px; object-fit: contain; margin-right: 4px; vertical-align: middle; filter: invert(1); }

    .attachment-box {
        background: #444;
        border: 1px solid #444;
        border-radius: 6px;
        padding: 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 60px;
        height: 60px;
        position: relative;
        transition: 0.2s;
    }
    .attachment-box:hover { background: #333; border-color: #666; transform: translateY(-2px); }
    .attachment-img {
        width: 32px; height: 32px; object-fit: contain;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));
        margin-bottom: 4px;
    }
    .attachment-label {
        font-size: 9px; color: #888; text-transform: uppercase;
        text-align: center; width: 100%;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    .variant-switch { position: absolute; top: 15px; right: 15px; z-index: 10; display: flex; gap: 5px; }
    .vs-btn {
        font-size: 11px; font-weight: bold; background: rgba(0,0,0,0.6);
        border: 1px solid #444; border-radius: 4px; padding: 4px 8px;
        cursor: pointer; backdrop-filter: blur(4px); transition: 0.2s;
        color: #888; display: flex; align-items: center;
    }
    .vs-btn:hover { background: #444; color: #fff; }
    .vs-btn.active { background: #ff4757; color: #fff; border-color: #ff4757; box-shadow: 0 0 10px rgba(255,71,87,0.4); }
    .vs-btn.active-elite { background: #FFD700; color: #000; border-color: #FFD700; box-shadow: 0 0 10px rgba(255,215,0,0.4); }

    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: #1a1a1a; }
    ::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #666; }
`;

type InternalMode = 'Base' | 'Charged' | 'HopUp' | 'Shield' | 'Health' | 'Graffiti Mod';

interface ModeOption {
    mode: InternalMode;
    id: string;
    label: string;
}

// ✅ 타입 정의
interface StatBoxProps {
    label: string;
    value: string | number;
    highlight?: boolean;
    color?: string;
    span?: string;
}

interface MagBoxProps {
    label: string;
    value: number;
    color: string;
}

const StatBox = ({ label, value, highlight = false, color = '#eee', span }: StatBoxProps) => (
    <div style={{ background: '#1a1a1a', padding: '12px', borderRadius: '6px', border: '1px solid #333' }}>
        <div style={{ fontSize: '11px', color: '#777', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
        <div style={{ fontSize: '22px', fontWeight: '800', color: highlight ? color : '#ddd' }}>
            {value} <span style={{ fontSize: '15px', fontWeight: 'normal', color: '#777' }}>{span ?? ''}</span>
        </div>
    </div>
);

const MagBox = ({ label, value, color }: MagBoxProps) => (
    <div style={{ flex: 1, background: '#1a1a1a', padding: '8px', borderRadius: '4px', borderTop: `4px solid ${color}`, textAlign: 'center' }}>
        <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>{label}</div>
        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#eee' }}>{value}</div>
    </div>
);

const renderModeIcon = (id: string, className: string = 'mode-icon-img') => {
    const src = MODE_ICONS[id] || HOPUP_ICONS[id] || CHARGED_ICONS[id];
    if (!src) return null;
    return <img src={src} alt={id} className={className} />;
};

const FALLBACK_IMG = 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/unknown.png';

const WeaponsTab = () => {
    const { t } = useTranslation();
    const [selectedCategory, setSelectedCategory] = useState<WeaponCategory | null>(null);
    const [selectedBaseWeapon, setSelectedBaseWeapon] = useState<WeaponInfo | null>(null);
    const [currentVariant, setCurrentVariant] = useState<WeaponInfo | null>(null);
    const [internalMode, setInternalMode] = useState<InternalMode>('Base');

    useEffect(() => {
        if (selectedBaseWeapon) {
            const variants = getWeaponVariants(selectedBaseWeapon);
            const standard = variants.find(v => v.variant === 'STANDARD') || variants[0];
            setCurrentVariant(standard);
            setInternalMode('Base');
        } else {
            setCurrentVariant(null);
        }
    }, [selectedBaseWeapon]);

    const isCarCP = currentVariant?.id === 'car_cp';

    // ✅ internalMode 의존성 제거 → 무한루프 방지
    useEffect(() => {
        if (isCarCP) setInternalMode('Shield');
    }, [isCarCP]);

    // ✅ useMemo로 상단 이동
    const filteredWeapons = useMemo(() =>
        WEAPONS_DB.filter(w => w.category === selectedCategory && w.variant === 'STANDARD'),
    [selectedCategory]);

    // ── 카테고리 선택 화면 ──────────────────────────────────────
    if (!selectedCategory) {
        const topRow = CATEGORIES.slice(0, 4);
        const bottomRow = CATEGORIES.slice(4, 7);

        const renderCategoryButton = (cat: WeaponCategory) => {
            let hoverColor = '#eee';
            if (cat === 'SNIPER')   hoverColor = AMMO_COLORS['Mythic'];
            else if (cat === 'SHOTGUN')  hoverColor = AMMO_COLORS['Shotgun'];
            else if (cat === 'LMG')      hoverColor = AMMO_COLORS['Heavy'];
            else if (cat === 'SMG')      hoverColor = AMMO_COLORS['Light'];
            else if (cat === 'AR')       hoverColor = AMMO_COLORS['Energy'];
            else if (cat === 'PISTOL')   hoverColor = AMMO_COLORS['Sniper'];
            else if (cat === 'MARKSMAN') hoverColor = AMMO_COLORS['Arrows'];

            const baseScale = CATEGORY_IMG_SCALE[cat] || 1.0;

            return (
                <div
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className="weapon-card"
                    style={{
                        '--hover-color': hoverColor,
                        '--hover-scale': baseScale,
                        background: '#252525',
                        width: '23.5%', height: '130px', borderRadius: '12px',
                        position: 'relative', overflow: 'hidden', cursor: 'pointer', flexShrink: 0
                    } as React.CSSProperties}
                >
                    <div style={{ position: 'absolute', left: '25px', top: '50%', transform: 'translateY(-50%)', zIndex: 10, textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
                        <div style={{ fontSize: '24px', fontWeight: '700', color: '#eee', letterSpacing: '0.5px' }}>{cat}</div>
                        <div style={{ fontSize: '11px', color: hoverColor, marginTop: '4px', fontWeight: '600' }}>{t('weapons.viewList')}</div>
                    </div>
                    <div style={{ position: 'absolute', right: '-10px', top: '50%', transform: 'translateY(-50%)', width: '65%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
                        <img className="card-img" src={CATEGORY_BG[cat]} alt={cat} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', transform: `scale(${baseScale})`, transition: 'transform 0.3s ease', filter: 'drop-shadow(0 5px 15px rgba(0,0,0,0.7))' }} />
                    </div>
                    <div style={{ position: 'absolute', right: '-10%', bottom: '-20%', width: '80%', height: '100%', background: `radial-gradient(circle, ${hoverColor}15 0%, transparent 70%)`, zIndex: 1, pointerEvents: 'none' }} />
                </div>
            );
        };

        return (
            <>
                <style>{INJECTED_STYLES}</style>
                <div style={{ width: '100%', height: '100%', background: '#181818', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <div style={{ width: '95%', maxWidth: '1200px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>{topRow.map(renderCategoryButton)}</div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '2%' }}>{bottomRow.map(renderCategoryButton)}</div>
                    </div>
                </div>
            </>
        );
    }

    // ── 무기 상세 화면 ──────────────────────────────────────────
    if (selectedBaseWeapon && currentVariant) {
        const allVariants = getWeaponVariants(selectedBaseWeapon);
        const standardVariant = allVariants.find(v => v.variant === 'STANDARD');
        const akimboVariant   = allVariants.find(v => v.variant === 'AKIMBO');
        const cpVariant       = allVariants.find(v => v.variant === 'CARE_PACKAGE');
        const eliteVariant    = allVariants.find(v => v.variant === 'ELITE');

        const stats      = currentVariant.stats;
        const theme      = getThemeStyles(currentVariant.ammoType, currentVariant.variant);
        const themeColor = theme.borderColor;
        const hopup_point = currentVariant.hopup_point;

        const internalModes: ModeOption[] = [];

        if (isCarCP) {
            internalModes.push({ mode: 'Shield', id: 'Disruptor Rounds',   label: t('weapons.disruptor') });
            internalModes.push({ mode: 'Health', id: 'Hammerpoint Rounds', label: t('weapons.hammerpoint') });
        } else {
            if (stats.dmg)        internalModes.push({ mode: 'Base',        id: 'Standard',                    label: t('weapons.standard') });
            if (stats.charged_dmg) internalModes.push({ mode: 'Charged',    id: getChargedId(currentVariant.id), label: getChargedName(currentVariant.id, t) });
            if (stats.hopup_dmg) {
                const hopupId = currentVariant.hopup?.[0] ?? 'Hop-Up';
                internalModes.push({ mode: 'HopUp', id: hopupId, label: getTranslatedHopup(hopupId, t) });
            }
            if (stats.health_dmg)   internalModes.push({ mode: 'Health',      id: 'Hammerpoint Rounds', label: t('weapons.hammerpoint') });
            if (stats.shield_dmg)   internalModes.push({ mode: 'Shield',      id: 'Disruptor Rounds',   label: t('weapons.disruptor') });
            if (stats.hopup_magSize) internalModes.push({ mode: 'Graffiti Mod', id: 'Graffiti Mod',      label: t('weapons.graffiti') });
        }

        let d  = stats.dmg;
        let hp = hopup_point ?? 0;

        if (internalMode === 'Charged'     && stats.charged_dmg) { d = stats.charged_dmg; hp = hopup_point ?? 0; }
        if (internalMode === 'HopUp') {
            if (stats.hopup_dmg) d = stats.hopup_dmg;
            if (hopup_point)     hp = hopup_point;
        }
        if (internalMode === 'Shield' && stats.shield_dmg) d = stats.shield_dmg;
        if (internalMode === 'Health' && stats.health_dmg) d = stats.health_dmg;

        let mag = stats.magSize;
        if (internalMode === 'Graffiti Mod' && stats.hopup_magSize) mag = stats.hopup_magSize;

        const switchVariant = (target: WeaponInfo | undefined) => {
            if (target) {
                setCurrentVariant(target);
                setInternalMode('Base');
            }
        };

        const renderAttachment = (partName: string) => {
            const iconSrc     = ATTACHMENT_ICONS[partName];
            const displayName = getTranslatedAttachment(partName, t);
            return (
                <div key={partName} className="attachment-box" title={displayName}>
                    {iconSrc
                        ? <img src={iconSrc} alt={partName} className="attachment-img" />
                        : <div style={{ width: '32px', height: '32px', background: '#444', borderRadius: '4px', marginBottom: '4px' }} />
                    }
                    <div className="attachment-label">{displayName}</div>
                </div>
            );
        };

        const renderHopUp = (hopupName: string, isMythic: boolean = false) => {
            const iconSrc     = HOPUP_ICONS[hopupName] || MODE_ICONS['HopUp'];
            const borderColor = isMythic ? '#ff5252' : '#ffb74d';
            const labelColor  = isMythic ? '#ff5252' : '#ffb74d';
            const displayName = getTranslatedHopup(hopupName, t);
            return (
                <div key={hopupName} className="attachment-box" title={displayName} style={{ borderColor }}>
                    <img src={iconSrc} alt={hopupName} className="attachment-img" />
                    <div className="attachment-label" style={{ color: labelColor }}>{displayName}</div>
                </div>
            );
        };

        return (
            <div style={{ width: '100%', height: 'auto', background: '#181818' }}>
                <style>{INJECTED_STYLES}</style>
                <div style={{ padding: '30px', height: '100%', overflowY: 'auto', color: '#eee' }}>
                    <button
                        onClick={() => setSelectedBaseWeapon(null)}
                        className="apex-btn"
                        style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '5px', background: 'transparent', border: '1px solid #444', padding: '8px 16px', cursor: 'pointer', color: '#bbb' }}
                    >
                        <FaArrowLeft />
                    </button>

                    <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
                        {/* 왼쪽 — 무기 이미지 & 변형 선택 */}
                        <div style={{ flex: 1, minWidth: '300px' }}>
                            <div style={{
                                background: theme.detailCardBg, borderRadius: '12px', padding: '30px',
                                border: `2px solid ${themeColor}`, textAlign: 'center', marginBottom: '20px',
                                boxShadow: `0 0 25px ${themeColor}11`, position: 'relative', overflow: 'hidden'
                            }}>
                                <div className="variant-switch">
                                    {cpVariant && (
                                        <div
                                            className={`vs-btn ${currentVariant.variant === 'CARE_PACKAGE' ? 'active' : ''}`}
                                            onClick={() => switchVariant(currentVariant.variant === 'CARE_PACKAGE' ? standardVariant : cpVariant)}
                                        >
                                            <CiMedicalCross /> {t('weapons.cp')}
                                        </div>
                                    )}
                                    {eliteVariant && (
                                        <div
                                            className={`vs-btn ${currentVariant.variant === 'ELITE' ? 'active-elite' : ''}`}
                                            onClick={() => switchVariant(currentVariant.variant === 'ELITE' ? standardVariant : eliteVariant)}
                                        >
                                            <CgSmartphoneChip /> {t('weapons.elite')}
                                        </div>
                                    )}
                                </div>

                                <img
                                    src={currentVariant.image}
                                    alt={currentVariant.name()}
                                    style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain', filter: 'drop-shadow(0 5px 10px rgba(0,0,0,0.5))', position: 'relative', zIndex: 2 }}
                                    onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }}
                                />
                                <h1 style={{ marginTop: '20px', fontSize: '32px', color: themeColor, textTransform: 'uppercase', letterSpacing: '1px', position: 'relative', zIndex: 2 }}>
                                    {currentVariant.name()}
                                </h1>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '15px', position: 'relative', zIndex: 2 }}>
                                    {currentVariant.ammoType.map(ammo => (
                                        <img key={ammo} src={getAmmoIconSrc(ammo, currentVariant.category)} alt={ammo} className="ammo-icon-lg" />
                                    ))}
                                </div>
                            </div>

                            {/* 아킴보 토글 */}
                            {akimboVariant && standardVariant && currentVariant.variant !== 'CARE_PACKAGE' && (
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                                    <button
                                        onClick={() => switchVariant(standardVariant)}
                                        style={{ flex: 1, padding: '10px', borderRadius: '6px', cursor: 'pointer', border: `1px solid ${currentVariant.variant === 'STANDARD' ? themeColor : '#444'}`, background: currentVariant.variant === 'STANDARD' ? theme.activeBtnBg : '#252525', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        {t('weapons.standard')}
                                    </button>
                                    <button
                                        onClick={() => switchVariant(akimboVariant)}
                                        style={{ flex: 1, padding: '10px', borderRadius: '6px', cursor: 'pointer', border: `1px solid ${currentVariant.variant === 'AKIMBO' ? themeColor : '#444'}`, background: currentVariant.variant === 'AKIMBO' ? theme.activeBtnBg : '#252525', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        {renderModeIcon('Akimbo')} {t('weapons.akimbo')}
                                    </button>
                                </div>
                            )}

                            {/* 내부 모드 토글 */}
                            {internalModes.length > 1 && (
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                                    {internalModes.map((m) => {
                                        const isActive = internalMode === m.mode;
                                        let btnColor = isActive ? themeColor : '#444';
                                        if (m.mode === 'Shield')      btnColor = isActive ? '#5b9af7' : '#444';
                                        if (m.mode === 'Health')      btnColor = isActive ? '#ff4757' : '#444';
                                        if (m.mode === 'Graffiti Mod') btnColor = isActive ? '#be42f8' : '#444';

                                        return (
                                            <button
                                                key={m.mode}
                                                onClick={() => setInternalMode(m.mode)}
                                                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid', cursor: 'pointer', borderColor: btnColor, background: isActive ? theme.activeBtnBg : '#252525', color: isActive ? '#fff' : '#888', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s' }}
                                            >
                                                {renderModeIcon(m.id)}
                                                {m.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* ✅ borderLeft → borderTop */}
                            <p style={{ fontSize: '15px', color: '#bbb', fontStyle: 'italic', background: '#252525', padding: '15px', borderRadius: '8px', borderTop: `3px solid ${themeColor}` }}>
                                "{currentVariant.description() || t('weapons.noDescription')}"
                            </p>
                        </div>

                        {/* 오른쪽 — 스탯 & 부착물 */}
                        <div style={{ flex: 1.5, minWidth: '300px' }}>
                            <h3 style={{ borderBottom: `1px solid ${themeColor}66`, paddingBottom: '8px', marginBottom: '20px', color: themeColor, fontSize: '18px' }}>
                                {t('weapons.weaponStatistics')}
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '30px' }}>
                                <StatBox label={t('weapons.bodyDamage')} value={d?.body || '-'} />
                                <StatBox label={t('weapons.headshot')}   value={d?.head || '-'} highlight color={themeColor} />
                                <StatBox label={t('weapons.legDamage')}  value={d?.leg  || '-'} />
                                <StatBox label={t('weapons.unlockHopUp')} value={hp || '-'} color={themeColor} span={t('weapons.pts')} />
                            </div>

                            {mag && (
                                <>
                                    <h3 style={{ borderBottom: '1px solid #444', paddingBottom: '8px', marginBottom: '15px', fontSize: '16px' }}>{t('weapons.magSize')}</h3>
                                    <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
                                        <MagBox label={t('weapons.base')}   value={mag.lv0} color="#777" />
                                        {mag.lv1 !== undefined && <MagBox label={t('weapons.white')}  value={mag.lv1} color="#a0a0a0" />}
                                        {mag.lv2 !== undefined && <MagBox label={t('weapons.blue')}   value={mag.lv2} color="#509df5" />}
                                        {mag.lv3 !== undefined && <MagBox label={t('weapons.purple')} value={mag.lv3} color="#a65bf6" />}
                                        {mag.lv4 !== undefined && <MagBox label={t('weapons.gold')}   value={mag.lv4} color="#f1c40f" />}
                                    </div>
                                </>
                            )}

                            <h3 style={{ borderBottom: '1px solid #444', paddingBottom: '8px', marginBottom: '15px', fontSize: '16px' }}>{t('weapons.compatibility')}</h3>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {currentVariant.attachments.map(part => renderAttachment(part))}
                                {currentVariant.hopup?.map(h => renderHopUp(h, false))}
                                {currentVariant.care_hopup?.map(h => renderHopUp(h, true))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── 무기 목록 화면 ──────────────────────────────────────────
    return (
        <div style={{ width: '100%', height: '100%', background: '#181818' }}>
            <style>{INJECTED_STYLES}</style>
            <div style={{ padding: '30px', height: '100%', overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className="apex-btn"
                        style={{ marginRight: '15px', padding: '5px 12px', background: 'transparent', border: '1px solid #666', cursor: 'pointer' }}
                    >
                        <FaArrowLeft style={{ color: '#fff' }} />
                    </button>
                    <h2 style={{ margin: 0, color: '#eee', fontSize: '24px' }}>
                        {selectedCategory} <span style={{ fontSize: '16px', color: '#666' }}>{t('weapons.weapons')}</span>
                    </h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
                    {filteredWeapons.map(weapon => {
                        const theme    = getThemeStyles(weapon.ammoType, 'STANDARD');
                        const isMythic = weapon.ammoType[0] === 'Mythic';

                        return (
                            <div
                                key={weapon.id}
                                onClick={() => setSelectedBaseWeapon(weapon)}
                                className="weapon-card"
                                style={{
                                    '--hover-color': theme.borderColor,
                                    '--hover-scale': 1.1,
                                    // ✅ borderLeft → borderTop
                                    background: theme.listCardBg,
                                    height: '140px',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    borderRadius: '8px', cursor: 'pointer',
                                    borderTop: `4px solid ${theme.borderColor}`,
                                    position: 'relative', overflow: 'hidden'
                                } as React.CSSProperties}
                            >
                                <img
                                    className="card-img"
                                    src={weapon.image}
                                    alt={weapon.name()}
                                    style={{ maxHeight: '60px', maxWidth: '80%', objectFit: 'contain', marginBottom: '10px', transition: 'transform 0.3s' }}
                                />
                                <span style={{ fontSize: '16px', fontWeight: 'bold', color: isMythic ? '#ff4757' : '#eee' }}>
                                    {weapon.name()}
                                </span>
                                <div style={{ display: 'flex', marginTop: '5px', gap: '4px' }}>
                                    {weapon.ammoType.map(ammo => (
                                        <img key={ammo} src={getAmmoIconSrc(ammo, weapon.category)} alt={ammo} className="ammo-icon" />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default WeaponsTab;