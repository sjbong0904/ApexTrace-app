import React, { useMemo, useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
    FaStar, FaRegStar, FaThumbtack, FaUndo, FaSkull, FaShieldAlt,
    FaRunning, FaFistRaised, FaMedal, FaCrown, FaCode, FaTrophy,
    FaGem, FaUserTag, FaFire, FaUserSecret, FaHandsHelping
} from 'react-icons/fa';
import { GiBullets, GiGunshot } from 'react-icons/gi';
import { useTranslation } from 'react-i18next';
import type { MatchHistory } from '../utils/match';
import { formatFullRankName } from '../utils/helpers';
import { getWeaponTagTheme, getLegendImageId, getWeaponImageId, type WeaponTagTier } from '../utils/weaponTheme';
import ProfileTagIcon from './ProfileTagIcon';


// ✅ 최소 타입 정의
interface UserData {
    uid: string | null;
    name?: string;
    level?: number;
    prestige?: number;
    rankName?: string;
    rankScore?: number;
    rankDiv?: number | null;
    legend?: string | null;
    role?: string;
}

interface SidebarProps {
    user: UserData;
    history: MatchHistory[];
    isFavorite: boolean;
    isPinned: boolean;
    hasPinnedUser: boolean;
    onToggleFavorite: () => void;
    onTogglePin: () => void;
    onReturnToPinned: () => void;
}

interface PlayerTag {
    label: string;
    desc: string;
    icon: React.ReactNode;
    color: string;
    score: number;
    bgGradient?: string;
    isRole?: boolean;
    glow?: string;
    themeColor?: string;
    weaponTier?: WeaponTagTier;
    shineGradient?: string;
    imageId?: string;
    imageType?: 'legend' | 'weapon';
}

interface RoleTagConfig {
    label: string;
    icon: React.ReactNode;
    bg: string;
    color: string;
    themeColor: string;
    glow: string;
    score: number;
    isRole: boolean;
}

