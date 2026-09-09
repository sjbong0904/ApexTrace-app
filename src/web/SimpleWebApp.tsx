import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaChartBar, FaLink, FaList, FaSync, FaThList } from 'react-icons/fa';
import Navigation, { type NavTabId } from '../components/Navigation';
import InlineProfileSection from '../components/InlineProfileSection';
import MapVisualizer from '../components/MapVisualizer';
import CombatLog from '../components/CombatLog';
import MatchDetailTabs, { MatchLoadoutPanel, MatchStatsPanel } from '../components/MatchDetailTabs';
import StatisticsTab from '../components/StatisticsTab';
import TierTableTab from '../components/TierTableTab';
import PlayerSelectionModal from '../components/PlayerSelectionModal';
import AppSelect from '../components/AppSelect';
import SearchBar from '../components/SearchBar';
import { APP_LANGUAGES } from '../constants/languages';
import { CONTENT_MAX_WIDTH, NARROW_LAYOUT_WIDTH } from '../hooks/useWindowAutoResize';
import { isIncompleteMatchStats } from '../utils/match';
import { formatRelativeTime, getRankColor, getRelativeTime, normalizeMapDisplayName } from '../utils/helpers';
import { getModeColor, getModeDisplayLabel, matchesHistoryTab } from '../utils/matchMode';
import { getSelectableSeasons, resolveCurrentSeasonId, resolveSeasonEndMs } from '../utils/seasons';
import {
    fetchHistoryByUid,
    fetchSeasons,
    fetchUserStatsByUid,
    searchCandidates,
    type RemoteUserStats,
    type SearchCandidate,
    type SeasonConfig,
} from './api';
import {
    clearRecentSearches,
    loadRecentSearches,
    pushRecentSearch,
    removeRecentSearch,
    type RecentSearchProfile,
} from '../utils/recentSearches';
import WebAdRail, { WEB_ADS_MIN_VIEWPORT } from './WebAdRail';

const WEB_NAV_TABS: NavTabId[] = ['DASHBOARD', 'STATISTICS', 'TIER_TABLE'];
const MATCHES_PER_PAGE = 20;
const noop = () => {};

const FALLBACK_SEASONS: SeasonConfig[] = [
    { id: 3, name: 'Season 28 : Split 2', startTime: new Date('2026-03-24T18:00:00Z').getTime(), endTime: new Date('2026-08-04T18:00:00Z').getTime() },
    { id: 2, name: 'Season 28 : Split 1', startTime: new Date('2026-02-10T18:00:00Z').getTime(), endTime: new Date('2026-03-24T18:00:00Z').getTime() },
    { id: 1, name: 'Season 27 : Split 2', startTime: 0, endTime: new Date('2026-02-10T18:00:00Z').getTime() },
];

type WebUser = {
    uid: string | null;
    name: string;
    level: number;
    prestige: number;
    rankName: string;
    rankScore: number;
    legend: string;
    avatar?: string | null;
};

const emptyUser = (defaultName: string): WebUser => ({
    uid: null,
    name: defaultName,
    level: 0,
    prestige: 0,
    rankName: '-',
    rankScore: 0,
    legend: 'unknown',
    avatar: null,
});

const parseUidFromHash = (): string | null => {
    const hash = window.location.hash || '';
    const match = hash.match(/^#\/player\/([^/?]+)/);
    return match ? decodeURIComponent(match[1]) : null;
};

const toCandidate = (uid: string, stats: RemoteUserStats | null): SearchCandidate => ({
    uid,
    name: stats?.name || uid,
    rank_name: stats?.rankName || 'Unranked',
    rank_score: stats?.rankScore || 0,
    level: stats?.level || 0,
    legend: stats?.legend || 'unknown',
});

const getTabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
    color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-faint)',
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    borderBottom: isActive ? '2px solid var(--color-text-primary)' : '2px solid transparent',
    background: 'transparent',
    outline: 'none',
    boxShadow: 'none',
    transition: 'all 0.2s',
});

const ProfileLoadingOverlay = ({ label }: { label: string }) => (
    <div
        aria-busy
        style={{
            position: 'absolute',
            inset: 0,
            zIndex: 50,
            background: 'color-mix(in srgb, var(--color-bg-main) 88%, transparent)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            backdropFilter: 'blur(2px)',
            pointerEvents: 'auto',
        }}
    >
        <FaSync className="spin-animation" size={22} color="var(--color-warning)" />
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>{label}</span>
    </div>
);

