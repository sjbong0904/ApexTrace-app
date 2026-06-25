import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import ResizeHandles from './components/ResizeHandle';
import { useWindowAutoResize } from './hooks/useWindowAutoResize';
import Navigation from './components/Navigation';
import Sidebar from './components/Sidebar';
import SidebarStats from './components/SidebarStats';
import type { Match, User } from './types';
import MapVisualizer from './components/MapVisualizer';
import CombatLog from './components/CombatLog';
import MatchDetailTabs from './components/MatchDetailTabs';
import LoadoutDisplay from './components/LoadoutDisplay';
import PerformanceTrend from './components/PerformanceTrend';
import StatisticsTab from './components/StatisticsTab';
import WeaponsTab from './components/weaponsTab';
import { formatRelativeTime, getRankColor, getRelativeTime } from './utils/helpers';
import { FaSearch, FaSync, FaQuestionCircle, FaCrown, FaList, FaStar, FaChartBar, FaCrosshairs, FaCog } from 'react-icons/fa';
import PlayerSelectionModal from './components/PlayerSelectionModal';
import AdUnit from './components/AdUnit';
import SettingsTab from './components/SettingsTab';
import { startTutorial } from './utils/tutorial';
import WindowControls from './components/WindowControls';
import { LocalDB } from './utils/LocalDB';
import { normalizeHistoryForFrontend } from './utils/matchNormalizer';
import {
    clearArchiveSyncState,
    getOldestMatchTime,
    INITIAL_ARCHIVE_SYNC_TARGET,
    isArchiveFullySynced,
    markArchiveFullySynced,
    mergeAndSortHistory,
    withLiveMatchProtection,
} from './utils/historySync';
import { getModeColor, getModeDisplayLabel, isSupportedMode, matchesHistoryTab } from './utils/matchMode';
import NetworkStatus from './components/NetworkStatus';
import GameStatusIndicator from './components/GameStatusIndicator';
import HotkeyReminder from './components/HotkeyReminder';
import { useTranslation } from 'react-i18next';
import { APP_LANGUAGES } from './constants/languages';

interface Season {
  id: number;
  name: string;
  startTime: number;
}

const FALLBACK_SEASONS: Season[] = [
  { id: 3, name: "Season 28 : Split 2", startTime: new Date("2026-03-24T18:00:00Z").getTime() },
  { id: 2, name: "Season 28 : Split 1", startTime: new Date("2026-02-10T18:00:00Z").getTime() },
  { id: 1, name: "Season 27 : Split 2", startTime: 0 }
];

const ProfileLoadingOverlay = ({ label }: { label: string }) => (
    <div style={{
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
    }}>
        <FaSync className="spin-animation" size={22} color="var(--color-warning)" />
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>{label}</span>
    </div>
);