const getDynamicGradient = (name: string): string => {
    const gradients = [
        'linear-gradient(135deg, #4158D0 0%, #C850C0 46%, #FFCC70 100%)',
        'linear-gradient(135deg, #00dbde 0%, #fc00ff 100%)',
        'linear-gradient(135deg, #f12711 0%, #f5af19 100%)',
        'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'linear-gradient(135deg, #ff0844 0%, #ffb199 100%)',
        'linear-gradient(135deg, #FDC830 0%, #F37335 100%)',
        'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)',
        'linear-gradient(135deg, #141E30 0%, #243B55 100%)',
        'linear-gradient(135deg, #870000 0%, #190A05 100%)',
        'linear-gradient(135deg, #232526 0%, #414345 100%)',
        'linear-gradient(135deg, #757F9A 0%, #D7DDE8 100%)',
        'linear-gradient(135deg, #0BA360 0%, #3CBA92 100%)',
        'linear-gradient(135deg, #5C258D 0%, #4389A2 100%)',
        'linear-gradient(135deg, #3E5151 0%, #DECBA4 100%)',
    ];
    let hash = 2166136261;
    for (let i = 0; i < name.length; i++) {
        hash ^= name.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return gradients[Math.abs(hash) % gradients.length];
};

// ✅ 아이콘을 외부 맵으로 분리
const ROLE_ICONS: Record<string, React.ReactNode> = {
    dev: <FaCode />,
    pro: <FaTrophy />,
    tester: <FaGem />,
    contributor: <FaStar />,
    default: <FaUserTag />,
};

const getRoleTagConfig = (role: string): RoleTagConfig => {
    const lower = role.toLowerCase();
    if (['dev', 'developer', 'admin'].includes(lower))
        return { label: 'DEVELOPER', icon: ROLE_ICONS.dev, bg: 'linear-gradient(110deg, #021a1c 25%, #00f2fe 50%, #021a1c 75%)', color: '#e0fbff', themeColor: '#00f2fe', glow: 'rgba(0, 242, 254, 0.7)', score: 9999, isRole: true };
    if (['pro', 'predator', 'player'].includes(lower))
        return { label: 'PRO PLAYER', icon: ROLE_ICONS.pro, bg: 'linear-gradient(110deg, #2b0505 25%, #ff0844 50%, #2b0505 75%)', color: '#ffebef', themeColor: '#ff0844', glow: 'rgba(255, 8, 68, 0.7)', score: 9999, isRole: true };
    if (['tester', 'test', 'alpha'].includes(lower))
        return { label: 'ALPHA USER', icon: ROLE_ICONS.tester, bg: 'linear-gradient(110deg, #2b2005 25%, #FDC830 50%, #2b2005 75%)', color: '#fff9e6', themeColor: '#FDC830', glow: 'rgba(253, 200, 48, 0.7)', score: 9999, isRole: true };
    if (['contributor', 'partner', 'creator'].includes(lower))
        return { label: 'Partner', icon: ROLE_ICONS.contributor, bg: 'linear-gradient(110deg, #1a052b 25%, #b224ef 50%, #1a052b 75%)', color: '#faedff', themeColor: '#b224ef', glow: 'rgba(178, 36, 239, 0.7)', score: 9999, isRole: true };
    return { label: role.toUpperCase(), icon: ROLE_ICONS.default, bg: 'linear-gradient(110deg, #1a1a1a 25%, #bdc3c7 50%, #1a1a1a 75%)', color: '#f0f0f0', themeColor: '#bdc3c7', glow: 'rgba(189, 195, 199, 0.7)', score: 9999, isRole: true };
};

// ✅ <style> 태그 JSX 외부로 분리
const SIDEBAR_STYLES = `
    @keyframes roleShine {
        0% { background-position: -200% center; }
        20% { background-position: 200% center; }
        100% { background-position: 200% center; }
    }
    @keyframes weaponGodShine {
        0% { background-position: -200% center; }
        25% { background-position: 200% center; }
        100% { background-position: 200% center; }
    }
    .role-badge { background-size: 200% auto !important; animation: roleShine 10s linear infinite; }
    .weapon-god-badge {
        background-size: 200% auto !important;
        animation: weaponGodShine 3.5s linear infinite;
    }
    .tag-item:hover { transform: translateY(-2px); transition: transform 0.2s; }
`;

const Sidebar: React.FC<SidebarProps> = ({
    user, history, isFavorite, isPinned, hasPinnedUser,
    onToggleFavorite, onTogglePin, onReturnToPinned
}) => {
    const { t } = useTranslation();
    const [viewMode, setViewMode] = useState<'compact' | 'medium'>('medium');
    const nameRef = useRef<HTMLDivElement>(null);

    const playerTags = useMemo((): PlayerTag[] => {
        const tags: PlayerTag[] = [];

        if (user.role) {
            const config = getRoleTagConfig(user.role);
            tags.push({
                label: config.label,
                desc: "Special identity in ApexTrace",
                icon: config.icon,
                color: config.color,
                score: config.score,
                bgGradient: config.bg,
                isRole: config.isRole,
                glow: config.glow,
                themeColor: config.themeColor
            });
        }

        if (!history || history.length < 3) return tags;
        const recent = history.slice(0, 20);
        const totalGames = recent.length;

        let totalKills = 0, totalDamage = 0, totalPlacement = 0, totalWins = 0, totalTop5 = 0, totalAssists = 0;
        const legendStats: Record<string, { count: number; kills: number; placement: number }> = {};
        const weaponStats: Record<string, { count: number; kills: number; damage: number }> = {};

        recent.forEach(match => {
            const k = match.kills || 0;
            const d = match.damage || 0;
            const a = match.assists || 0;
            const p = typeof match.placement === 'number' ? match.placement : 20;
            totalKills += k; totalDamage += d; totalPlacement += p; totalAssists += a;
            if (p === 1) totalWins++;
            if (p <= 5) totalTop5++;
            if (match.legend) {
                if (!legendStats[match.legend]) legendStats[match.legend] = { count: 0, kills: 0, placement: 0 };
                legendStats[match.legend].count++;
                legendStats[match.legend].kills += k;
                legendStats[match.legend].placement += p;
            }
            [match.loadout?.primary, match.loadout?.secondary].forEach(rawName => {
                if (!rawName || rawName === 'unknown' || rawName === 'none') return;
                const key = rawName;
                if (!weaponStats[key]) weaponStats[key] = { count: 0, kills: 0, damage: 0 };
                weaponStats[key].count++;
                weaponStats[key].kills += k;
                weaponStats[key].damage += d;
            });
        });

        const avgKills = totalKills / totalGames;
        const avgDmg = totalDamage / totalGames;
        const avgRank = totalPlacement / totalGames;
        const avgAssists = totalAssists / totalGames;
        const winRate = totalWins / totalGames;
        const top5Rate = totalTop5 / totalGames;

        // 🏆 Playstyle Tags
        if (avgKills >= 6 || avgDmg >= 2000)
            tags.push({ label: t('sidebar.tags.playstyle.grimReaper.label'), desc: t('sidebar.tags.playstyle.grimReaper.desc'), icon: <FaSkull />, color: '#fff', score: 110, bgGradient: 'linear-gradient(135deg, #870000 0%, #190a05 100%)' });
        if (winRate >= 0.20)
            tags.push({ label: t('sidebar.tags.playstyle.champion.label'), desc: t('sidebar.tags.playstyle.champion.desc'), icon: <FaTrophy />, color: '#fff', score: 105, bgGradient: 'linear-gradient(135deg, #FDC830 0%, #F37335 100%)' });
        if (avgKills >= 4)
            tags.push({ label: t('sidebar.tags.playstyle.killMove.label'), desc: t('sidebar.tags.playstyle.killMove.desc'), icon: <FaFistRaised />, color: '#fff', score: 95, bgGradient: 'linear-gradient(135deg, #cb2d3e 0%, #ef473a 100%)' });
        else if (avgKills >= 2)
            tags.push({ label: t('sidebar.tags.playstyle.fighter.label'), desc: t('sidebar.tags.playstyle.fighter.desc'), icon: <FaFistRaised />, color: '#e67e22', score: 70 });
        if (avgDmg >= 1200)
            tags.push({ label: t('sidebar.tags.playstyle.mainDps.label'), desc: t('sidebar.tags.playstyle.mainDps.desc'), icon: <GiBullets />, color: '#fff', score: 92, bgGradient: 'linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%)' });
        else if (avgDmg >= 700)
            tags.push({ label: t('sidebar.tags.playstyle.bruiser.label'), desc: t('sidebar.tags.playstyle.bruiser.desc'), icon: <GiBullets />, color: '#ff9ff3', score: 65 });
        if (avgAssists >= 3.5)
            tags.push({ label: t('sidebar.tags.playstyle.teamPlayer.label'), desc: t('sidebar.tags.playstyle.teamPlayer.desc'), icon: <FaHandsHelping />, color: '#fff', score: 85, bgGradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' });
        if (top5Rate >= 0.5)
            tags.push({ label: t('sidebar.tags.playstyle.top5Machine.label'), desc: t('sidebar.tags.playstyle.top5Machine.desc'), icon: <FaShieldAlt />, color: '#fff', score: 90, bgGradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' });
        else if (top5Rate >= 0.3)
            tags.push({ label: t('sidebar.tags.playstyle.consistent.label'), desc: t('sidebar.tags.playstyle.consistent.desc'), icon: <FaRunning />, color: '#2ecc71', score: 60 });
        if (avgRank >= 14 && avgDmg >= 600)
            tags.push({ label: t('sidebar.tags.playstyle.hotDropper.label'), desc: t('sidebar.tags.playstyle.hotDropper.desc'), icon: <FaFire />, color: '#e74c3c', score: 75 });
        if (avgRank <= 8 && avgDmg <= 250)
            tags.push({ label: t('sidebar.tags.playstyle.survivor.label'), desc: t('sidebar.tags.playstyle.survivor.desc'), icon: <FaUserSecret />, color: '#95a5a6', score: 60 });

        // 🔫 Weapon Tags
        Object.entries(weaponStats).forEach(([key, wstats]) => {
            const pickRate = wstats.count / totalGames;
            const avgWpnKills = wstats.kills / wstats.count;
            const avgWpnDmg = wstats.damage / wstats.count;
            const weaponKey = key.replace(/[-. ]/g, '').toLowerCase();
            const weaponLocalizedName = t(`sidebar.weaponNames.${weaponKey}`, key);

            if (pickRate >= 0.3 && (avgWpnKills >= 5 || avgWpnDmg >= 1200)) {
                const theme = getWeaponTagTheme(key, 'god');
                tags.push({
                    label: `${weaponLocalizedName}${t('sidebar.tags.suffix.god')}`,
                    desc: t('sidebar.tags.desc.weaponGod'),
                    icon: <FaCrown />,
                    color: theme.color,
                    score: 97,
                    bgGradient: theme.bgGradient,
                    shineGradient: theme.shineGradient,
                    themeColor: theme.themeColor,
                    weaponTier: 'god',
                    imageId: getWeaponImageId(key),
                    imageType: 'weapon',
                });
            } else if (pickRate >= 0.3 && (avgWpnKills >= 2.5 || avgWpnDmg >= 700)) {
                const theme = getWeaponTagTheme(key, 'master');
                tags.push({
                    label: `${weaponLocalizedName}${t('sidebar.tags.suffix.master')}`,
                    desc: t('sidebar.tags.desc.weaponMaster'),
                    icon: <GiGunshot />,
                    color: theme.color,
                    score: 90,
                    bgGradient: theme.bgGradient,
                    themeColor: theme.themeColor,
                    weaponTier: 'master',
                    imageId: getWeaponImageId(key),
                    imageType: 'weapon',
                });
            } else if (pickRate >= 0.35) {
                const theme = getWeaponTagTheme(key, 'user');
                tags.push({
                    label: `${weaponLocalizedName}${t('sidebar.tags.suffix.user')}`,
                    desc: t('sidebar.tags.desc.weaponUser'),
                    icon: <GiGunshot />,
                    color: theme.color,
                    score: 72,
                    themeColor: theme.themeColor,
                    weaponTier: 'user',
                    imageId: getWeaponImageId(key),
                    imageType: 'weapon',
                });
            }
        });

        // 🦸 Legend Tags
        Object.entries(legendStats).forEach(([name, lstats]) => {
            const pickRate = lstats.count / totalGames;
            const avgLegRank = lstats.placement / lstats.count;
            const avgLegKills = lstats.kills / lstats.count;
            const legendKey = name.toLowerCase().replace(/[^a-z]/g, '');
            const legendLocalizedName = t(`sidebar.legendNames.${legendKey}`, name);

            if (pickRate >= 0.8)
                tags.push({ label: `${legendLocalizedName}${t('sidebar.tags.suffix.oneTrick')}`, desc: t('sidebar.tags.desc.legendOneTrick'), icon: <FaGem />, color: '#fff', score: 98, bgGradient: getDynamicGradient(legendKey), imageId: getLegendImageId(name), imageType: 'legend' });
            else if (pickRate >= 0.3 && (avgLegRank <= 5 || avgLegKills >= 3))
                tags.push({ label: `${legendLocalizedName}${t('sidebar.tags.suffix.master')}`, desc: t('sidebar.tags.desc.legendMaster'), icon: <FaMedal />, color: '#fff', score: 96, bgGradient: getDynamicGradient(legendKey), imageId: getLegendImageId(name), imageType: 'legend' });
            else if (pickRate >= 0.4)
                tags.push({ label: `${legendLocalizedName}${t('sidebar.tags.suffix.main')}`, desc: t('sidebar.tags.desc.legendMain'), icon: <FaStar />, color: '#a29bfe', score: 76, imageId: getLegendImageId(name), imageType: 'legend' });
        });

        return tags.sort((a, b) => b.score - a.score).slice(0, 4);
    }, [history, user.role, t]);

    useEffect(() => {
        const handleResize = () => {
            setViewMode(window.innerHeight < 750 ? 'compact' : 'medium');
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // hasPinnedUser 포함: 핀 버튼 표시 여부가 이름 영역 너비에 영향을 줌
    useLayoutEffect(() => {
        const el = nameRef.current;
        if (!el) return;
        const maxFontSize = viewMode === 'compact' ? 20 : 24;
        let currentSize = maxFontSize;
        el.style.fontSize = `${currentSize}px`;
        while (el.scrollWidth > el.clientWidth && currentSize > 14) {
            currentSize--;
            el.style.fontSize = `${currentSize}px`;
        }
    }, [user.name, viewMode, hasPinnedUser]);

    if (!user || !user.uid) {
        return (
            <div style={{ width: '100%', height: '100%', background: 'var(--color-bg-main)', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--color-border)', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ opacity: 0.3, textAlign: 'center', padding: '20px' }}>
                    <img src="https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/unknown.png" alt="Logo" style={{ width: '80px', marginBottom: '15px', filter: 'grayscale(100%)' }} />
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>ApexTrace</div>
                    <span style={{ fontSize: '12px', fontWeight: 'normal', lineHeight: '1.4', display: 'block' }}>{t('sidebar.emptyNotice')}</span>
                </div>
            </div>
        );
    }

    const getRankAsset = (rankName: string): string => {
        if (!rankName || rankName === '-' || rankName === 'Waiting...' || rankName === 'Unranked')
            return 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/unranked.png';
        const tier = rankName.split(' ')[0].toLowerCase();
        if (tier === 'apex')
            return 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/predator.png';
        return `https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/${tier}.png`;
    };

    const rankIcon = getRankAsset(user.rankName || '');
    const displayRankName = user.rankName === 'Apex Predator'
        ? t('favorites.predator')
        : formatFullRankName(user.rankName, user.rankDiv);
    const legendName = user.legend ? user.legend.toLowerCase() : 'unknown';
    const displayImage = `https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/${legendName}.png`;
    const avatarSize = viewMode === 'compact' ? '80px' : '100px';
    const rankIconSize = viewMode === 'compact' ? '30px' : '40px';
    const containerPadding = viewMode === 'compact' ? '20px 15px' : '30px 20px';
    const showReturnBtn = !isPinned && hasPinnedUser;
    const btnSize = 24;
    const btnGap = 8;
    const totalLevel = ((user.prestige || 0) * 500) + (user.level || 0);

    return (
        <div style={{ width: '100%', height: '100%', background: 'var(--color-bg-main)', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--color-border)', position: 'relative' }}>
            {/* ✅ style 태그를 JSX 외부 상수로 분리 */}
            <style>{SIDEBAR_STYLES}</style>

            <div style={{ padding: containerPadding, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>

                {/* 핀 & 즐겨찾기 */}
                <div style={{ position: 'absolute', top: '15px', width: '100%', padding: '0 20px', display: 'flex', justifyContent: 'space-between', left: 0, boxSizing: 'border-box', zIndex: 10 }}>
                    <button
                        onClick={onTogglePin}
                        // ✅ 번역 키 적용
                        title={isPinned ? t('controls.unpin') : t('controls.pin')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: isPinned ? 'var(--color-success)' : 'var(--color-text-subtle)', transform: isPinned ? 'rotate(-45deg)' : 'rotate(0deg)', transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)', padding: '5px', filter: isPinned ? 'drop-shadow(0 0 5px rgba(46, 204, 113, 0.5))' : 'none' }}
                    >
                        <FaThumbtack />
                    </button>
                    <button
                        onClick={onToggleFavorite}
                        title={t('nav.favorites')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: isFavorite ? '#f1c40f' : 'var(--color-text-subtle)', transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)', transform: 'scale(1)', padding: '5px', filter: isFavorite ? 'drop-shadow(0 0 5px rgba(241, 196, 15, 0.5))' : 'none' }}
                    >
                        {isFavorite ? <FaStar /> : <FaRegStar />}
                    </button>
                </div>

                {/* 아바타 */}
                <div style={{ width: avatarSize, height: avatarSize, borderRadius: '50%', border: '4px solid var(--color-border)', overflow: 'hidden', background: 'var(--color-bg-deep)', marginBottom: '15px', marginTop: '10px', boxShadow: '0 8px 20px rgba(0,0,0,0.3)' }}>
                    <img src={displayImage} alt="Legend" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.1)' }} />
                </div>

                {/* 이름 및 리턴 버튼 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginBottom: '4px', position: 'relative' }}>
                    {showReturnBtn && <div style={{ width: `${btnSize}px`, marginRight: `${btnGap}px`, flexShrink: 0 }} />}
                    <div
                        ref={nameRef}
                        style={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'clip', maxWidth: '100%', lineHeight: '1.2', textAlign: 'center' }}
                    >
                        {user.name}
                    </div>
                    {showReturnBtn && (
                        <button
                            onClick={onReturnToPinned}
                            // ✅ 번역 키 적용
                            title={t('controls.returnToPinned')}
                            style={{ width: `${btnSize}px`, height: `${btnSize}px`, minWidth: `${btnSize}px`, minHeight: `${btnSize}px`, marginLeft: `${btnGap}px`, borderRadius: '50%', background: 'var(--color-success)', border: 'none', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(46, 204, 113, 0.4)' }}
                        >
                            <FaUndo size={12} />
                        </button>
                    )}
                </div>

                {/* ✅ "Level" 하드코딩 → 번역 키 적용 */}
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '15px', background: 'var(--color-bg-card)', padding: '2px 10px', borderRadius: '12px' }}>
                    {t('favorites.level')} {totalLevel}
                </div>

                {/* 랭크 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '20px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', padding: '8px 15px', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }}>
                    <img src={rankIcon} alt="Rank" style={{ width: rankIconSize, height: rankIconSize, objectFit: 'contain' }} />
                    <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--color-text-secondary)', lineHeight: '1.2' }}>
                            {displayRankName || t('favorites.unranked')}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-warning)', fontWeight: '600' }}>
                            {(user.rankScore || 0).toLocaleString()} RP
                        </div>
                    </div>
                </div>

                {/* 태그 리스트 */}
                {playerTags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px', width: '100%' }}>
                        {playerTags.map((tag, idx) => {
                            const isWeaponGod = tag.weaponTier === 'god';
                            const isWeaponMaster = tag.weaponTier === 'master';
                            const isWeaponUser = tag.weaponTier === 'user';
                            const accent = tag.themeColor ?? tag.color;
                            const useGradientBg = isWeaponGod || isWeaponMaster || (!!tag.bgGradient && !isWeaponUser);
                            const iconColor = tag.isRole
                                ? accent
                                : isWeaponUser
                                    ? accent
                                    : useGradientBg
                                        ? '#fff'
                                        : tag.color;
                            const labelColor = tag.isRole
                                ? tag.color
                                : isWeaponUser
                                    ? accent
                                    : useGradientBg
                                        ? '#fff'
                                        : tag.color;

                            return (
                            <div
                                key={idx}
                                className={`tag-item ${tag.isRole ? 'role-badge' : ''} ${isWeaponGod ? 'weapon-god-badge' : ''}`}
                                title={tag.desc}
                                style={{
                                    display: 'flex', alignItems: 'center',
                                    background: isWeaponGod
                                        ? tag.shineGradient
                                        : isWeaponMaster
                                            ? tag.bgGradient
                                            : isWeaponUser
                                                ? 'transparent'
                                                : tag.bgGradient ?? `${tag.color}22`,
                                    padding: '4px 10px', borderRadius: '6px',
                                    border: tag.isRole || isWeaponUser || isWeaponGod
                                        ? `1px solid ${accent}`
                                        : useGradientBg
                                            ? '1px solid transparent'
                                            : `1px solid ${tag.color}`,
                                    fontSize: '11px', cursor: 'help',
                                    boxShadow: tag.isRole
                                        ? `0 0 10px ${tag.glow}, inset 0 0 5px ${tag.glow}`
                                        : isWeaponGod
                                            ? `0 0 10px ${accent}66, inset 0 0 5px ${accent}33`
                                            : isWeaponMaster
                                                ? '0 2px 6px rgba(0,0,0,0.3)'
                                                : 'none',
                                    letterSpacing: tag.isRole ? '1px' : 'normal',
                                }}
                            >
                                <span style={{
                                    color: iconColor,
                                    marginRight: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    filter: tag.isRole || isWeaponGod
                                        ? `drop-shadow(0 0 3px ${accent})`
                                        : 'none',
                                }}>
                                    {tag.imageId && tag.imageType ? (
                                        <ProfileTagIcon
                                            imageId={tag.imageId}
                                            imageType={tag.imageType}
                                            color={labelColor}
                                            fallback={tag.icon}
                                        />
                                    ) : (
                                        tag.icon
                                    )}
                                </span>
                                <span style={{
                                    color: labelColor,
                                    fontWeight: '600',
                                    textShadow: tag.isRole
                                        ? `0 0 6px ${tag.glow}, 0 0 2px #000`
                                        : useGradientBg && !isWeaponUser
                                            ? '0 1px 2px rgba(0,0,0,0.4)'
                                            : 'none',
                                }}>
                                    {tag.label}
                                </span>
                            </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Sidebar;