export default function SimpleWebApp() {
    const { t, i18n } = useTranslation();
    const mainScrollRef = useRef<HTMLDivElement>(null);

    const [seasons, setSeasons] = useState<SeasonConfig[]>(FALLBACK_SEASONS);
    const [user, setUser] = useState<WebUser>(() => emptyUser('Player'));
    const [history, setHistory] = useState<any[]>([]);
    const [selectedSeasonId, setSelectedSeasonId] = useState<number>(
        () => resolveCurrentSeasonId(FALLBACK_SEASONS) ?? FALLBACK_SEASONS[0].id,
    );
    const [mainTab, setMainTab] = useState('DASHBOARD');
    const [activeTab, setActiveTab] = useState('BR');
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedMatchIds, setExpandedMatchIds] = useState<string[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isProfileLoading, setIsProfileLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [candidates, setCandidates] = useState<SearchCandidate[]>([]);
    const [searchResetKey, setSearchResetKey] = useState(0);
    const [copied, setCopied] = useState(false);
    const [recentSearches, setRecentSearches] = useState<RecentSearchProfile[]>(() => loadRecentSearches('web'));
    const [windowWidth, setWindowWidth] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth : 1680,
    );
    const isNarrowLayout = windowWidth < NARROW_LAYOUT_WIDTH;
    const showSideAds = windowWidth >= WEB_ADS_MIN_VIEWPORT;

    const selectableSeasons = useMemo(() => getSelectableSeasons(seasons), [seasons]);

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        void (async () => {
            const seasonList = await fetchSeasons();
            if (!seasonList.length) return;
            setSeasons(seasonList);
            const currentId = resolveCurrentSeasonId(seasonList);
            if (currentId != null) setSelectedSeasonId(currentId);
        })();
    }, []);

    useEffect(() => {
        setUser((prev) => (prev.uid ? prev : emptyUser(t('search.defaultName'))));
    }, [t]);

    const loadPlayer = async (candidate: SearchCandidate, updateHash = true) => {
        setIsProfileLoading(true);
        setStatusMessage('');
        setExpandedMatchIds([]);
        setCurrentPage(1);
        setMainTab('DASHBOARD');
        try {
            const [stats, playerHistory] = await Promise.all([
                fetchUserStatsByUid(candidate.uid),
                fetchHistoryByUid(candidate.uid),
            ]);

            setUser({
                uid: candidate.uid,
                name: stats?.name || candidate.name,
                level: stats?.level ?? candidate.level ?? 0,
                prestige: stats?.prestige ?? 0,
                rankName: stats?.rankName || candidate.rank_name || 'Unranked',
                rankScore: stats?.rankScore ?? candidate.rank_score ?? 0,
                legend: stats?.legend || candidate.legend || 'unknown',
                avatar: stats?.avatar,
            });
            setHistory(playerHistory);
            setCandidates([]);
            setRecentSearches(pushRecentSearch('web', {
                uid: candidate.uid,
                name: stats?.name || candidate.name,
                rankName: stats?.rankName || candidate.rank_name || 'Unranked',
                rankScore: stats?.rankScore ?? candidate.rank_score ?? 0,
                level: stats?.level ?? candidate.level ?? 0,
                prestige: stats?.prestige ?? 0,
                legend: stats?.legend || candidate.legend || 'unknown',
            }));
            if (updateHash) {
                window.history.replaceState(null, '', `#/player/${encodeURIComponent(candidate.uid)}`);
            }
        } catch {
            setStatusMessage(t('search.failedLoad', { defaultValue: 'Failed to load player data.' }));
        } finally {
            setIsProfileLoading(false);
            setIsSearching(false);
        }
    };

    const handleSearch = async (query: string) => {
        const trimmed = query.trim();
        if (!trimmed) return;

        setIsSearching(true);
        setStatusMessage('');
        setCandidates([]);
        try {
            const found = await searchCandidates(trimmed);
            if (found.length === 0) {
                setStatusMessage(t('search.noResults', { defaultValue: 'No players found.' }));
                return;
            }
            if (found.length === 1) {
                await loadPlayer(found[0]);
                return;
            }
            setCandidates(found.slice(0, 10));
        } catch {
            setStatusMessage(t('search.error', { defaultValue: 'Search failed.' }));
        } finally {
            setIsSearching(false);
        }
    };

    useEffect(() => {
        const loadFromHash = async () => {
            const uid = parseUidFromHash();
            if (!uid) return;
            setIsSearching(true);
            try {
                const stats = await fetchUserStatsByUid(uid);
                await loadPlayer(toCandidate(uid, stats), false);
            } catch {
                setStatusMessage(t('search.failedLoad', { defaultValue: 'Failed to load player from URL.' }));
            } finally {
                setIsSearching(false);
            }
        };

        void loadFromHash();
        const onHashChange = () => {
            void loadFromHash();
        };
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- hash bootstrap once; loadPlayer is stable enough for web
    }, []);

    const filteredHistory = useMemo(() => {
        return history.filter((match) => {
            if (!matchesHistoryTab(match.mode, activeTab as 'BR' | 'RANKED' | 'TRIO' | 'DUO')) {
                return false;
            }

            const matchTime = match.startTime || match.endTime || 0;
            const currentSeason = seasons.find((s) => s.id === selectedSeasonId);
            if (!currentSeason) return true;

            const seasonEnd = resolveSeasonEndMs(seasons, selectedSeasonId);
            const isAfterStart = matchTime >= currentSeason.startTime;
            const isBeforeEnd = seasonEnd != null ? matchTime < seasonEnd : true;
            return isAfterStart && isBeforeEnd;
        });
    }, [history, activeTab, selectedSeasonId, seasons]);

    const totalPages = Math.max(1, Math.ceil(filteredHistory.length / MATCHES_PER_PAGE));
    const effectiveCurrentPage = Math.min(currentPage, totalPages);
    const currentMatches = useMemo(() => {
        const startIndex = (effectiveCurrentPage - 1) * MATCHES_PER_PAGE;
        return filteredHistory.slice(startIndex, startIndex + MATCHES_PER_PAGE);
    }, [filteredHistory, effectiveCurrentPage]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

    useEffect(() => {
        setCurrentPage(1);
        setExpandedMatchIds([]);
    }, [activeTab, selectedSeasonId, user.uid]);

    const handleMatchToggle = (matchId: string) => {
        setExpandedMatchIds((prev) =>
            prev.includes(matchId) ? prev.filter((id) => id !== matchId) : [...prev, matchId],
        );
    };

    const collapseAll = () => setExpandedMatchIds([]);

    const handleSelectFromMatch = (selected: { uid: string; name: string }) => {
        if (!selected?.uid) return;
        void loadPlayer({
            uid: selected.uid,
            name: selected.name || selected.uid,
            rank_name: 'Unranked',
            rank_score: 0,
            level: 0,
            legend: 'unknown',
        });
        setSearchResetKey((k) => k + 1);
    };

    const handleCopyProfileLink = async () => {
        if (!user.uid) return;
        const link = `${window.location.origin}${window.location.pathname}#/player/${user.uid}`;
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            setStatusMessage(t('search.copyFailed', { defaultValue: 'Failed to copy link.' }));
        }
    };

    const handleManualRefresh = async () => {
        if (!user.uid || isProfileLoading) return;
        await loadPlayer({
            uid: user.uid,
            name: user.name,
            rank_name: user.rankName,
            rank_score: user.rankScore,
            level: user.level,
            legend: user.legend,
        }, false);
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100vw',
                height: '100dvh',
                background: 'var(--color-bg-main)',
                fontFamily: "'Segoe UI', sans-serif",
                overflow: 'hidden',
                color: 'var(--color-text-primary)',
                boxSizing: 'border-box',
            }}
        >
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .spin-animation {
                    animation: spin 1s linear infinite;
                }
            `}</style>

            <div
                style={{
                    height: '35px',
                    background: 'var(--color-bg-top-bar)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0,
                    userSelect: 'none',
                }}
            >
                <div
                    style={{
                        paddingLeft: '15px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: 'var(--color-text-muted)',
                        letterSpacing: '1px',
                        display: 'flex',
                        alignItems: 'center',
                    }}
                >
                    <img
                        src="/icons/IconMouseOver.png"
                        alt=""
                        style={{ width: '18px', height: '18px', marginRight: '8px', objectFit: 'contain' }}
                    />
                    {t('app.title')}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingRight: '12px' }}>
                    {user.uid && (
                        <button
                            type="button"
                            onClick={() => void handleCopyProfileLink()}
                            title={t('controls.copyLink', { defaultValue: 'Copy profile link' })}
                            style={{
                                background: 'transparent',
                                border: '1px solid var(--color-border-light)',
                                color: 'var(--color-text-muted)',
                                borderRadius: 6,
                                padding: '4px 8px',
                                fontSize: 11,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                            }}
                        >
                            <FaLink size={10} />
                            {copied ? t('controls.copied', { defaultValue: 'Copied' }) : t('controls.copyLink', { defaultValue: 'Link' })}
                        </button>
                    )}
                    <AppSelect
                        sizeVariant="sm"
                        value={i18n.language}
                        onChange={(e) => {
                            const newLang = e.target.value;
                            void i18n.changeLanguage(newLang);
                            localStorage.setItem('app_language', newLang);
                        }}
                        title="Select Language"
                    >
                        {APP_LANGUAGES.map(({ code, label }) => (
                            <option key={code} value={code}>{label}</option>
                        ))}
                    </AppSelect>
                </div>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
                {showSideAds && <WebAdRail side="left" />}

                <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minWidth: 0 }}>
                <div
                    style={{
                        flex: '0 0 70px',
                        background: 'var(--color-bg-nav)',
                        borderRight: '1px solid var(--color-border)',
                        zIndex: 20,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        paddingTop: '20px',
                    }}
                >
                    <Navigation
                        activeTab={mainTab}
                        onTabChange={setMainTab}
                        visibleTabs={WEB_NAV_TABS}
                    />
                </div>

                <div
                    style={{
                        flex: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        background: 'var(--color-bg-panel)',
                        minWidth: 0,
                        position: 'relative',
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            height: '60px',
                            borderBottom: '1px solid var(--color-border)',
                            display: 'flex',
                            alignItems: 'center',
                            padding: isNarrowLayout ? '0 12px' : '0 30px',
                            background: 'var(--color-bg-sub-header)',
                            gap: '8px',
                            flexShrink: 0,
                            minWidth: 0,
                        }}
                    >
                        <div
                            style={{
                                fontWeight: 'bold',
                                fontSize: isNarrowLayout ? '15px' : '20px',
                                color: 'var(--color-text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                minWidth: 0,
                                overflow: 'hidden',
                            }}
                        >
                            <span
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    minWidth: 0,
                                    overflow: 'hidden',
                                    whiteSpace: 'nowrap',
                                    textOverflow: 'ellipsis',
                                }}
                            >
                                {mainTab === 'DASHBOARD' ? (
                                    <><FaList color="var(--color-text-muted)" /> {t('nav.matchHistory')}</>
                                ) : mainTab === 'STATISTICS' ? (
                                    <><FaChartBar color="#e17055" /> {t('nav.statistics')}</>
                                ) : (
                                    <><FaThList color="#a29bfe" /> {t('nav.tierTable')}</>
                                )}
                            </span>
                        </div>
                    </div>

                    <div
                        style={{
                            flex: 1,
                            minHeight: 0,
                            minWidth: 0,
                            position: 'relative',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        {isProfileLoading && (mainTab === 'DASHBOARD' || mainTab === 'STATISTICS') && (
                            <ProfileLoadingOverlay label={t('search.loadingProfile')} />
                        )}

                        <div
                            ref={mainScrollRef}
                            style={{
                                padding: mainTab === 'TIER_TABLE' ? 0 : (isNarrowLayout ? '16px' : '30px'),
                                overflowY: (
                                    mainTab === 'TIER_TABLE'
                                    || (isProfileLoading && (mainTab === 'DASHBOARD' || mainTab === 'STATISTICS'))
                                ) ? 'hidden' : 'auto',
                                overflowX: 'hidden',
                                flex: 1,
                                height: '100%',
                                minHeight: 0,
                                position: 'relative',
                                minWidth: 0,
                            }}
                        >
                        <div style={{
                            width: '100%',
                            maxWidth: mainTab === 'TIER_TABLE' ? undefined : CONTENT_MAX_WIDTH,
                            marginLeft: 'auto',
                            marginRight: 'auto',
                            boxSizing: 'border-box',
                            minWidth: 0,
                        }}>
                            {(mainTab === 'DASHBOARD' || mainTab === 'STATISTICS') && (
                                <InlineProfileSection
                                    showFavoritePin={false}
                                    modeTabsSlot={(
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'flex-end',
                                                gap: 12,
                                                borderBottom: '1px solid var(--color-border)',
                                                paddingBottom: 0,
                                                minWidth: 0,
                                            }}
                                        >
                                            {mainTab === 'DASHBOARD' ? (
                                                <div style={{ display: 'flex', gap: 5, minWidth: 0, flexWrap: 'wrap' }}>
                                                    {(['BR', 'RANKED', 'TRIO', 'DUO'] as const).map((tab) => (
                                                        <button
                                                            key={tab}
                                                            type="button"
                                                            className="btn-tab"
                                                            onMouseDown={(e) => e.preventDefault()}
                                                            onClick={() => setActiveTab(tab)}
                                                            style={getTabStyle(activeTab === tab)}
                                                        >
                                                            {t(`statistics.modes.${tab.toLowerCase()}`)}
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div style={{ minWidth: 0, flex: 1 }} />
                                            )}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: isNarrowLayout ? 8 : 12, flexShrink: 0, paddingBottom: 4 }}>
                                                <AppSelect
                                                    sizeVariant="md"
                                                    value={selectedSeasonId}
                                                    onChange={(e) => {
                                                        setSelectedSeasonId(Number(e.target.value));
                                                        mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }}
                                                >
                                                    {selectableSeasons.map((season) => (
                                                        <option key={season.id} value={season.id}>{season.name}</option>
                                                    ))}
                                                </AppSelect>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleManualRefresh()}
                                                    disabled={!user.uid || isProfileLoading}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        cursor: !user.uid || isProfileLoading ? 'not-allowed' : 'pointer',
                                                        color: !user.uid || isProfileLoading ? 'var(--color-border-light)' : 'var(--color-text-dim)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        padding: '5px',
                                                        transition: 'color 0.2s, transform 0.2s',
                                                        fontSize: '16px',
                                                    }}
                                                    title={t('controls.refresh')}
                                                >
                                                    <FaSync size={18} className={isProfileLoading ? 'spin-animation' : undefined} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    searchSlot={
                                        <SearchBar
                                            onSearch={(q) => void handleSearch(q)}
                                            isSearching={isSearching}
                                            resetKey={searchResetKey}
                                            recent={recentSearches}
                                            onSelectRecent={(profile) => {
                                                setSearchResetKey((k) => k + 1);
                                                void loadPlayer({
                                                    uid: profile.uid,
                                                    name: profile.name,
                                                    rank_name: profile.rankName,
                                                    rank_score: profile.rankScore,
                                                    level: profile.level,
                                                    legend: profile.legend,
                                                });
                                            }}
                                            onRemoveRecent={(uid) => setRecentSearches(removeRecentSearch('web', uid))}
                                            onClearRecent={() => setRecentSearches(clearRecentSearches('web'))}
                                        />
                                    }
                                    statusMessage={statusMessage}
                                    user={user}
                                    history={history}
                                    trendHistory={filteredHistory.slice(0, 20)}
                                    isFavorite={false}
                                    isPinned={false}
                                    hasPinnedUser={false}
                                    onReturnToPinned={noop}
                                    onToggleFavorite={noop}
                                    onTogglePin={noop}
                                    compact={isNarrowLayout}
                                />
                            )}

                            {mainTab === 'STATISTICS' ? (
                                <StatisticsTab
                                    isPremium={false}
                                    overviewOnly
                                    selectedSeasonId={selectedSeasonId}
                                    seasons={seasons}
                                    profileUid={user.uid}
                                    profileName={user.name}
                                />
                            ) : mainTab === 'TIER_TABLE' ? (
                                <div style={{ width: '100%', height: '100%', minHeight: 0, overflow: 'hidden' }}>
                                    <TierTableTab />
                                </div>
                            ) : (
                                <>
                                    {expandedMatchIds.length > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                                            <button
                                                type="button"
                                                onClick={collapseAll}
                                                style={{
                                                    background: 'transparent',
                                                    border: '1px solid var(--color-border-light)',
                                                    color: 'var(--color-text-muted)',
                                                    padding: '4px 10px',
                                                    cursor: 'pointer',
                                                    borderRadius: 4,
                                                    fontSize: 11,
                                                }}
                                            >
                                                {t('controls.collapseAll')}
                                            </button>
                                        </div>
                                    )}

                                    {filteredHistory.length === 0 ? (
                                        <div
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                textAlign: 'center',
                                                padding: '40px',
                                                color: 'var(--color-text-subtle)',
                                                border: '2px dashed var(--color-border)',
                                                borderRadius: '10px',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    marginBottom: '15px',
                                                    fontSize: '14px',
                                                    lineHeight: '1.5',
                                                    color: 'var(--color-text-muted)',
                                                }}
                                            >
                                                {user.uid
                                                    ? <>{t('match.emptyTitle')}<br />{t('match.emptyDesc')}</>
                                                    : t('search.placeholder')}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '8px' }}>
                                            {currentMatches.map((match: any) => {
                                                const matchId = String(
                                                    match.matchId
                                                    || `${match.startTime || match.endTime || 0}-${match.mode || 'mode'}-${match.map || 'map'}`,
                                                );
                                                const isIncomplete = isIncompleteMatchStats(match);
                                                const displayRank = (match.placement === 1 || match.placement === '1') ? 1 : match.placement;
                                                const isExpanded = expandedMatchIds.includes(matchId);
                                                const legendFile = (match.legend || 'unknown').toLowerCase();
                                                const timePart = getRelativeTime(match.endTime || match.startTime);
                                                const timeLabel = formatRelativeTime(timePart, t);
                                                const gameMode = getModeDisplayLabel(match.mode);
                                                const modeColor = getModeColor(match.mode);
                                                const formatStat = (value: number | null | undefined) =>
                                                    isIncomplete || value == null ? '-' : value;
                                                const incompleteSignals = Array.isArray(match.missingSignals)
                                                    ? match.missingSignals
                                                        .map((signal: string) => t(`match.missingSignals.${signal}`, { defaultValue: signal }))
                                                        .filter(Boolean)
                                                        .join(', ')
                                                    : '';
                                                const incompleteTooltip = incompleteSignals
                                                    ? t('match.dataQualityTooltip', { signals: incompleteSignals })
                                                    : t('match.dataQualityIncomplete');

                                                return (
                                                    <div key={matchId} style={{ position: 'relative', borderRadius: '8px' }}>
                                                        {isIncomplete && (
                                                            <span
                                                                title={incompleteTooltip}
                                                                onClick={(e) => e.stopPropagation()}
                                                                aria-label={incompleteTooltip}
                                                                style={{
                                                                    position: 'absolute',
                                                                    left: '3px',
                                                                    top: 0,
                                                                    zIndex: 5,
                                                                    width: '18px',
                                                                    height: '18px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    transform: 'translate(-50%, -45%)',
                                                                    cursor: 'help',
                                                                    pointerEvents: 'auto',
                                                                }}
                                                            >
                                                                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden style={{ display: 'block', flexShrink: 0, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.75))' }}>
                                                                    <path fill="#e74c3c" stroke="rgba(0,0,0,0.35)" strokeWidth="0.8" d="M12 2.2L22.8 21.2H1.2L12 2.2z" />
                                                                    <rect x="11" y="8.2" width="2" height="7.2" rx="0.6" fill="#fff" />
                                                                    <rect x="11" y="17.2" width="2" height="2.2" rx="0.6" fill="#fff" />
                                                                </svg>
                                                            </span>
                                                        )}
                                                        <div
                                                            style={{
                                                                background: 'var(--color-bg-card)',
                                                                borderRadius: '8px',
                                                                overflow: 'hidden',
                                                                boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                                                                border: '1px solid var(--color-border)',
                                                            }}
                                                        >
                                                            <div
                                                                onClick={() => handleMatchToggle(matchId)}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    padding: isNarrowLayout ? '12px 12px' : '15px 20px',
                                                                    cursor: 'pointer',
                                                                    borderLeft: `6px solid ${isIncomplete ? 'var(--color-warning)' : getRankColor(displayRank)}`,
                                                                    background: isExpanded ? 'var(--color-bg-card-hover)' : 'var(--color-bg-card)',
                                                                    transition: 'background 0.2s',
                                                                    minWidth: 0,
                                                                    gap: isNarrowLayout ? '10px' : undefined,
                                                                }}
                                                            >
                                                                <div
                                                                    style={{
                                                                        position: 'relative',
                                                                        width: isNarrowLayout ? '42px' : '50px',
                                                                        height: isNarrowLayout ? '42px' : '50px',
                                                                        marginRight: isNarrowLayout ? 0 : '20px',
                                                                        flexShrink: 0,
                                                                    }}
                                                                >
                                                                    <div
                                                                        style={{
                                                                            width: '100%',
                                                                            height: '100%',
                                                                            borderRadius: '10px',
                                                                            background: 'var(--color-bg-sub-header)',
                                                                            overflow: 'hidden',
                                                                            border: '2px solid var(--color-border-light)',
                                                                        }}
                                                                    >
                                                                        <img
                                                                            src={`https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/${legendFile}.png`}
                                                                            alt={match.legend || '?'}
                                                                            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.1)' }}
                                                                            onError={(e) => {
                                                                                (e.target as HTMLImageElement).src = 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/unknown.png';
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <div
                                                                        style={{
                                                                            position: 'absolute',
                                                                            top: 0,
                                                                            left: 0,
                                                                            background: 'color-mix(in srgb, var(--color-bg-deep) 80%, transparent)',
                                                                            color: 'var(--color-text-secondary)',
                                                                            fontSize: '9px',
                                                                            padding: '2px 4px',
                                                                            borderBottomRightRadius: '5px',
                                                                            fontWeight: 'bold',
                                                                            lineHeight: '1',
                                                                            whiteSpace: 'nowrap',
                                                                            backdropFilter: 'blur(2px)',
                                                                            pointerEvents: 'none',
                                                                        }}
                                                                    >
                                                                        {timeLabel}
                                                                    </div>
                                                                </div>

                                                                <div
                                                                    style={{
                                                                        flex: 1,
                                                                        display: 'grid',
                                                                        gridTemplateColumns: isNarrowLayout
                                                                            ? 'minmax(0, 0.55fr) minmax(0, 1.15fr) minmax(0, 1.35fr) minmax(0, 0.95fr) minmax(0, 0.85fr)'
                                                                            : 'minmax(0, 0.7fr) minmax(0, 1.1fr) minmax(0, 1.35fr) repeat(4, minmax(0, 1fr))',
                                                                        gap: isNarrowLayout ? '6px' : '10px',
                                                                        alignItems: 'center',
                                                                        minWidth: 0,
                                                                    }}
                                                                >
                                                                    <div style={{ minWidth: 0 }}>
                                                                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{t('match.rank')}</div>
                                                                        <div
                                                                            style={{
                                                                                fontWeight: 'bold',
                                                                                fontSize: isNarrowLayout ? '14px' : '16px',
                                                                                color: isIncomplete ? 'var(--color-text-faint)' : 'var(--color-text-primary)',
                                                                            }}
                                                                        >
                                                                            {isIncomplete || displayRank == null || displayRank === '' ? '-' : `#${displayRank}`}
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ minWidth: 0 }}>
                                                                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{t('match.gamemode')}</div>
                                                                        <div
                                                                            style={{
                                                                                fontWeight: 'bold',
                                                                                fontSize: isNarrowLayout ? '12px' : '14px',
                                                                                color: modeColor,
                                                                                textTransform: 'uppercase',
                                                                                whiteSpace: 'nowrap',
                                                                                overflow: 'hidden',
                                                                                textOverflow: 'ellipsis',
                                                                            }}
                                                                            title={gameMode}
                                                                        >
                                                                            {gameMode}
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ overflow: 'hidden', minWidth: 0 }}>
                                                                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{t('match.map')}</div>
                                                                        <div
                                                                            style={{
                                                                                fontWeight: 'bold',
                                                                                color: 'var(--color-text-dim)',
                                                                                fontSize: isNarrowLayout ? '12px' : '14px',
                                                                                whiteSpace: 'nowrap',
                                                                                overflow: 'hidden',
                                                                                textOverflow: 'ellipsis',
                                                                                maxWidth: '100%',
                                                                            }}
                                                                            title={normalizeMapDisplayName(match.map)}
                                                                        >
                                                                            {normalizeMapDisplayName(match.map)}
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ minWidth: 0 }}>
                                                                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{t('match.damage')}</div>
                                                                        <div
                                                                            style={{
                                                                                fontWeight: 'bold',
                                                                                color: isIncomplete ? 'var(--color-text-faint)' : 'var(--color-danger)',
                                                                                fontSize: isNarrowLayout ? '14px' : '16px',
                                                                            }}
                                                                        >
                                                                            {isIncomplete || match.damage == null ? '-' : Math.round(match.damage)}
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ minWidth: 0 }}>
                                                                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{t('match.kills')}</div>
                                                                        <div
                                                                            style={{
                                                                                fontWeight: 'bold',
                                                                                color: isIncomplete ? 'var(--color-text-faint)' : 'var(--color-text-primary)',
                                                                                fontSize: isNarrowLayout ? '14px' : '16px',
                                                                            }}
                                                                        >
                                                                            {formatStat(match.kills)}
                                                                        </div>
                                                                    </div>
                                                                    {!isNarrowLayout && (
                                                                        <>
                                                                            <div style={{ minWidth: 0 }}>
                                                                                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{t('match.assists')}</div>
                                                                                <div style={{ fontWeight: 'bold', color: isIncomplete ? 'var(--color-text-faint)' : 'var(--color-text-primary)', fontSize: '16px' }}>
                                                                                    {formatStat(match.assists)}
                                                                                </div>
                                                                            </div>
                                                                            <div style={{ minWidth: 0 }}>
                                                                                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{t('match.knocks')}</div>
                                                                                <div style={{ fontWeight: 'bold', color: isIncomplete ? 'var(--color-text-faint)' : 'var(--color-text-primary)', fontSize: '16px' }}>
                                                                                    {formatStat(match.knocks)}
                                                                                </div>
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                                <div
                                                                    style={{
                                                                        fontSize: '12px',
                                                                        color: 'var(--color-text-faint)',
                                                                        marginLeft: '10px',
                                                                        flexShrink: 0,
                                                                        transition: 'transform 0.3s',
                                                                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                                    }}
                                                                >
                                                                    ▼
                                                                </div>
                                                            </div>

                                                            <div className={`match-accordion ${isExpanded ? 'open' : ''}`}>
                                                                <div className="match-accordion-inner">
                                                                    <div
                                                                        style={{
                                                                            height: isNarrowLayout ? 'auto' : '420px',
                                                                            display: 'flex',
                                                                            flexDirection: isNarrowLayout ? 'column' : 'row',
                                                                            borderTop: '1px solid var(--color-border)',
                                                                            background: 'var(--color-bg-sub-header)',
                                                                            minWidth: 0,
                                                                        }}
                                                                    >
                                                                        {isNarrowLayout ? (
                                                                            /* Narrow: 2×2 (+) — Map | Combat / Loadout | Stats */
                                                                            <div
                                                                                style={{
                                                                                    display: 'grid',
                                                                                    gridTemplateColumns: '1fr 1fr',
                                                                                    gridTemplateRows: 'minmax(260px, 300px) minmax(260px, 300px)',
                                                                                    minWidth: 0,
                                                                                    width: '100%',
                                                                                }}
                                                                            >
                                                                                <div
                                                                                    style={{
                                                                                        minWidth: 0,
                                                                                        position: 'relative',
                                                                                        borderRight: '1px solid var(--color-border)',
                                                                                        borderBottom: '1px solid var(--color-border)',
                                                                                        overflow: 'hidden',
                                                                                    }}
                                                                                >
                                                                                    {isExpanded && <MapVisualizer match={match} />}
                                                                                </div>
                                                                                <div
                                                                                    style={{
                                                                                        minWidth: 0,
                                                                                        display: 'flex',
                                                                                        flexDirection: 'column',
                                                                                        borderBottom: '1px solid var(--color-border)',
                                                                                        zIndex: 10,
                                                                                        overflow: 'hidden',
                                                                                    }}
                                                                                >
                                                                                    <CombatLog match={match} />
                                                                                </div>
                                                                                <div
                                                                                    style={{
                                                                                        minWidth: 0,
                                                                                        borderRight: '1px solid var(--color-border)',
                                                                                        overflow: 'hidden',
                                                                                    }}
                                                                                >
                                                                                    <MatchLoadoutPanel match={match} />
                                                                                </div>
                                                                                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                                                                    <MatchStatsPanel match={match} onUserSelect={handleSelectFromMatch} />
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <>
                                                                                <div
                                                                                    style={{
                                                                                        flex: 4,
                                                                                        minWidth: 0,
                                                                                        position: 'relative',
                                                                                        borderRight: '1px solid var(--color-border)',
                                                                                        overflow: 'hidden',
                                                                                    }}
                                                                                >
                                                                                    {isExpanded && <MapVisualizer match={match} />}
                                                                                </div>
                                                                                <div
                                                                                    style={{
                                                                                        flex: 3,
                                                                                        minWidth: 0,
                                                                                        borderRight: '1px solid var(--color-border)',
                                                                                        display: 'flex',
                                                                                        flexDirection: 'column',
                                                                                        zIndex: 10,
                                                                                        overflow: 'hidden',
                                                                                    }}
                                                                                >
                                                                                    <CombatLog match={match} />
                                                                                </div>
                                                                                <div
                                                                                    style={{
                                                                                        flex: 5,
                                                                                        minWidth: 0,
                                                                                        display: 'flex',
                                                                                        flexDirection: 'column',
                                                                                        background: 'var(--color-bg-sub-header)',
                                                                                        overflow: 'hidden',
                                                                                    }}
                                                                                >
                                                                                    <MatchDetailTabs match={match} onUserSelect={handleSelectFromMatch} />
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {totalPages > 1 && (
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'center',
                                                        alignItems: 'center',
                                                        gap: '15px',
                                                        marginTop: '10px',
                                                        padding: '15px 0',
                                                        borderTop: '1px solid var(--color-border)',
                                                    }}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setCurrentPage((p) => Math.max(1, p - 1));
                                                            mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                                                        }}
                                                        disabled={effectiveCurrentPage === 1}
                                                        style={{
                                                            padding: '8px 20px',
                                                            background: effectiveCurrentPage === 1 ? 'var(--color-bg-card-hover)' : 'var(--color-border-light)',
                                                            color: effectiveCurrentPage === 1 ? 'var(--color-text-faint)' : 'var(--color-text-primary)',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            cursor: effectiveCurrentPage === 1 ? 'not-allowed' : 'pointer',
                                                            fontWeight: 'bold',
                                                        }}
                                                    >
                                                        {t('controls.prev', { defaultValue: 'Prev' })}
                                                    </button>
                                                    <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                                                        {effectiveCurrentPage} / {totalPages}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setCurrentPage((p) => Math.min(totalPages, p + 1));
                                                            mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                                                        }}
                                                        disabled={effectiveCurrentPage === totalPages}
                                                        style={{
                                                            padding: '8px 20px',
                                                            background: effectiveCurrentPage === totalPages ? 'var(--color-bg-card-hover)' : 'var(--color-border-light)',
                                                            color: effectiveCurrentPage === totalPages ? 'var(--color-text-faint)' : 'var(--color-text-primary)',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            cursor: effectiveCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                                                            fontWeight: 'bold',
                                                        }}
                                                    >
                                                        {t('controls.next', { defaultValue: 'Next' })}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        </div>
                    </div>
                </div>
                </div>

                {showSideAds && <WebAdRail side="right" />}
            </div>

            {candidates.length > 0 && (
                <PlayerSelectionModal
                    candidates={candidates}
                    onSelect={(selected) => {
                        void loadPlayer(selected);
                        setSearchResetKey((k) => k + 1);
                    }}
                    onClose={() => setCandidates([])}
                    onSearchApi={async () => {}}
                />
            )}
        </div>
    );
}
