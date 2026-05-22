import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import ResizeHandles from './components/ResizeHandle';
import { useWindowAutoResize } from './hooks/useWindowAutoResize';
import { useAppToggle } from './hooks/useAppToggle';
import Navigation from './components/Navigation';
import Sidebar from './components/Sidebar';
import SidebarStats from './components/SidebarStats';
import type { User } from './types';
import MapVisualizer from './components/MapVisualizer';
import CombatLog from './components/CombatLog';
import MatchStats from './components/MatchStats';
import LoadoutDisplay from './components/LoadoutDisplay';
import PerformanceTrend from './components/PerformanceTrend';
import StatisticsTab from './components/StatisticsTab';
import WeaponsTab from './components/weaponsTab';
import { getRankColor, getRelativeTime } from './utils/helpers';
import { FaSearch, FaSync, FaQuestionCircle, FaCrown, FaList, FaStar, FaChartBar, FaCrosshairs, FaCog } from 'react-icons/fa';
import PlayerSelectionModal from './components/PlayerSelectionModal';
import AdUnit from './components/AdUnit';
import SettingsTab from './components/SettingsTab';
import { startTutorial } from './utils/tutorial';
import WindowControls from './components/WindowControls';
import { LocalDB } from './utils/LocalDB';
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

const SearchBar = memo(({ onSearch, isSearching }: { onSearch: (query: string) => void, isSearching: boolean }) => {
    const [localQuery, setLocalQuery] = useState("");
    const { t } = useTranslation(); // 🌟 훅 사용

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (localQuery.trim().length > 0) {
            onSearch(localQuery); 
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', background: '#252525', borderRadius: '6px', border: '1px solid #444', padding: '0 10px', height: '40px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)' }}>
            <FaSearch color="#666" style={{ marginRight: '8px' }} />
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
                style={{ background: 'transparent', border: 'none', color: '#eee', fontSize: '14px', width: '100%', outline: 'none', fontWeight: '500' }}
            />
            {isSearching && <FaSync className="spin-animation" color="#e67e22" />}
        </form>
    );
});

const isSupportedMode = (mode: string = "") => {
    const m = mode.toLowerCase();
    return m.includes('ranked') || m.includes('trio') || m.includes('duo');
};

const getModeColor = (mode: string = "") => {
    const m = mode.toLowerCase();
    if (m.includes('ranked')) return '#d97affff';
    if (m.includes('trio')) return '#509df5ff';
    if (m.includes('duo')) return '#ffaf6dff';
    return '#fd9daaff';
};

const getTabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
    color: isActive ? '#fff' : '#666',
    borderBottom: isActive ? '2px solid #fff' : '2px solid transparent',
    background: 'transparent',
    border: 'none',
    transition: 'all 0.2s'
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
    const [activeTab, setActiveTab] = useState("BR");
    const [mainTab, setMainTab] = useState("DASHBOARD");
    const [statusMessage, setStatusMessage] = useState("");
    const [isDownloadingArchive, setIsDownloadingArchive] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const MATCHES_PER_PAGE = 20;
    const searchInputRef = useRef<HTMLInputElement>(null);
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
    useAppToggle();

    const mainScrollRef = useRef<HTMLDivElement>(null);
    const userRef = useRef(user);
    const historyRef = useRef(history);
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
                        setUser(result.data);
                        if (result.history && result.history.length > 0) {
                            setHistory(prev => {
                                const uniqueMap = new Map();
                                prev.forEach(m => uniqueMap.set(m.matchId, m));
                                result.history.forEach((m: any) => uniqueMap.set(m.matchId, m));
                                return Array.from(uniqueMap.values()).sort((a: any, b: any) => 
                                    (b.startTime || b.endTime) - (a.startTime || a.endTime)
                                );
                            });
                        }
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

    }, [user.uid, user.level]);

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

            let merged = [...liveMatches, ...oldMatches].sort((a: any, b: any) =>
                (b.startTime || b.endTime) - (a.startTime || a.endTime)
            );
            if (!pinnedUid) {
                merged = merged.slice(0, 20);
            }
            return merged;
        });
    }, [pinnedUid]);

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
                    const [uidResult, nameResult] = await Promise.allSettled([
                        bg.apexData.getUserDetail(query),
                        bg.apexData.searchUser(query)
                    ]);

                    if (uidResult.status === 'fulfilled' && uidResult.value.success) {
                        finalCandidates.push(uidResult.value.data);
                    }

                    if (nameResult.status === 'fulfilled' && nameResult.value.success) {
                        if (nameResult.value.data) finalCandidates.push(nameResult.value.data);
                    } else if (nameResult.status === 'fulfilled' && nameResult.value.status === 'AMBIGUOUS') {
                        if (nameResult.value.candidates) finalCandidates = [...finalCandidates, ...nameResult.value.candidates];
                    }
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
                    handleSelectUser(exactMatchUser);
                } 
                else if (uniqueCandidates.length === 1) {
                    handleSelectUser(uniqueCandidates[0]);
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
    const handleSelectUser = async (selectedUser: any, skipTabSwitch: boolean = false) => {
        setShowSearchModal(false);
        setIsSearching(true);
        if (searchInputRef.current) searchInputRef.current.value = "";

        try {
            const bg = window.overwolf?.windows?.getMainWindow();
            if (bg && bg.apexData) {
                console.log("Loading user with backup cache:", selectedUser.name);
                const result = await bg.apexData.getUserDetail(selectedUser.uid, selectedUser);
                
                if (!result.success) {
                    console.error("❌ API request failed.");
                    if (selectedUser && selectedUser.name) {
                        console.log("⚠️ Falling back to selectedUser for UI display.");
                        setUser({
                            ...selectedUser,
                            level: selectedUser.level || 0,
                            rankScore: selectedUser.rankScore || 0,
                            rankName: selectedUser.rankName || "Unknown",
                            _source: 'UI_CACHE'
                        });
                        
                        const history = await bg.apexData.getHistory();
                        setHistory(history || []);
                        
                        // 🌟 탭 강제 이동 방지 조건문 추가
                        if (!skipTabSwitch) {
                            setActiveTab("BR");
                            setMainTab("DASHBOARD");
                        }
                        
                        setIsSearching(false);
                        return; 
                    } else {
                        setStatusMessage(t('search.failedToLoad'));
                        setIsSearching(false);
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
                        setIsSearching(false);
                        return; 
                    }
                }

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

                const newMatches = result.history || [];
                setHistory(prev => {
                    if (prev.length > 0 && prev[0].uid !== freshUser.uid) {
                        return newMatches.sort((a: any, b: any) => (b.startTime || b.endTime) - (a.startTime || a.endTime));
                    }
                    
                    const uniqueMap = new Map();
                    prev.forEach(m => uniqueMap.set(m.matchId, m));
                    newMatches.forEach((m: any) => uniqueMap.set(m.matchId, m));
                    
                    return Array.from(uniqueMap.values()).sort((a: any, b: any) => 
                        (b.startTime || b.endTime) - (a.startTime || a.endTime)
                    );
                });
                
                // 🌟 탭 강제 이동 방지 조건문 추가
                if (!skipTabSwitch) {
                    setActiveTab("BR");
                    setMainTab("DASHBOARD");
                }
            }
        } catch (e) {
            console.error("handleSelectUser Error:", e);
            setStatusMessage(t('search.error'));
        } finally {
            setIsSearching(false);
            if (searchInputRef.current) searchInputRef.current.value = "";
        }
    };

    const handleApiSearch = async () => {
        const currentQuery = searchInputRef.current?.value || "";
        const targetName = searchCandidates.length > 0 ? searchCandidates[0].name : currentQuery;
        if (!targetName) return;
        setIsSearching(true);
        try {
            const bg = window.overwolf?.windows?.getMainWindow();
            if (bg && bg.apexData) {
                const result = await bg.apexData.searchUser(targetName, true); 
                if (result.success) {
                    setUser(result.data);
                    setHistory(result.history || []);
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
            try {
                const result = await bg.apexData.getUserDetail(user.uid);
                if (result.success) {
                    setUser(result.data);
                    if (result.history && result.history.length > 0) {
                        setHistory(prev => {
                            const uniqueMap = new Map();
                            prev.forEach(m => uniqueMap.set(m.matchId, m));
                            result.history.forEach((m: any) => uniqueMap.set(m.matchId, m));
                            return Array.from(uniqueMap.values()).sort((a: any, b: any) => (b.startTime || b.endTime) - (a.startTime || a.endTime));
                        });
                    }
                }
            } catch(e) {}
        }
        setRefreshCooldown(30);
    };

    const toggleMatch = (id: string) => {
        setExpandedMatchIds(prev => prev.includes(id) ? prev.filter(matchId => matchId !== id) : [...prev, id]);
    };
    const collapseAll = () => setExpandedMatchIds([]);
    const filteredHistory = useMemo(() => {
        return history.filter(match => {
            const mode = (match.mode || "").toLowerCase();
            let isModeMatch = false;
            
            if (activeTab === "BR") {
                isModeMatch = mode.includes('ranked') || mode.includes('trio') || mode.includes('duo');
            } 
            else if (activeTab === "RANKED") {
                isModeMatch = mode.includes('ranked');
            } 
            else if (activeTab === "TRIO") {
                isModeMatch = mode.includes('trio') && !mode.includes('ranked');
            } 
            else if (activeTab === "DUO") {
                isModeMatch = mode.includes('duo') && !mode.includes('ranked');
            }

            if (!isModeMatch) return false;

            const matchTime = match.startTime || match.endTime || 0;
            const currentSeason = SEASONS.find(s => s.id === selectedSeasonId);
            const nextSeason = SEASONS.find(s => s.id === selectedSeasonId + 1);

            if (!currentSeason) return true;

            const isAfterStart = matchTime >= currentSeason.startTime;
            const isBeforeEnd = nextSeason ? matchTime < nextSeason.startTime : true;

            return isModeMatch && isAfterStart && isBeforeEnd;
        });
    }, [history, activeTab, selectedSeasonId]);

    const totalPages = Math.ceil(filteredHistory.length / MATCHES_PER_PAGE);
    const currentMatches = useMemo(() => {
        const startIndex = (currentPage - 1) * MATCHES_PER_PAGE;
        return filteredHistory.slice(startIndex, startIndex + MATCHES_PER_PAGE);
    }, [filteredHistory, currentPage]);

    const syncHistory = useCallback(async () => {
        if (!user.uid) return;
        const isMyProfile = (user.uid === pinnedUid);
        if (isPremium && isMyProfile) {
            try {
                const localMatches = await LocalDB.getMatchesByUid(user.uid!);
                let serverMatches: any[] = [];
                const latestLocalTime = localMatches.length > 0 
                    ? (localMatches[0].endTime || localMatches[0].startTime) 
                    : 0;
                const bg = window.overwolf?.windows?.getMainWindow();
                if (bg && bg.APIService) {
                    const url = `https://apex-trace.vercel.app/api/history?uid=${user.uid}&startDate=${latestLocalTime + 1}`;
                    const res = await fetch(url);
                    const json = await res.json();
                    if (json.history) serverMatches = json.history;
                }

                setHistory(prevHistory => {
                    const uniqueMap = new Map();
                    localMatches.forEach((m: any) => uniqueMap.set(m.matchId, m));
                    serverMatches.forEach((m: any) => uniqueMap.set(m.matchId, m));

                    if (prevHistory.length > 0) {
                        const potentialLiveMatch = prevHistory[0];
                        if (!uniqueMap.has(potentialLiveMatch.matchId)) {
                            const matchTime = potentialLiveMatch.endTime || potentialLiveMatch.startTime;
                            const isRecent = (Date.now() - matchTime) < 120000;
                            if (isRecent) {
                                console.log("🛡️ Keeping live match visible (Sync pending):", potentialLiveMatch.matchId);
                                uniqueMap.set(potentialLiveMatch.matchId, potentialLiveMatch);
                            }
                        }
                    }

                    const mergedList = Array.from(uniqueMap.values()).sort((a: any, b: any) => {
                        return (b.startTime || b.endTime) - (a.startTime || a.endTime);
                    });

                    const validServerMatches = serverMatches.filter((m:any) => isSupportedMode(m.mode));
                    if (validServerMatches.length > 0) {
                        LocalDB.saveMatches(user.uid!, validServerMatches).catch(console.error);
                    }   
                    return mergedList;
                });
            } catch (e) { console.error(e); }
        } 
        else {
            const bg = window.overwolf?.windows?.getMainWindow();
            if (bg && bg.apexData) {
                const latestMatches = bg.apexData.getHistory() || [];
                if (latestMatches.length > 0) setHistory(latestMatches);
            }
        }
    }, [user.uid, isPremium, pinnedUid]);

    useEffect(() => {
        syncHistory();
        const interval = setInterval(syncHistory, 60000);
        return () => clearInterval(interval);
    }, [syncHistory]);

    const downloadFullArchive = useCallback(async (currentOldestTime: number) => {
        if (!user.uid || !pinnedUid) return;
        if (String(user.uid) !== String(pinnedUid)) {
            console.log(`🚫 Skipping archive download. UID mismatch. (User: ${user.uid}, Pinned: ${pinnedUid})`);
            return;
        }

        if (localStorage.getItem(`ARCHIVE_FULL_SYNC_${user.uid}`)) {
            console.log("✅ Full Archive already synced (Skipping).");
            return;
        }
        
        setIsDownloadingArchive(true);
        console.log("📚 Starting Full Archive Download...");

        let cursor = currentOldestTime;
        let totalDownloaded = 0;
        let hasMore = true;

        const bg = window.overwolf?.windows?.getMainWindow();
        if (!bg || !bg.APIService) return;

        try {
            while (hasMore) {
                console.log(`📡 Fetching archive older than: ${cursor}`);
                const matches = await bg.APIService.getArchivedMatches(user.uid, cursor);
                if (matches && matches.length > 0) {
                    await LocalDB.saveMatches(user.uid!, matches);
                    const oldestInChunk = Math.min(...matches.map((m: any) => m.startTime || m.endTime));
                    if (oldestInChunk >= cursor) {
                        console.warn("⚠️ Cursor not moving, stopping loop.");
                        hasMore = false;
                        break;
                    }
                    cursor = oldestInChunk;
                    totalDownloaded += matches.length;
                    setDownloadProgress(prev => prev + matches.length);
                    setHistory(prev => {
                        const uniqueMap = new Map();
                        prev.forEach(m => uniqueMap.set(m.matchId, m));
                        matches.forEach((m:any) => uniqueMap.set(m.matchId, m));
                        return Array.from(uniqueMap.values()).sort((a:any, b:any) => b.startTime - a.startTime);
                    });
                    await new Promise(r => setTimeout(r, 100));
                } else {
                    console.log("✅ No more matches from server.");
                    hasMore = false;
                }
            }
            console.log("🎉 Full Archive Download Complete!");
            localStorage.setItem(`ARCHIVE_FULL_SYNC_${user.uid}`, 'true');
            showTemporaryStatus(t('sync.archiveComplete', { count: totalDownloaded }));
        } catch (e) {
            console.error("❌ Archive Download Failed:", e);
        } finally {
            setIsDownloadingArchive(false);
        }
    }, [user.uid, pinnedUid, t]);

    useEffect(() => {
        const initSync = async () => {
            if (!user.uid) return;
            await syncHistory();
            if (isPremium && String(user.uid) === String(pinnedUid)) {
                const localMatches = await LocalDB.getMatchesByUid(user.uid!);
                const oldestTime = localMatches.length > 0 
                    ? Math.min(...localMatches.map((m: any) => m.startTime || m.endTime))
                    : Date.now();
                downloadFullArchive(oldestTime);
            }
        };
        initSync();
    }, [user.uid, isPremium, pinnedUid, syncHistory, downloadFullArchive]);

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
        <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', background: '#1e1e1e', fontFamily: "'Segoe UI', sans-serif", overflow: 'hidden', color: 'white', boxSizing: 'border-box', border: isMaximized ? 'none' : '1px solid #535252' }}>
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
                    if (e.target !== e.currentTarget) return;
                    overwolf.windows.getCurrentWindow((result) => {
                        if (result.success && result.window) overwolf.windows.dragMove(result.window.id);
                    });
                }}
                style={{ height: '35px', background: '#101010', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'default', flexShrink: 0, userSelect: 'none' } as any }>
                
                {/* 왼쪽: 앱 로고 & 타이틀 */}
                <div style={{ paddingLeft: '15px', fontSize: '12px', fontWeight: 'bold', color: '#888', letterSpacing: '1px', display: 'flex', alignItems: 'center' }}>
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
                            color: '#888', 
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
                <div style={{ flex: '0 0 70px', background: '#000', borderRight: '1px solid #333', zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '20px' }}>
                    <Navigation activeTab={mainTab} onTabChange={setMainTab} />
                </div>

                <div style={{ flex: 2, minWidth: '320px', maxWidth: '350px', borderRight: '1px solid #333', background: '#181818', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ padding: '15px', background: '#1e1e1e', flexShrink: 0 }}>
                        <SearchBar
                            onSearch={handleSearch}
                            isSearching={isSearching}
                        />
                        {statusMessage && (
                            <div style={{ color: '#ff6b6b', fontSize: '11px', marginTop: '5px', textAlign: 'center', fontWeight: 'bold' }}>{statusMessage}</div>
                        )}
                    </div>

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

                    <div style={{ height: '270px', flexShrink: 0, borderTop: '1px solid #333', background: isPremium ? '#1a1a1a' : '#4e4e4e00', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                        {isPremium ? ( <SidebarStats history={history} /> ) : ( <MemoAdUnit width={300} height={250} /> )}
                    </div>
                </div>

                <div style={{ flex: 8, display: 'flex', flexDirection: 'column', background: '#181818', minWidth: '600px', position: 'relative' }}>
                    <NetworkStatus />
                    
                    <div style={{ height: '60px', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px', background: '#1a1a1a' }}>    
                        <div style={{ fontWeight: 'bold', fontSize: '20px', color: '#eee', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {mainTab === "DASHBOARD" ? <><FaList color="#888"/> {t('nav.matchHistory')}</> : 
                             mainTab === "FAVORITES" ? <><FaStar color="#e1b12c"/> {t('nav.favorites')}</> :
                             mainTab === "STATISTICS" ? <><FaChartBar color="#e17055"/> {t('nav.statistics')}</> :
                             mainTab === "WEAPONS" ? <><FaCrosshairs color="#00cec9"/> {t('nav.weapons')}</> : <><FaCog color="#aaa"/> {t('nav.settings')}</>}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            {isDownloadingArchive && (
                                <div style={{ fontSize: '12px', color: '#e67e22', display: 'flex', alignItems: 'center', gap: '6px', marginRight:'10px' }}>
                                    <FaSync className="spin-animation" /> {t('sync.syncingArchive')} ({downloadProgress})
                                </div>
                            )}

                            {(mainTab === "DASHBOARD" || mainTab === "STATISTICS") && (
                                 <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#252525', padding: '5px 10px', borderRadius: '6px', border: '1px solid #444' }}>
                                    <select 
                                        value={selectedSeasonId} 
                                        onChange={(e) => {
                                            setSelectedSeasonId(Number(e.target.value));
                                            if (mainScrollRef.current) {
                                                mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                                            }
                                        }}
                                        style={{ background: 'transparent', color: '#8f8f8f', border: 'none', fontSize: '13px', outline: 'none', cursor: 'pointer', fontWeight: 'bold' }}
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
                                    color: refreshCooldown > 0 ? '#444' : '#ccc', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    padding: '5px',
                                    transition: 'color 0.2s, transform 0.2s',
                                    fontSize: '16px'
                                }} 
                                onMouseEnter={(e) => { 
                                    if(refreshCooldown === 0) {
                                        e.currentTarget.style.color = '#fff'; 
                                        e.currentTarget.style.transform = 'scale(1.1) rotate(180deg)'; 
                                    }
                                }}
                                onMouseLeave={(e) => { 
                                    if(refreshCooldown === 0) {
                                        e.currentTarget.style.color = '#ccc';
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
                
                    <div ref={mainScrollRef} style={{ padding: '30px', overflowY: 'auto', flex: 1, height: '100%', paddingBottom: '90px' }}>
                        {mainTab === "FAVORITES" ? (
                            <>
                                {favorites.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#666', marginTop: '50px', fontSize: '14px' }}>{t('favorites.empty')}<br/></div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '15px' }}>
                                        {favorites.map(fav => (
                                            <div key={fav.uid} onClick={() => handleSelectUser(fav)} style={{ background: '#252525', padding: '20px', borderRadius: '10px', border: '1px solid #333', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'transform 0.2s, background 0.2s', position: 'relative' }} onMouseEnter={e => { e.currentTarget.style.background = '#2a2a2a'; e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseLeave={e => { e.currentTarget.style.background = '#252525'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                                                <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (fav.uid) handleRemoveFavorite(fav.uid); }} style={{ position: 'absolute', top: '10px', right: '10px', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', color: '#aaa', fontSize: '14px', transition: 'all 0.2s', zIndex: 100 }} onMouseEnter={e => { e.currentTarget.style.background = '#ff4757'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.4)'; e.currentTarget.style.color = '#ccc'; }}>✕</div>
                                                <img src={`https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/${(fav.legend || 'unknown').toLowerCase()}.png`} alt={fav.name} style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', marginBottom: '10px', border: '2px solid #444', background: '#111' }} onError={(e) => { (e.target as HTMLImageElement).src = 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/unknown.png'; }} />
                                                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', marginBottom: '5px', textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fav.name}</div>
                                                <div style={{ fontSize: '12px', color: '#aaa' }}> Lv.{fav.level + 500 * fav.prestige} / {fav.rankScore} RP / {fav.rankName==='Apex Predator' ? t('favorites.predator') : fav.rankName || t('favorites.unranked')}</div>
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
                                />
                            </div>
                        ) : mainTab === "WEAPONS" ? (
                            <WeaponsTab />
                        ) : mainTab === "SETTINGS" ? (
                            <SettingsTab />
                        ) : (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '0px' }}>
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                        {["BR", "RANKED", "TRIO", "DUO"].map(tab => (
                                            <button key={tab} onClick={() => setActiveTab(tab)} style={getTabStyle(activeTab === tab)}>{tab}</button>
                                        ))}
                                    </div>
                                    {expandedMatchIds.length > 0 && (
                                        <button onClick={collapseAll} style={{ marginBottom: '5px', background: 'transparent', border: '1px solid #444', color: '#aaa', padding: '4px 10px', cursor: 'pointer', borderRadius: '4px', fontSize: '11px' }}>{t('controls.collapseAll')}</button>
                                    )}
                                </div>
                                
                                <div style={{ marginBottom: '20px' }}><PerformanceTrend history={currentMatches} /></div>
                                {filteredHistory.length === 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'center', padding: '40px', color: '#555', border: '2px dashed #333', borderRadius: '10px', alignItems: 'center', justifyContent: 'center' }}>
                                        <>
                                            <div style={{ marginBottom: '15px', fontSize: '14px', lineHeight: '1.5', color: '#888' }}>{t('match.emptyTitle')}<br />{t('match.emptyDesc')}</div>
                                            <button onClick={startTutorial} style={{ background: '#e67e22', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.2)', transition: 'transform 0.2s, background 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#d35400'; e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#e67e22'; e.currentTarget.style.transform = 'translateY(0)'; }}>
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
                                            const timeLabel = getRelativeTime(match.endTime || match.startTime);
                                            const gameMode = match.mode || "Battle Royale";
                                            const modeColor = getModeColor(gameMode);

                                            return (
                                                <div key={match.matchId} style={{ background: '#252525', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 5px rgba(0,0,0,0.2)', border: '1px solid #333' }}>
                                                    <div onClick={() => toggleMatch(match.matchId)} style={{ display: 'flex', alignItems: 'center', padding: '15px 20px', cursor: 'pointer', borderLeft: `6px solid ${getRankColor(displayRank)}`, background: isExpanded ? '#333' : '#252525', transition: 'background 0.2s' }}>
                                                        <div style={{ position: 'relative', width: '50px', height: '50px', borderRadius: '10px', background: '#1a1a1a', overflow: 'hidden', marginRight: '20px', border: '2px solid #444', flexShrink: 0 }}>
                                                            <img src={`https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/${legendFile}.png`} alt={match.legend || "?"} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.1)' }} onError={(e) => { (e.target as HTMLImageElement).src = 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/unknown.png'; }} />
                                                            <div style={{ position: 'absolute', top: 0, left: 0, background: 'rgba(0, 0, 0, 0.7)', color: '#eee', fontSize: '9px', padding: '2px 4px', borderBottomRightRadius: '5px', fontWeight: 'bold', lineHeight: '1', backdropFilter: 'blur(2px)' }}>{timeLabel}</div>
                                                        </div>
                                                        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', alignItems: 'center' }}>
                                                            <div><div style={{ fontSize: '10px', color: '#888' }}>{t('match.rank')}</div><div style={{ fontWeight: 'bold', fontSize: '16px', color: '#fff' }}>#{displayRank}</div></div>
                                                            <div><div style={{ fontSize: '10px', color: '#888' }}>{t('match.gamemode')}</div><div style={{ fontWeight: 'bold', fontSize: '14px', color: modeColor, textTransform: 'uppercase' }}>{gameMode}</div></div>
                                                            <div style={{ overflow: 'hidden' }}><div style={{ fontSize: '10px', color: '#888' }}>{t('match.map')}</div><div style={{ fontWeight: 'bold', color: '#ccc', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }} title={match.map}>{match.map}</div></div>
                                                            <div><div style={{ fontSize: '10px', color: '#888' }}>{t('match.damage')}</div><div style={{ fontWeight: 'bold', color: '#ff6b6b', fontSize: '16px' }}>{Math.round(match.damage)}</div></div>
                                                            <div><div style={{ fontSize: '10px', color: '#888' }}>{t('match.kills')}</div><div style={{ fontWeight: 'bold', color: '#fff', fontSize: '16px' }}>{match.kills}</div></div>
                                                            <div><div style={{ fontSize: '10px', color: '#888' }}>{t('match.assists')}</div><div style={{ fontWeight: 'bold', color: '#fff', fontSize: '16px' }}>{match.assists || 0}</div></div>
                                                            <div><div style={{ fontSize: '10px', color: '#888' }}>{t('match.knocks')}</div><div style={{ fontWeight: 'bold', color: '#fff', fontSize: '16px' }}>{match.knocks || 0}</div></div>
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: '#666', marginLeft: '10px', transition: 'transform 0.3s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</div>
                                                    </div>

                                                    <div className={`match-accordion ${isExpanded ? 'open' : ''}`}>
                                                        <div className="match-accordion-inner">
                                                            <div style={{ height: '420px', display: 'flex', borderTop: '1px solid #333', background: '#1a1a1a' }}>
                                                                <div style={{ flex: 5, minWidth: '250px', position: 'relative', borderRight: '1px solid #333', overflow: 'hidden' }}>{isExpanded && <MapVisualizer match={match} />}</div>
                                                                <div style={{ flex: 3, minWidth: '280px', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
                                                                    <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}><CombatLog match={match} /></div>
                                                                    <div style={{ height: '180px', borderTop: '1px solid #333', background: '#1e1e1e', flexShrink: 0 }}><LoadoutDisplay match={match} /></div>
                                                                </div>
                                                                <div style={{ flex: 4, minWidth: '240px', display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
                                                                    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}><MatchStats match={match} onUserSelect={handleSelectUser}/></div>
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
                                                marginTop: '10px', padding: '15px 0', borderTop: '1px solid #333' 
                                            }}>
                                                <button 
                                                    onClick={() => {
                                                        setCurrentPage(p => Math.max(1, p - 1));
                                                        mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }} 
                                                    disabled={currentPage === 1}
                                                    style={{ 
                                                        padding: '8px 20px', background: currentPage === 1 ? '#2a2a2a' : '#444', 
                                                        color: currentPage === 1 ? '#666' : '#fff', border: 'none', 
                                                        borderRadius: '6px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                                        fontWeight: 'bold', transition: 'background 0.2s'
                                                    }}
                                                >
                                                    {t('controls.prev')}
                                                </button>
                                                
                                                <span style={{ fontSize: '14px', color: '#ccc', fontWeight: 'bold' }}>
                                                    {t('controls.page')} <span style={{color: '#fff'}}>{currentPage}</span> {t('controls.of')} {totalPages}
                                                </span>
                                                
                                                <button 
                                                    onClick={() => {
                                                        setCurrentPage(p => Math.min(totalPages, p + 1));
                                                        mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }} 
                                                    disabled={currentPage === totalPages}
                                                    style={{ 
                                                        padding: '8px 20px', background: currentPage === totalPages ? '#2a2a2a' : '#444', 
                                                        color: currentPage === totalPages ? '#666' : '#fff', border: 'none', 
                                                        borderRadius: '6px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
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
                                                    <div style={{ background: 'linear-gradient(90deg, #2ecc71 0%, #27ae60 100%)', color: '#fff', fontSize: '12px', fontWeight: 'bold', textAlign: 'center', padding: '8px', borderRadius: '6px', marginBottom: '20px', boxShadow: '0 4px 10px rgba(46, 204, 113, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', animation: 'fadeIn 0.5s' }}>
                                                        <FaCrown /><span>{t('premium.betaUsers')} <b>{t('premium.allUnlocked')}</b></span>
                                                    </div>
                                                )}
                                                {!isPremium ? (
                                                    <div onClick={() => { alert(t('premium.redirecting')); }} style={{ background: `repeating-linear-gradient(45deg, #1a1a1a, #1a1a1a 10px, #202020 10px, #202020 20px)`, border: '2px dashed #444', borderRadius: '8px', padding: '25px', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#e67e22'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#444'; }}>
                                                        <div style={{ background: '#333', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '20px' }}>🔒</span></div>
                                                        <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff' }}>{t('premium.archiveTitle')}</div>
                                                        <div style={{ fontSize: '12px', color: '#aaa' }}>{t('premium.archiveDesc1')} <b>{t('premium.archiveDescBold')}</b>.<br/><span style={{ color: '#e67e22', fontWeight: 'bold' }}>{t('premium.subscribe')}</span></div>
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
                        <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '728px', height: '90px', background: '#5e5e5e', borderTop: '1px solid #00000000', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
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
                        if (searchInputRef.current) searchInputRef.current.value = ""; 
                    }} 
                />
            )}
        </div>
    );
};

export default App;