const SearchBar = memo(({ onSearch, isSearching, resetKey }: { onSearch: (query: string) => void, isSearching: boolean, resetKey: number }) => {
    const [localQuery, setLocalQuery] = useState("");
    const { t } = useTranslation(); // 🌟 훅 사용

    useEffect(() => {
        if (resetKey > 0) setLocalQuery("");
    }, [resetKey]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (localQuery.trim().length > 0) {
            onSearch(localQuery); 
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', background: 'var(--color-bg-card)', borderRadius: '6px', border: '1px solid var(--color-border-light)', padding: '0 10px', height: '40px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)' }}>
            <FaSearch color="var(--color-text-faint)" style={{ marginRight: '8px' }} />
            <input
                type="text"
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                onFocus={() => {
                    if (typeof overwolf !== 'undefined') {
                        overwolf.windows.getCurrentWindow((result) => {
                            if (result.success) {
                                overwolf.windows.bringToFront(result.window.id, true, () => {});
                            }
                        });
                    }
                }}
                placeholder={t('search.placeholder')}
                disabled={isSearching}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', fontSize: '14px', width: '100%', outline: 'none', fontWeight: '500' }}
            />
            {isSearching && <FaSync className="spin-animation" color="var(--color-warning)" />}
        </form>
    );
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

const MemoAdUnit = memo(AdUnit);

const App = () => {
    const { t, i18n } = useTranslation(); // 🌟 훅 사용
    const [SEASONS, setSeasons] = useState<Season[]>(FALLBACK_SEASONS);
    const [isPremium] = useState(true);
    const [history, setHistory] = useState<any[]>([]);
    const [user, setUser] = useState<User>({ name: t('search.defaultName'), level: 0, prestige: 0, rankName: '-', rankScore: 0, legend: 'unknown', avatar: null, uid: null });
    const [selectedSeasonId, setSelectedSeasonId] = useState<number>(FALLBACK_SEASONS[0].id);
    const [expandedMatchIds, setExpandedMatchIds] = useState<string[]>([]);
    const [refreshCooldown, setRefreshCooldown] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    const [isProfileLoading, setIsProfileLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("BR");
    const [mainTab, setMainTab] = useState("DASHBOARD");
    const [statusMessage, setStatusMessage] = useState("");
    const [isDownloadingArchive, setIsDownloadingArchive] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const MATCHES_PER_PAGE = 20;
    const [searchResetKey, setSearchResetKey] = useState(0);
    const [lastSearchQuery, setLastSearchQuery] = useState("");
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
    // ConfigController 로드 대기 후 window.SEASONS 읽기
        const tryLoadSeasons = () => {
            const bg = overwolf.windows.getMainWindow() as any;
            if (bg?.SEASONS && bg.SEASONS.length > 0) {
                setSeasons(bg.SEASONS);
            } else {
                setTimeout(tryLoadSeasons, 500); // 아직 안 됐으면 0.5초 후 재시도
            }
        };
        tryLoadSeasons();
    }, []);

    useEffect(() => {
        setSelectedSeasonId(SEASONS[0].id);
    }, [SEASONS]);

    useEffect(() => {
        setCurrentPage(1);
        if (mainScrollRef.current) {
            mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [activeTab, selectedSeasonId, user.uid]);

    useWindowAutoResize(1400, 800);

    const mainScrollRef = useRef<HTMLDivElement>(null);
    const userRef = useRef(user);
    const historyRef = useRef(history);
    const archiveSyncGenerationRef = useRef(0);
    const historyFlushEnabledRef = useRef(false);
    const [searchCandidates, setSearchCandidates] = useState<any[]>([]); 
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [pinnedUid, setPinnedUid] = useState<string | null>(localStorage.getItem('apex_pinned_uid'));
    const [favorites, setFavorites] = useState<User[]>(() => {
        try {
            const saved = localStorage.getItem('apex_favorites');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error("Failed to load favorites:", e);
            return [];
        }
    });

    useEffect(() => {
        overwolf.windows.getCurrentWindow((result) => {
            if (result.success) {
                const windowId = result.window.id;
                overwolf.windows.setTopmost(windowId, false, () => {});
            }
        });
    }, []);

    useEffect(() => { userRef.current = user; }, [user]);
    useEffect(() => { historyRef.current = history; }, [history]);

    useEffect(() => {
        localStorage.setItem('apex_favorites', JSON.stringify(favorites));
    }, [favorites]);

    const showTemporaryStatus = (msg: string) => {
        setStatusMessage(msg);
        setTimeout(() => {
            setStatusMessage("");
        }, 5000);
    };

    const mergeHistoryForUser = useCallback((
        prev: any[],
        freshUser: any,
        rawHistory: any[],
        previousUserUid?: string | null
    ) => {
        const newMatches = normalizeHistoryForFrontend(rawHistory);
        if (prev.length > 0 && previousUserUid && String(previousUserUid) !== String(freshUser.uid)) {
            return newMatches.sort((a: any, b: any) => (b.startTime || b.endTime) - (a.startTime || a.endTime));
        }

        const uniqueMap = new Map<string, any>();
        prev.forEach(m => uniqueMap.set(m.matchId, m));
        newMatches.forEach((m: any) => uniqueMap.set(m.matchId, m));

        return Array.from(uniqueMap.values()).sort((a: any, b: any) =>
            (b.startTime || b.endTime) - (a.startTime || a.endTime)
        );
    }, []);

    const applyProfileToUi = useCallback((
        freshUser: any,
        rawHistory: any[] = [],
        options?: { skipTabSwitch?: boolean }
    ) => {
        const previousUserUid = userRef.current?.uid ?? null;
        setUser(freshUser);

        setFavorites(prevFavs => {
            const existingIndex = prevFavs.findIndex(f => String(f.uid) === String(freshUser.uid));
            if (existingIndex !== -1) {
                const oldUser = prevFavs[existingIndex];
                const newFavs = [...prevFavs];
                newFavs[existingIndex] = { ...oldUser, ...freshUser };
                return newFavs;
            }
            return prevFavs;
        });

        setHistory(prev => mergeHistoryForUser(prev, freshUser, rawHistory, previousUserUid));

        if (!options?.skipTabSwitch) {
            setActiveTab("BR");
            setMainTab("DASHBOARD");
        }
    }, [mergeHistoryForUser]);

    useEffect(() => {
        if (typeof overwolf === 'undefined') return;
        
        // 앱 켰을 때 초기 상태 확인
        overwolf.windows.getCurrentWindow((res) => {
            if (res.success && res.window) {
                setIsMaximized(res.window.stateEx === 'maximized' || res.window.state === 'Maximized');
            }
        });

        // 창이 최대화되거나 복구될 때 실시간 감지
        const onWindowStateChanged = (state: any) => {
            if (state.window_state_ex === 'maximized') setIsMaximized(true);
            else if (state.window_state_ex === 'normal') setIsMaximized(false);
        };

        overwolf.windows.onStateChanged.addListener(onWindowStateChanged);
        return () => overwolf.windows.onStateChanged.removeListener(onWindowStateChanged);
    }, []);

    useEffect(() => {
        if (!user || !user.uid) return;
        const fetchDetail = async () => {
            try {
                const bg = window.overwolf?.windows?.getMainWindow();
                if (bg && bg.apexData) {
                    const result = await bg.apexData.getUserDetail(user.uid);
                    if (result.success) {
                        applyProfileToUi(result.data, result.history ?? [], { skipTabSwitch: true });
                    }
                }
            } catch (e) {
                console.error("Auto-fetch failed:", e);
            }
        };

        if (user.level === 0) {
            fetchDetail();
        }

        const intervalId = setInterval(fetchDetail, 300000);
        return () => clearInterval(intervalId);

    }, [user.uid, user.level, applyProfileToUi]);

    const handleTogglePin = () => {
        if (!user || !user.uid) return;
        if (pinnedUid === user.uid) {
            setPinnedUid(null);
            localStorage.removeItem('apex_pinned_uid');
        } else {
            setPinnedUid(user.uid);
            localStorage.setItem('apex_pinned_uid', user.uid);
        }
    };

    useEffect(() => {
        const savedPin = localStorage.getItem('apex_pinned_uid');
        if (savedPin) handleSelectUser({ uid: savedPin }, true); 
    }, []);

    const handleToggleFavorite = (arg?: any) => {
        const targetUser = (arg && arg.uid) ? arg : user;
        if (!targetUser || !targetUser.uid) return;
        setFavorites(prevFavs => {
            const exists = prevFavs.some(f => String(f.uid) === String(targetUser.uid));
            if (exists) return prevFavs.filter(f => String(f.uid) !== String(targetUser.uid)); 
            else return [...prevFavs, targetUser]; 
        });
    };

    const handleRemoveFavorite = (uidToRemove: string | number) => {
        setFavorites(prevFavs => prevFavs.filter(f => String(f.uid) !== String(uidToRemove)));
    };

    const isCurrentFavorite = useMemo(() => {
        return favorites.some(f => f.uid === user.uid);
    }, [favorites, user.uid]);

    const fetchData = useCallback(() => {
        const bg = window.overwolf?.windows?.getMainWindow() as any;
        const currentUser = userRef.current;

        if (!bg?.apexData) return;

        const bgUser = bg.apexData.user;
        const localUid = bg.Store?.system?.localUser?.uid;

        if (bgUser?.uid) {
            const isEmptyProfile = !currentUser.uid;
            const isViewingMyself = String(currentUser.uid) === String(bgUser.uid);
            const isViewingLocalAccount = localUid && String(currentUser.uid) === String(localUid);

            if (isEmptyProfile || isViewingMyself || isViewingLocalAccount) {
                if (bgUser.name !== currentUser.name || bgUser.rankScore !== currentUser.rankScore) {
                    setUser(bgUser);
                }
            }
        }

        if (typeof bg.apexData.getHistory !== 'function') return;

        const historyOwnerUid = bgUser?.uid;
        const canSyncHistory = currentUser.uid && historyOwnerUid
            && String(currentUser.uid) === String(historyOwnerUid);

        if (!canSyncHistory) return;

        const liveMatches = (bg.apexData.getHistory() || []).filter((m: any) => isSupportedMode(m.mode));

        setHistory(prev => {
            if (liveMatches.length === 0) return prev;

            if (prev.length > 0 && liveMatches.length > 0 &&
                prev[0].matchId === liveMatches[0].matchId && prev.length >= liveMatches.length) {
                return prev;
            }

            const liveIds = new Set(liveMatches.map((m: any) => m.matchId));
            const oldMatches = prev.filter(m => !liveIds.has(m.matchId) && isSupportedMode(m.mode));

            const merged = [...liveMatches, ...oldMatches].sort((a: any, b: any) =>
                (b.startTime || b.endTime) - (a.startTime || a.endTime)
            );
            return merged;
        });
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

    useEffect(() => {
        if (refreshCooldown > 0) {
            const timer = setTimeout(() => setRefreshCooldown(prev => prev - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [refreshCooldown]);

    const handleSearch = async (submittedQuery: string) => {
        setStatusMessage("");
        setLastSearchQuery(submittedQuery.trim());

        if (isSearching) return;
        setIsSearching(true);

        try {
            const bg = window.overwolf?.windows?.getMainWindow();
            if (bg && bg.apexData) {
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error("TIMEOUT")), 8000)
                );

                const query = submittedQuery.trim().toLowerCase();
                const isNumeric = /^\d+$/.test(query);

                let finalCandidates: any[] = [];
                let exactMatchUser: any = null;

                if (isNumeric) {
                    const uidResult: any = await Promise.race([
                        bg.apexData.getUserDetail(query),
                        timeoutPromise
                    ]);

                    if (uidResult?.success) {
                        await handleSelectUser(uidResult.data, false, {
                            data: uidResult.data,
                            history: uidResult.history,
                        });
                        return;
                    }

                    showTemporaryStatus(t('search.notFoundExact'));
                    return;
                } else {
                    const searchPromise = bg.apexData.searchUser(query);
                    const result: any = await Promise.race([searchPromise, timeoutPromise]);

                    if (result.success) {
                        exactMatchUser = result.data;
                    } else if (result.status === 'AMBIGUOUS') {
                        finalCandidates = result.candidates;
                    } else {
                        showTemporaryStatus(t('search.notFoundExact'));
                        setIsSearching(false);
                        return;
                    }
                }

                const exactMatchedCandidates = finalCandidates.filter(user => {
                    const lowerName = (user.name || "").toLowerCase();
                    return lowerName === query || String(user.uid) === query;
                });

                const uniqueCandidates = Array.from(new Map(exactMatchedCandidates.map(item => [item.uid, item])).values())
                    .map(user => ({
                        ...user,
                        rank_name: user.rank_name || user.rankName || 'Unranked',
                        rank_score: user.rank_score || user.rankScore || 0,
                        updated_at: user.updated_at || user.updatedAt || null,
                        level: user.level || 0,
                        legend: user.legend || 'unknown'
                    }));

                uniqueCandidates.sort((a, b) => (b.rank_score || 0) - (a.rank_score || 0));

                const isValidExactMatch = exactMatchUser && (
                    (exactMatchUser.name || "").toLowerCase() === query || 
                    String(exactMatchUser.uid) === query
                );

                if (isValidExactMatch) {
                    await handleSelectUser(exactMatchUser);
                } 
                else if (uniqueCandidates.length === 1) {
                    await handleSelectUser(uniqueCandidates[0]);
                } 
                else if (uniqueCandidates.length > 1) {
                    setSearchCandidates(uniqueCandidates);
                    setShowSearchModal(true);
                } 
                else {
                    showTemporaryStatus(t('search.notFoundExact'));
                }
            }
        } catch (error: any) {
            console.error("Search Logic Error:", error);
            setStatusMessage(error.message === "TIMEOUT" ? t('search.serverTimeout') : t('search.error'));
        } finally {
            setIsSearching(false);
        }
    };

    // 🌟 파라미터에 skipTabSwitch = false 추가
    const handleSelectUser = async (
        selectedUser: any,
        skipTabSwitch: boolean = false,
        preloaded?: { data: any; history?: any[] }
    ) => {
        setShowSearchModal(false);
        setIsSearching(true);
        setIsProfileLoading(true);

        let loadedSuccessfully = false;
        try {
            const bg = window.overwolf?.windows?.getMainWindow();
            if (bg && bg.apexData) {
                if (preloaded?.data) {
                    applyProfileToUi(preloaded.data, preloaded.history ?? [], { skipTabSwitch });
                    loadedSuccessfully = true;
                    return;
                }

                console.log("Loading user with backup cache:", selectedUser.name);
                const result = await bg.apexData.getUserDetail(selectedUser.uid, selectedUser);
                
                if (!result.success) {
                    console.error("❌ API request failed.");
                    if (selectedUser && selectedUser.name) {
                        console.log("⚠️ Falling back to selectedUser for UI display.");
                        const history = await bg.apexData.getHistory();
                        applyProfileToUi({
                            ...selectedUser,
                            level: selectedUser.level || 0,
                            rankScore: selectedUser.rankScore || selectedUser.rank_score || 0,
                            rankName: selectedUser.rankName || selectedUser.rank_name || "Unknown",
                            _source: 'UI_CACHE'
                        }, normalizeHistoryForFrontend(history), { skipTabSwitch });
                        loadedSuccessfully = true;
                        return; 
                    } else {
                        setStatusMessage(t('search.failedToLoad'));
                        return;
                    }
                }

                let freshUser = result.data;

                if (!freshUser.name || freshUser.name.trim() === "") {
                    if (selectedUser.name) {
                        console.warn(`⚠️ [UI Defense] API returned empty name. Forcing name from selection: ${selectedUser.name}`);
                        freshUser.name = selectedUser.name; 
                    } else {
                        console.warn("⚠️ [Data Protection] No name available from API or Cache. Aborting.");
                        setStatusMessage(t('search.serverError')); 
                        return; 
                    }
                }

                applyProfileToUi(freshUser, result.history ?? [], { skipTabSwitch });
                loadedSuccessfully = true;
            }
        } catch (e) {
            console.error("handleSelectUser Error:", e);
            setStatusMessage(t('search.error'));
        } finally {
            if (loadedSuccessfully) setSearchResetKey(k => k + 1);
            setIsProfileLoading(false);
            setIsSearching(false);
        }
    };

    const handleApiSearch = async () => {
        const targetName = searchCandidates.length > 0 ? searchCandidates[0].name : lastSearchQuery;
        if (!targetName) return;
        setIsSearching(true);
        try {
            const bg = window.overwolf?.windows?.getMainWindow();
            if (bg && bg.apexData) {
                const result = await bg.apexData.searchUser(targetName);
                if (result.success) {
                    await handleSelectUser(result.data);
                    setShowSearchModal(false);
                    setSearchCandidates([]);
                } else {
                    alert(t('search.notFoundApi'));
                }
            }
        } catch (e) {
        } finally {
            setIsSearching(false);
        }
    };

    const handleManualRefresh = async () => {
        if (refreshCooldown > 0) return;
        const bg = window.overwolf?.windows?.getMainWindow();
        if (bg && bg.apexData && user.uid) {
            setIsProfileLoading(true);
            try {
                const result = await bg.apexData.getUserDetail(user.uid);
                if (result.success) {
                    applyProfileToUi(result.data, result.history ?? [], { skipTabSwitch: true });
                }
            } catch(e) {} finally {
                setIsProfileLoading(false);
            }
        }
        setRefreshCooldown(30);
    };

    const toggleMatch = (id: string) => {
        setExpandedMatchIds(prev => prev.includes(id) ? prev.filter(matchId => matchId !== id) : [...prev, id]);
    };
    const collapseAll = () => setExpandedMatchIds([]);
    const filteredHistory = useMemo(() => {
        return history.filter(match => {
            if (!matchesHistoryTab(match.mode, activeTab as 'BR' | 'RANKED' | 'TRIO' | 'DUO')) {
                return false;
            }

            const matchTime = match.startTime || match.endTime || 0;
            const currentSeason = SEASONS.find(s => s.id === selectedSeasonId);
            const nextSeason = SEASONS.find(s => s.id === selectedSeasonId + 1);

            if (!currentSeason) return true;

            const isAfterStart = matchTime >= currentSeason.startTime;
            const isBeforeEnd = nextSeason ? matchTime < nextSeason.startTime : true;

            return isAfterStart && isBeforeEnd;
        });
    }, [history, activeTab, selectedSeasonId, SEASONS]);

    const totalPages = Math.max(1, Math.ceil(filteredHistory.length / MATCHES_PER_PAGE));
    const effectiveCurrentPage = Math.min(currentPage, totalPages);
    const currentMatches = useMemo(() => {
        const startIndex = (effectiveCurrentPage - 1) * MATCHES_PER_PAGE;
        return filteredHistory.slice(startIndex, startIndex + MATCHES_PER_PAGE);
    }, [filteredHistory, effectiveCurrentPage]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const syncHistory = useCallback(async () => {
        if (!user.uid) return;
        try {
            const prevHistory = historyRef.current;
            let latestLocalTime = prevHistory.length > 0
                ? (prevHistory[0].endTime || prevHistory[0].startTime)
                : 0;

            if (latestLocalTime === 0) {
                const localMatches = await LocalDB.getMatchesByUid(user.uid);
                latestLocalTime = localMatches.length > 0
                    ? (localMatches[0].endTime || localMatches[0].startTime)
                    : 0;
            }

            const bg = window.overwolf?.windows?.getMainWindow();
            if (!bg?.APIService) return;

            const serverMatches = normalizeHistoryForFrontend(
                await bg.APIService.getHistorySince(user.uid, latestLocalTime + 1),
            );
            if (serverMatches.length === 0) return;

            const validServerMatches = serverMatches.filter((m: Match) => isSupportedMode(m.mode));
            if (validServerMatches.length > 0) {
                await LocalDB.saveMatches(user.uid, validServerMatches);
            }

            setHistory((prev) => withLiveMatchProtection(
                mergeAndSortHistory(prev, validServerMatches),
                prev,
            ));
        } catch (e) { console.error(e); }
    }, [user.uid]);

    const flushHistoryFromLocal = useCallback(async () => {
        if (!user.uid) return;
        try {
            const localMatches = await LocalDB.getMatchesByUid(user.uid);
            setHistory((prev) => withLiveMatchProtection(
                mergeAndSortHistory(localMatches),
                prev,
            ));
        } catch (e) { console.error(e); }
    }, [user.uid]);

    const fetchArchiveChunk = useCallback(async (uid: string, cursor: number) => {
        const bg = window.overwolf?.windows?.getMainWindow();
        if (!bg?.APIService) return [] as Match[];

        const matches = normalizeHistoryForFrontend(await bg.APIService.getArchivedMatches(uid, cursor));
        if (!matches?.length) return [] as Match[];
        return matches.filter((m: Match) => isSupportedMode(m.mode));
    }, []);

    const downloadArchiveInBackground = useCallback(async (
        uid: string,
        startCursor: number,
        generation: number,
    ) => {
        if (isArchiveFullySynced(uid)) return;

        setIsDownloadingArchive(true);
        setDownloadProgress(0);

        let cursor = startCursor;
        let totalDownloaded = 0;
        let hasMore = true;

        try {
            while (hasMore) {
                if (archiveSyncGenerationRef.current !== generation) return;

                const chunk = await fetchArchiveChunk(uid, cursor);
                if (chunk.length === 0) {
                    hasMore = false;
                    break;
                }

                await LocalDB.saveMatches(uid, chunk);
                totalDownloaded += chunk.length;
                setDownloadProgress((prev) => prev + chunk.length);

                const oldestInChunk = Math.min(...chunk.map((m) => m.startTime || m.endTime || cursor));
                if (oldestInChunk >= cursor) {
                    hasMore = false;
                    break;
                }
                cursor = oldestInChunk;
                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            if (archiveSyncGenerationRef.current !== generation) return;

            markArchiveFullySynced(uid);
            await flushHistoryFromLocal();
            if (totalDownloaded > 0) {
                showTemporaryStatus(t('sync.archiveComplete', { count: totalDownloaded }));
            }
        } catch (e) {
            console.error('Archive background sync failed:', e);
        } finally {
            if (archiveSyncGenerationRef.current === generation) {
                setIsDownloadingArchive(false);
            }
        }
    }, [fetchArchiveChunk, flushHistoryFromLocal, t]);

    const runArchiveSyncPipeline = useCallback(async (uid: string, generation: number) => {
        await syncHistory();
        if (archiveSyncGenerationRef.current !== generation) return;

        if (isArchiveFullySynced(uid)) {
            const localMatches = await LocalDB.getMatchesByUid(uid);
            if (localMatches.length === 0) {
                clearArchiveSyncState(uid);
            } else {
                await flushHistoryFromLocal();
                historyFlushEnabledRef.current = true;
                return;
            }
        }

        let localMatches = await LocalDB.getMatchesByUid(uid);
        if (localMatches.length >= INITIAL_ARCHIVE_SYNC_TARGET) {
            await flushHistoryFromLocal();
            historyFlushEnabledRef.current = true;
            if (archiveSyncGenerationRef.current !== generation) return;
            void downloadArchiveInBackground(uid, getOldestMatchTime(localMatches), generation);
            return;
        }

        let cursor = getOldestMatchTime(localMatches);
        while (localMatches.length < INITIAL_ARCHIVE_SYNC_TARGET) {
            if (archiveSyncGenerationRef.current !== generation) return;

            const chunk = await fetchArchiveChunk(uid, cursor);
            if (chunk.length === 0) break;

            await LocalDB.saveMatches(uid, chunk);
            const oldestInChunk = Math.min(...chunk.map((m) => m.startTime || m.endTime || cursor));
            if (oldestInChunk >= cursor) break;
            cursor = oldestInChunk;
            localMatches = await LocalDB.getMatchesByUid(uid);
            await new Promise((resolve) => setTimeout(resolve, 50));
        }

        if (archiveSyncGenerationRef.current !== generation) return;

        await flushHistoryFromLocal();
        historyFlushEnabledRef.current = true;

        localMatches = await LocalDB.getMatchesByUid(uid);
        if (localMatches.length === 0 || isArchiveFullySynced(uid)) return;

        void downloadArchiveInBackground(uid, getOldestMatchTime(localMatches), generation);
    }, [syncHistory, flushHistoryFromLocal, fetchArchiveChunk, downloadArchiveInBackground]);

    useEffect(() => {
        syncHistory();
        const interval = setInterval(syncHistory, 60000);
        return () => clearInterval(interval);
    }, [syncHistory]);

    useEffect(() => {
        if (!user.uid) return;

        historyFlushEnabledRef.current = false;
        setDownloadProgress(0);
        setIsDownloadingArchive(false);

        const generation = ++archiveSyncGenerationRef.current;
        void runArchiveSyncPipeline(user.uid, generation);

        return () => {
            archiveSyncGenerationRef.current += 1;
        };
    }, [user.uid, runArchiveSyncPipeline]);

    useEffect(() => {
        if (!user.uid || !historyFlushEnabledRef.current) return;
        void flushHistoryFromLocal();
    }, [mainTab, currentPage, activeTab, selectedSeasonId, flushHistoryFromLocal, user.uid]);

    const handleHeaderDoubleClick = () => {
        if (typeof overwolf === 'undefined') return;
        overwolf.windows.getCurrentWindow((res) => {
            if (res.success && res.window) {
                const win = res.window;
                if (win.stateEx === "maximized" || win.state === "Maximized") {
                    overwolf.windows.restore(win.id);
                } else {
                    overwolf.windows.maximize(win.id);
                }
            }
        });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', background: 'var(--color-bg-main)', fontFamily: "'Segoe UI', sans-serif", overflow: 'hidden', color: 'var(--color-text-primary)', boxSizing: 'border-box', border: isMaximized ? 'none' : '1px solid var(--color-border-light)' }}>
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .spin-animation {
                    animation: spin 1s linear infinite;
                }
            `}</style>
            
            {!isMaximized && <ResizeHandles />}
            <HotkeyReminder />

            {/* 🌟 상단 드래그 바 (Top Bar) + 언어 선택 드롭다운 */}
            <div 
                onDoubleClick={handleHeaderDoubleClick}
                onMouseDown={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('button, select, input, a')) return;
                    overwolf.windows.getCurrentWindow((result) => {
                        if (result.success && result.window) overwolf.windows.dragMove(result.window.id);
                    });
                }}
                style={{ height: '35px', background: 'var(--color-bg-top-bar)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'default', flexShrink: 0, userSelect: 'none' } as any }>
                
                {/* 왼쪽: 앱 로고 & 타이틀 */}
                <div style={{ paddingLeft: '15px', fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-muted)', letterSpacing: '1px', display: 'flex', alignItems: 'center' }}>
                    <img src="/icons/IconMouseOver.png" style={{ width: '18px', height: '18px', marginRight: '8px', objectFit: 'contain' }} />
                    {t('app.title')}
                </div>
                
                {/* 오른쪽: 언어 선택 & 창 컨트롤 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', paddingRight: '0px' }}>
                    <select 
                        value={i18n.language}
                        onChange={(e) => {
                            const newLang = e.target.value;
                            i18n.changeLanguage(newLang); // 언어 즉시 변경
                            localStorage.setItem('app_language', newLang); // 🌟 변경된 언어를 로컬 스토리지에 저장
                        }}
                        style={{ 
                            background: 'transparent', 
                            color: 'var(--color-text-muted)', 
                            border: 'none', 
                            fontSize: '12px', 
                            outline: 'none', 
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            WebkitAppearance: 'none',
                            MozAppearance: 'none',
                        }}
                        title="Select Language"
                    >
                        {APP_LANGUAGES.map(({ code, label }) => (
                            <option key={code} value={code}>{label}</option>
                        ))}
                    </select>

                    <WindowControls />
                </div>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <div style={{ flex: '0 0 70px', background: 'var(--color-bg-nav)', borderRight: '1px solid var(--color-border)', zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '20px' }}>
                    <Navigation activeTab={mainTab} onTabChange={setMainTab} />
                </div>

                <div style={{ flex: 2, minWidth: '320px', maxWidth: '350px', borderRight: '1px solid var(--color-border)', background: 'var(--color-bg-panel)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ padding: '15px', background: 'var(--color-bg-main)', flexShrink: 0 }}>
                        <SearchBar
                            onSearch={handleSearch}
                            isSearching={isSearching}
                            resetKey={searchResetKey}
                        />
                        {statusMessage && (
                            <div style={{ color: 'var(--color-danger)', fontSize: '11px', marginTop: '5px', textAlign: 'center', fontWeight: 'bold' }}>{statusMessage}</div>
                        )}
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
                        {isProfileLoading && (
                            <ProfileLoadingOverlay label={t('search.loadingProfile')} />
                        )}
                        <div id="sidebar-profile" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto', scrollbarWidth: 'none' }}>
                            <Sidebar 
                                user={user}
                                history={history}
                                isFavorite={isCurrentFavorite} 
                                isPinned={user.uid !== null && user.uid === pinnedUid}
                                hasPinnedUser={!!pinnedUid}
                                onReturnToPinned={() => { if (pinnedUid) handleSelectUser({ uid: pinnedUid }); }}
                                onToggleFavorite={handleToggleFavorite}
                                onTogglePin={handleTogglePin} 
                            />
                        </div>

                        <div style={{ height: '270px', flexShrink: 0, borderTop: '1px solid var(--color-border)', background: isPremium ? 'var(--color-bg-sub-header)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                            {isPremium ? ( <SidebarStats history={history} /> ) : ( <MemoAdUnit width={300} height={250} /> )}
                        </div>
                    </div>
                </div>

                <div style={{ flex: 8, display: 'flex', flexDirection: 'column', background: 'var(--color-bg-panel)', minWidth: '600px', position: 'relative' }}>
                    <NetworkStatus />
                    
                    <div style={{ height: '60px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px', background: 'var(--color-bg-sub-header)' }}>    
                        <div style={{ fontWeight: 'bold', fontSize: '20px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {mainTab === "DASHBOARD" ? <><FaList color="var(--color-text-muted)"/> {t('nav.matchHistory')}</> : 
                             mainTab === "FAVORITES" ? <><FaStar color="#e1b12c"/> {t('nav.favorites')}</> :
                             mainTab === "STATISTICS" ? <><FaChartBar color="#e17055"/> {t('nav.statistics')}</> :
                             mainTab === "WEAPONS" ? <><FaCrosshairs color="#00cec9"/> {t('nav.weapons')}</> : <><FaCog color="var(--color-text-muted)"/> {t('nav.settings')}</>}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            {isDownloadingArchive && (
                                <div style={{ fontSize: '12px', color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '6px', marginRight:'10px' }}>
                                    <FaSync className="spin-animation" /> {t('sync.syncingArchive')} ({downloadProgress})
                                </div>
                            )}

                            {(mainTab === "DASHBOARD" || mainTab === "STATISTICS") && (
                                 <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--color-bg-card)', padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--color-border-light)' }}>
                                    <select 
                                        value={selectedSeasonId} 
                                        onChange={(e) => {
                                            setSelectedSeasonId(Number(e.target.value));
                                            if (mainScrollRef.current) {
                                                mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                                            }
                                        }}
                                        style={{ background: 'transparent', color: 'var(--color-text-muted)', border: 'none', fontSize: '13px', outline: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                                    >
                                        {SEASONS.map(season => (
                                            <option key={season.id} value={season.id}>{season.name}</option>
                                        ))}
                                    </select>
                                 </div>
                            )}

                            <button 
                                onClick={handleManualRefresh} 
                                disabled={refreshCooldown > 0} 
                                style={{ 
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: refreshCooldown > 0 ? 'not-allowed' : 'pointer', 
                                    color: refreshCooldown > 0 ? 'var(--color-border-light)' : 'var(--color-text-dim)', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    padding: '5px',
                                    transition: 'color 0.2s, transform 0.2s',
                                    fontSize: '16px'
                                }} 
                                onMouseEnter={(e) => { 
                                    if(refreshCooldown === 0) {
                                        e.currentTarget.style.color = 'var(--color-text-primary)'; 
                                        e.currentTarget.style.transform = 'scale(1.1) rotate(180deg)'; 
                                    }
                                }}
                                onMouseLeave={(e) => { 
                                    if(refreshCooldown === 0) {
                                        e.currentTarget.style.color = 'var(--color-text-dim)';
                                        e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
                                    }
                                }}
                                title={refreshCooldown > 0 ? t('controls.waitSec', { sec: refreshCooldown }) : t('controls.refresh')}
                            >
                                <FaSync size={18} />
                            </button>

                            <div style={{ marginLeft: '5px' }}>
                                <GameStatusIndicator />
                            </div>
                        </div>
                    </div>
                
                    <div ref={mainScrollRef} style={{ padding: '30px', overflowY: 'auto', flex: 1, height: '100%', paddingBottom: '90px', position: 'relative' }}>
                        {isProfileLoading && mainTab === "DASHBOARD" && (
                            <ProfileLoadingOverlay label={t('search.loadingProfile')} />
                        )}
                        {mainTab === "FAVORITES" ? (
                            <>
                                {favorites.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: 'var(--color-text-faint)', marginTop: '50px', fontSize: '14px' }}>{t('favorites.empty')}<br/></div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '15px' }}>
                                        {favorites.map(fav => (
                                            <div key={fav.uid} onClick={() => handleSelectUser(fav)} style={{ background: 'var(--color-bg-card)', padding: '20px', borderRadius: '10px', border: '1px solid var(--color-border)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'transform 0.2s, background 0.2s', position: 'relative' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-card-hover)'; e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-bg-card)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                                                <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (fav.uid) handleRemoveFavorite(fav.uid); }} style={{ position: 'absolute', top: '10px', right: '10px', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', color: 'var(--color-text-muted)', fontSize: '14px', transition: 'all 0.2s', zIndex: 100 }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-accent-hover)'; e.currentTarget.style.color = 'var(--color-text-primary)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.4)'; e.currentTarget.style.color = 'var(--color-text-dim)'; }}>✕</div>
                                                <img src={`https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/${(fav.legend || 'unknown').toLowerCase()}.png`} alt={fav.name} style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', marginBottom: '10px', border: '2px solid var(--color-border-light)', background: 'var(--color-bg-deep)' }} onError={(e) => { (e.target as HTMLImageElement).src = 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/unknown.png'; }} />
                                                <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '5px', textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fav.name}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}> Lv.{fav.level + 500 * fav.prestige} / {fav.rankScore} RP / {fav.rankName==='Apex Predator' ? t('favorites.predator') : fav.rankName || t('favorites.unranked')}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : mainTab === "STATISTICS" ? (
                            <div style={{ padding: '30px', overflowY: 'auto' }}>
                                <StatisticsTab 
                                    history={history} 
                                    isPremium={isPremium} 
                                    selectedSeasonId={selectedSeasonId}
                                    seasons={SEASONS}
                                    profileUid={user.uid}
                                    profileName={user.name}
                                />
                            </div>
                        ) : mainTab === "WEAPONS" ? (
                            <WeaponsTab />
                        ) : mainTab === "SETTINGS" ? (
                            <SettingsTab isPremium={isPremium} />
                        ) : (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '0px' }}>
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                        {(["BR", "RANKED", "TRIO", "DUO"] as const).map(tab => (
                                            <button
                                                key={tab}
                                                className="btn-tab"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => setActiveTab(tab)}
                                                style={getTabStyle(activeTab === tab)}
                                            >
                                                {t(`statistics.modes.${tab.toLowerCase()}`)}
                                            </button>
                                        ))}
                                    </div>
                                    {expandedMatchIds.length > 0 && (
                                        <button onClick={collapseAll} style={{ marginBottom: '5px', background: 'transparent', border: '1px solid var(--color-border-light)', color: 'var(--color-text-muted)', padding: '4px 10px', cursor: 'pointer', borderRadius: '4px', fontSize: '11px' }}>{t('controls.collapseAll')}</button>
                                    )}
                                </div>
                                
                                <div style={{ marginBottom: '20px' }}><PerformanceTrend history={currentMatches} /></div>
                                {filteredHistory.length === 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'center', padding: '40px', color: 'var(--color-text-subtle)', border: '2px dashed var(--color-border)', borderRadius: '10px', alignItems: 'center', justifyContent: 'center' }}>
                                        <>
                                            <div style={{ marginBottom: '15px', fontSize: '14px', lineHeight: '1.5', color: 'var(--color-text-muted)' }}>{t('match.emptyTitle')}<br />{t('match.emptyDesc')}</div>
                                            <button onClick={startTutorial} style={{ background: 'var(--color-warning)', color: 'var(--color-text-primary)', border: 'none', padding: '10px 20px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.2)', transition: 'transform 0.2s, background 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-warning-hover)'; e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-warning)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                                                <FaQuestionCircle /> {t('controls.tutorial')}
                                            </button>
                                        </>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {currentMatches.map((match: any) => {
                                            const displayRank = (match.placement === 1 || match.placement === '1') ? 1 : match.placement;
                                            const isExpanded = expandedMatchIds.includes(match.matchId);
                                            const legendFile = (match.legend || "unknown").toLowerCase();
                                            const timePart = getRelativeTime(match.endTime || match.startTime);
                                            const timeLabel = formatRelativeTime(timePart, t);
                                            const gameMode = getModeDisplayLabel(match.mode);
                                            const modeColor = getModeColor(match.mode);

                                            return (
                                                <div key={match.matchId} style={{ background: 'var(--color-bg-card)', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 5px rgba(0,0,0,0.2)', border: '1px solid var(--color-border)' }}>
                                                    <div onClick={() => toggleMatch(match.matchId)} style={{ display: 'flex', alignItems: 'center', padding: '15px 20px', cursor: 'pointer', borderLeft: `6px solid ${getRankColor(displayRank)}`, background: isExpanded ? 'var(--color-bg-card-hover)' : 'var(--color-bg-card)', transition: 'background 0.2s' }}>
                                                        <div style={{ position: 'relative', width: '50px', height: '50px', borderRadius: '10px', background: 'var(--color-bg-sub-header)', overflow: 'hidden', marginRight: '20px', border: '2px solid var(--color-border-light)', flexShrink: 0 }}>
                                                            <img src={`https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/${legendFile}.png`} alt={match.legend || "?"} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.1)' }} onError={(e) => { (e.target as HTMLImageElement).src = 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/unknown.png'; }} />
                                                            <div style={{ position: 'absolute', top: 0, left: 0, background: 'color-mix(in srgb, var(--color-bg-deep) 80%, transparent)', color: 'var(--color-text-secondary)', fontSize: '9px', padding: '2px 4px', borderBottomRightRadius: '5px', fontWeight: 'bold', lineHeight: '1', backdropFilter: 'blur(2px)' }}>{timeLabel}</div>
                                                        </div>
                                                        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', alignItems: 'center' }}>
                                                            <div><div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{t('match.rank')}</div><div style={{ fontWeight: 'bold', fontSize: '16px', color: 'var(--color-text-primary)' }}>#{displayRank}</div></div>
                                                            <div><div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{t('match.gamemode')}</div><div style={{ fontWeight: 'bold', fontSize: '14px', color: modeColor, textTransform: 'uppercase' }}>{gameMode}</div></div>
                                                            <div style={{ overflow: 'hidden' }}><div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{t('match.map')}</div><div style={{ fontWeight: 'bold', color: 'var(--color-text-dim)', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }} title={match.map}>{match.map}</div></div>
                                                            <div><div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{t('match.damage')}</div><div style={{ fontWeight: 'bold', color: 'var(--color-danger)', fontSize: '16px' }}>{Math.round(match.damage)}</div></div>
                                                            <div><div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{t('match.kills')}</div><div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', fontSize: '16px' }}>{match.kills}</div></div>
                                                            <div><div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{t('match.assists')}</div><div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', fontSize: '16px' }}>{match.assists || 0}</div></div>
                                                            <div><div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{t('match.knocks')}</div><div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', fontSize: '16px' }}>{match.knocks || 0}</div></div>
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: 'var(--color-text-faint)', marginLeft: '10px', transition: 'transform 0.3s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</div>
                                                    </div>

                                                    <div className={`match-accordion ${isExpanded ? 'open' : ''}`}>
                                                        <div className="match-accordion-inner">
                                                            <div style={{ height: '420px', display: 'flex', borderTop: '1px solid var(--color-border)', background: 'var(--color-bg-sub-header)' }}>
                                                                <div style={{ flex: 5, minWidth: '250px', position: 'relative', borderRight: '1px solid var(--color-border)', overflow: 'hidden' }}>{isExpanded && <MapVisualizer match={match} />}</div>
                                                                <div style={{ flex: 3, minWidth: '280px', borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
                                                                    <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}><CombatLog match={match} /></div>
                                                                    <div style={{ height: '180px', borderTop: '1px solid var(--color-border)', background: 'var(--color-bg-main)', flexShrink: 0 }}><LoadoutDisplay match={match} /></div>
                                                                </div>
                                                                <div style={{ flex: 4, minWidth: '240px', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-main)' }}>
                                                                    <MatchDetailTabs match={match} onUserSelect={handleSelectUser} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {totalPages > 1 && (
                                            <div style={{ 
                                                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', 
                                                marginTop: '10px', padding: '15px 0', borderTop: '1px solid var(--color-border)' 
                                            }}>
                                                <button 
                                                    onClick={() => {
                                                        setCurrentPage(p => Math.max(1, p - 1));
                                                        mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }} 
                                                    disabled={effectiveCurrentPage === 1}
                                                    style={{ 
                                                        padding: '8px 20px', background: effectiveCurrentPage === 1 ? 'var(--color-bg-card-hover)' : 'var(--color-border-light)', 
                                                        color: effectiveCurrentPage === 1 ? 'var(--color-text-faint)' : 'var(--color-text-primary)', border: 'none', 
                                                        borderRadius: '6px', cursor: effectiveCurrentPage === 1 ? 'not-allowed' : 'pointer',
                                                        fontWeight: 'bold', transition: 'background 0.2s'
                                                    }}
                                                >
                                                    {t('controls.prev')}
                                                </button>
                                                
                                                <span style={{ fontSize: '14px', color: 'var(--color-text-dim)', fontWeight: 'bold' }}>
                                                    {t('controls.page')} <span style={{color: 'var(--color-text-primary)'}}>{effectiveCurrentPage}</span> {t('controls.of')} {totalPages}
                                                </span>
                                                
                                                <button 
                                                    onClick={() => {
                                                        setCurrentPage(p => Math.min(totalPages, p + 1));
                                                        mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }} 
                                                    disabled={effectiveCurrentPage === totalPages}
                                                    style={{ 
                                                        padding: '8px 20px', background: effectiveCurrentPage === totalPages ? 'var(--color-bg-card-hover)' : 'var(--color-border-light)', 
                                                        color: effectiveCurrentPage === totalPages ? 'var(--color-text-faint)' : 'var(--color-text-primary)', border: 'none', 
                                                        borderRadius: '6px', cursor: effectiveCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                                                        fontWeight: 'bold', transition: 'background 0.2s'
                                                    }}
                                                >
                                                    {t('controls.next')}
                                                </button>
                                            </div>
                                        )}
                                        {filteredHistory.length > 0 && (
                                            <div style={{ marginTop: '10px', paddingBottom: '20px' }}>
                                                {isPremium && (
                                                    <div style={{ background: 'linear-gradient(90deg, var(--color-success) 0%, var(--color-success-dark) 100%)', color: 'var(--color-text-primary)', fontSize: '12px', fontWeight: 'bold', textAlign: 'center', padding: '8px', borderRadius: '6px', marginBottom: '20px', boxShadow: '0 4px 10px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', animation: 'fadeIn 0.5s' }}>
                                                        <FaCrown /><span>{t('premium.betaUsers')} <b>{t('premium.allUnlocked')}</b></span>
                                                    </div>
                                                )}
                                                {!isPremium ? (
                                                    <div onClick={() => { alert(t('premium.redirecting')); }} style={{ background: `repeating-linear-gradient(45deg, var(--color-bg-sub-header), var(--color-bg-sub-header) 10px, var(--color-bg-table-header) 10px, var(--color-bg-table-header) 20px)`, border: '2px dashed var(--color-border-light)', borderRadius: '8px', padding: '25px', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-warning)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-light)'; }}>
                                                        <div style={{ background: 'var(--color-bg-card-hover)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '20px' }}>🔒</span></div>
                                                        <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{t('premium.archiveTitle')}</div>
                                                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{t('premium.archiveDesc1')} <b>{t('premium.archiveDescBold')}</b>.<br/><span style={{ color: 'var(--color-warning)', fontWeight: 'bold' }}>{t('premium.subscribe')}</span></div>
                                                    </div>
                                                ) : (
                                                    <span></span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    {!isPremium && (
                        <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '728px', height: '90px', background: 'var(--color-bg-sub-header)', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                            <MemoAdUnit width={728} height={90} />
                        </div>
                    )}
                </div>
            </div>
            {showSearchModal && (
                <PlayerSelectionModal 
                    candidates={searchCandidates} 
                    onSelect={handleSelectUser} 
                    onSearchApi={handleApiSearch} 
                    onClose={() => { 
                        setShowSearchModal(false); 
                        setIsSearching(false); 
                    }} 
                />
            )}
        </div>
    );
};

export default App;