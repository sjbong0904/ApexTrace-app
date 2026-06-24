import { useEffect, useMemo, useState } from 'react';
import { fetchHistoryByUid, fetchSeasons, fetchUserStatsByUid, searchCandidates, type RemoteUserStats, type SearchCandidate, type SeasonConfig } from './api';
import { FaList, FaChartBar, FaSearch, FaLink, FaUserCircle } from 'react-icons/fa';
import MapVisualizer from '../components/MapVisualizer';
import MatchStats from '../components/MatchStats';

const getNumeric = (value: unknown): number => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const getPlacement = (match: any): number => {
    const placement = Number(match?.placement);
    return Number.isFinite(placement) && placement > 0 ? placement : 20;
};

const calcSummary = (history: any[]) => {
    if (history.length === 0) {
        return { matches: 0, wins: 0, kills: 0, avgDamage: 0, avgPlacement: 0 };
    }
    const matches = history.length;
    const wins = history.filter((m) => getPlacement(m) === 1).length;
    const kills = history.reduce((sum, m) => sum + getNumeric(m?.kills), 0);
    const totalDamage = history.reduce((sum, m) => sum + getNumeric(m?.damage), 0);
    const totalPlacement = history.reduce((sum, m) => sum + getPlacement(m), 0);

    return {
        matches,
        wins,
        kills,
        avgDamage: Math.round(totalDamage / matches),
        avgPlacement: Number((totalPlacement / matches).toFixed(1)),
    };
};

const sectionStyle: React.CSSProperties = {
    background: 'var(--color-bg-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    padding: 16,
};

const statTileStyle: React.CSSProperties = {
    background: 'var(--color-bg-sub-header)',
    border: '1px solid var(--color-border-light)',
    borderRadius: 8,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
};

const panelCardStyle: React.CSSProperties = {
    background: 'var(--color-bg-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 10,
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
};

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

const isSupportedMode = (mode: string = ''): boolean => {
    const lower = mode.toLowerCase();
    return lower.includes('ranked') || lower.includes('trio') || lower.includes('duo');
};

const getModeType = (mode: string = ''): 'RANKED' | 'TRIO' | 'DUO' | 'OTHER' => {
    const lower = mode.toLowerCase();
    if (lower.includes('ranked')) return 'RANKED';
    if (lower.includes('trio')) return 'TRIO';
    if (lower.includes('duo')) return 'DUO';
    return 'OTHER';
};

const getMatchKey = (match: any): string =>
    String(match.matchId || `${match.startTime || match.endTime || 0}-${match.mode || 'mode'}-${match.map || 'map'}`);

const summarizeEvents = (match: any): string[] => {
    const events = Array.isArray(match?.events) ? match.events : [];
    if (events.length === 0) return [];

    const killEvents = events
        .filter((e: any) => ['kill', 'knockdown', 'assist', 'death'].includes(String(e?.type || '').toLowerCase()))
        .slice(0, 4);

    return killEvents.map((e: any) => {
        const type = String(e?.type || 'event').toUpperCase();
        const attacker = e?.attacker ? String(e.attacker) : '-';
        const victim = e?.victim ? String(e.victim) : '-';
        const weapon = e?.weapon ? ` (${String(e.weapon)})` : '';
        return `${type}: ${attacker} -> ${victim}${weapon}`;
    });
};

export default function SimpleWebApp() {
    const [showLanding, setShowLanding] = useState(true);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [candidates, setCandidates] = useState<SearchCandidate[]>([]);
    const [user, setUser] = useState<RemoteUserStats | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [seasons, setSeasons] = useState<SeasonConfig[]>([]);
    const [selectedSeasonId, setSelectedSeasonId] = useState<number>(0);
    const [selectedMode, setSelectedMode] = useState<'ALL' | 'RANKED' | 'TRIO' | 'DUO'>('ALL');
    const [sortBy, setSortBy] = useState<'LATEST' | 'KILLS' | 'DAMAGE'>('LATEST');
    const [mainTab, setMainTab] = useState<'DASHBOARD' | 'STATISTICS'>('DASHBOARD');
    const [page, setPage] = useState(1);
    const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [toast, setToast] = useState('');
    const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 900);
    const MATCHES_PER_PAGE = 15;

    const filteredHistory = useMemo(() => {
        let list = history.filter((m) => isSupportedMode(m?.mode));

        if (selectedMode !== 'ALL') {
            list = list.filter((m) => getModeType(m?.mode) === selectedMode);
        }

        const currentSeason = seasons.find((season) => season.id === selectedSeasonId);
        if (!currentSeason) return list;

        const nextSeason = seasons
            .filter((season) => season.startTime > currentSeason.startTime)
            .sort((a, b) => a.startTime - b.startTime)[0];

        return list.filter((m) => {
            const matchTime = getNumeric(m?.startTime || m?.endTime);
            if (matchTime <= 0) return true;
            const afterStart = matchTime >= currentSeason.startTime;
            const beforeEnd = nextSeason ? matchTime < nextSeason.startTime : true;
            return afterStart && beforeEnd;
        });
    }, [history, selectedMode, selectedSeasonId, seasons]);

    const sortedHistory = useMemo(() => {
        const copied = [...filteredHistory];
        if (sortBy === 'KILLS') {
            copied.sort((a, b) => getNumeric(b?.kills) - getNumeric(a?.kills));
            return copied;
        }
        if (sortBy === 'DAMAGE') {
            copied.sort((a, b) => getNumeric(b?.damage) - getNumeric(a?.damage));
            return copied;
        }
        copied.sort((a, b) => getNumeric(b?.endTime || b?.startTime) - getNumeric(a?.endTime || a?.startTime));
        return copied;
    }, [filteredHistory, sortBy]);

    const totalPages = Math.max(1, Math.ceil(sortedHistory.length / MATCHES_PER_PAGE));
    const pagedHistory = useMemo(() => {
        const start = (page - 1) * MATCHES_PER_PAGE;
        return sortedHistory.slice(start, start + MATCHES_PER_PAGE);
    }, [page, sortedHistory]);

    const summary = useMemo(() => calcSummary(filteredHistory), [filteredHistory]);
    const winRate = summary.matches > 0 ? ((summary.wins / summary.matches) * 100).toFixed(1) : '0.0';

    const loadPlayer = async (candidate: SearchCandidate, updateHash = true) => {
        setLoading(true);
        setError('');
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
            setPage(1);
            if (updateHash) {
                window.history.replaceState(null, '', `#/player/${encodeURIComponent(candidate.uid)}`);
            }
        } catch {
            setError('플레이어 데이터를 가져오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const onSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = query.trim();
        if (!trimmed) return;

        setLoading(true);
        setError('');
        setCandidates([]);
        try {
            const found = await searchCandidates(trimmed);
            if (found.length === 0) {
                setError('검색 결과가 없습니다.');
                return;
            }
            setShowLanding(false);
            if (found.length === 1) {
                await loadPlayer(found[0]);
                return;
            }
            setCandidates(found.slice(0, 10));
        } catch {
            setError('검색 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const init = async () => {
            const seasonList = await fetchSeasons();
            setSeasons(seasonList);
            if (seasonList.length > 0) {
                setSelectedSeasonId(seasonList[0].id);
            }
        };
        void init();
    }, []);

    useEffect(() => {
        setPage(1);
    }, [selectedMode, selectedSeasonId, sortBy, user?.uid]);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 900);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        const loadFromHash = async () => {
            const uid = parseUidFromHash();
            if (!uid) return;
            setLoading(true);
            setError('');
            try {
                setShowLanding(false);
                const stats = await fetchUserStatsByUid(uid);
                await loadPlayer(toCandidate(uid, stats), false);
            } catch {
                setError('URL에서 유저를 불러오지 못했습니다.');
            } finally {
                setLoading(false);
            }
        };

        void loadFromHash();
        const onHashChange = () => {
            void loadFromHash();
        };
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, []);

    const handleCopyProfileLink = async () => {
        if (!user?.uid) return;
        const link = `${window.location.origin}${window.location.pathname}#/player/${user.uid}`;
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setToast('프로필 링크가 복사되었습니다.');
            window.setTimeout(() => setCopied(false), 1500);
            window.setTimeout(() => setToast(''), 1800);
        } catch {
            setError('링크 복사에 실패했습니다.');
        }
    };

    const handleSelectFromMatchStats = (selected: { uid: string; name: string }) => {
        if (!selected?.uid) return;
        void loadPlayer({
            uid: selected.uid,
            name: selected.name || selected.uid,
            rank_name: 'Unranked',
            rank_score: 0,
            level: 0,
            legend: 'unknown',
        });
    };

    const renderMainContent = (mobileLayout: boolean) => (
        <>
            <div style={{ height: mobileLayout ? 42 : 36, borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-top-bar)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: mobileLayout ? '0 10px' : '0 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img src="/icons/IconMouseOver.png" alt="ApexTrace" style={{ width: mobileLayout ? 16 : 14, height: mobileLayout ? 16 : 14, objectFit: 'contain' }} />
                    <div style={{ fontSize: mobileLayout ? 13 : 12, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: 0.9, fontFamily: "'Segoe UI', Arial, sans-serif", textTransform: 'uppercase' }}>
                        ApexTrace
                    </div>
                </div>
                {!mobileLayout && <div style={{ fontSize: 11, color: 'var(--color-text-faint)' }}>Search / History / Statistics</div>}
            </div>

            {mobileLayout ? (
                <div style={{ height: 'calc(100dvh - 42px)', overflowY: 'auto', overflowX: 'hidden', padding: 10, display: 'grid', gap: 10 }}>
                    <div style={{ ...panelCardStyle, padding: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <button
                            onClick={() => setMainTab('DASHBOARD')}
                            style={{
                                padding: '9px 6px',
                                fontSize: 11,
                                background: mainTab === 'DASHBOARD' ? 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)' : 'var(--color-bg-sub-header)',
                                color: mainTab === 'DASHBOARD' ? 'var(--color-text-primary)' : 'var(--color-text-faint)',
                                border: '1px solid var(--color-border-light)',
                                borderRadius: 10,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                            }}
                        >
                            <FaList size={12} />
                            <span>MATCH</span>
                        </button>
                        <button
                            onClick={() => setMainTab('STATISTICS')}
                            style={{
                                padding: '9px 6px',
                                fontSize: 11,
                                background: mainTab === 'STATISTICS' ? 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)' : 'var(--color-bg-sub-header)',
                                color: mainTab === 'STATISTICS' ? 'var(--color-text-primary)' : 'var(--color-text-faint)',
                                border: '1px solid var(--color-border-light)',
                                borderRadius: 10,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                            }}
                        >
                            <FaChartBar size={12} />
                            <span>STAT</span>
                        </button>
                    </div>

                    <form onSubmit={onSearch} style={{ ...panelCardStyle, padding: 10, display: 'flex', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, color: 'var(--color-text-faint)', border: '1px solid var(--color-border-light)', borderRadius: 8, background: 'var(--color-bg-input)' }}>
                            <FaSearch size={12} />
                        </div>
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="닉네임 또는 UID 검색"
                            style={{ flex: 1, minWidth: 0, background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-light)', borderRadius: 8, padding: '9px 10px', fontSize: 13 }}
                        />
                        <button type="submit" disabled={loading} style={{ padding: '8px 10px', fontSize: 12 }}>
                            {loading ? '검색중...' : '검색'}
                        </button>
                    </form>

                    {error && <div style={{ ...sectionStyle, borderColor: 'var(--color-danger)', color: 'var(--color-danger)', fontSize: 12 }}>{error}</div>}

                    {user && (
                        <div style={{ display: 'grid', gap: 10 }}>
                            <div style={{ ...panelCardStyle, padding: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                        <FaUserCircle size={16} color="var(--color-text-muted)" />
                                        <div style={{ fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name || '-'}</div>
                                    </div>
                                    <button onClick={handleCopyProfileLink} style={{ padding: '6px 10px', fontSize: 11 }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                            <FaLink size={10} />
                                            {copied ? '복사됨' : '링크복사'}
                                        </span>
                                    </button>
                                </div>
                                <div style={{ marginTop: 6, color: 'var(--color-text-muted)', fontSize: 12 }}>
                                    Lv.{getNumeric(user.level) + getNumeric(user.prestige) * 500} / {user.rankName || 'Unranked'} ({getNumeric(user.rankScore)} RP)
                                </div>
                            </div>
                            <div style={{ ...panelCardStyle, padding: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <div style={statTileStyle}><span style={{ color: 'var(--color-text-faint)', fontSize: 11 }}>Matches</span><b style={{ fontSize: 15 }}>{summary.matches}</b></div>
                                <div style={statTileStyle}><span style={{ color: 'var(--color-text-faint)', fontSize: 11 }}>Wins</span><b style={{ fontSize: 15 }}>{summary.wins}</b></div>
                                <div style={statTileStyle}><span style={{ color: 'var(--color-text-faint)', fontSize: 11 }}>Kills</span><b style={{ fontSize: 15 }}>{summary.kills}</b></div>
                                <div style={statTileStyle}><span style={{ color: 'var(--color-text-faint)', fontSize: 11 }}>Win Rate</span><b style={{ fontSize: 15 }}>{winRate}%</b></div>
                            </div>
                        </div>
                    )}

                    <div style={{ ...panelCardStyle, padding: 10, display: 'grid', gap: 8 }}>
                        {user && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <select value={selectedSeasonId} onChange={(e) => setSelectedSeasonId(Number(e.target.value))} style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-light)', borderRadius: 6, padding: '7px 8px', fontSize: 12, fontWeight: 700 }}>
                                    {seasons.map((season) => (
                                        <option key={season.id} value={season.id}>{season.name}</option>
                                    ))}
                                </select>
                                <select value={selectedMode} onChange={(e) => setSelectedMode(e.target.value as 'ALL' | 'RANKED' | 'TRIO' | 'DUO')} style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-light)', borderRadius: 6, padding: '7px 8px', fontSize: 12, fontWeight: 700 }}>
                                    <option value="ALL">ALL</option>
                                    <option value="RANKED">RANKED</option>
                                    <option value="TRIO">TRIO</option>
                                    <option value="DUO">DUO</option>
                                </select>
                                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'LATEST' | 'KILLS' | 'DAMAGE')} style={{ gridColumn: '1 / span 2', background: 'var(--color-bg-card)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-light)', borderRadius: 6, padding: '7px 8px', fontSize: 12, fontWeight: 700 }}>
                                    <option value="LATEST">최신순</option>
                                    <option value="KILLS">킬순</option>
                                    <option value="DAMAGE">데미지순</option>
                                </select>
                            </div>
                        )}

                        {mainTab === 'STATISTICS' ? (
                            <div style={{ ...panelCardStyle, padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div style={statTileStyle}><span style={{ color: 'var(--color-text-faint)', fontSize: 11 }}>Matches</span><b style={{ fontSize: 16 }}>{summary.matches}</b></div>
                                <div style={statTileStyle}><span style={{ color: 'var(--color-text-faint)', fontSize: 11 }}>Wins</span><b style={{ fontSize: 16 }}>{summary.wins}</b></div>
                                <div style={statTileStyle}><span style={{ color: 'var(--color-text-faint)', fontSize: 11 }}>Kills</span><b style={{ fontSize: 16 }}>{summary.kills}</b></div>
                                <div style={statTileStyle}><span style={{ color: 'var(--color-text-faint)', fontSize: 11 }}>Avg Damage</span><b style={{ fontSize: 16 }}>{summary.avgDamage}</b></div>
                                <div style={{ ...statTileStyle, gridColumn: '1 / span 2' }}><span style={{ color: 'var(--color-text-faint)', fontSize: 11 }}>Avg Place</span><b style={{ fontSize: 16 }}>#{summary.avgPlacement || 0}</b></div>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <div style={{ fontWeight: 700 }}>최근 전적 ({filteredHistory.length})</div>
                                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>페이지 {page} / {totalPages}</div>
                                </div>
                                <div style={{ display: 'grid', gap: 8 }}>
                                    {pagedHistory.map((match) => (
                                        <div key={getMatchKey(match)} style={{ background: 'var(--color-bg-sub-header)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 10, fontSize: 13, borderLeft: `4px solid ${getPlacement(match) === 1 ? 'var(--color-rank-first)' : getPlacement(match) <= 5 ? 'var(--color-rank-top5)' : 'var(--color-rank-other)'}` }}>
                                            <button
                                                onClick={() => {
                                                    const matchKey = getMatchKey(match);
                                                    setSelectedMatchId((prev) => (prev === matchKey ? null : matchKey));
                                                }}
                                                style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: 0, color: 'inherit', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}
                                            >
                                                <div><div style={{ fontWeight: 700 }}>{match.mode || 'BR'}</div><div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{match.map || '-'}</div></div>
                                                <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 700 }}>#{getPlacement(match)}</div><div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>K {getNumeric(match.kills)} / D {Math.round(getNumeric(match.damage))}</div></div>
                                                <div style={{ gridColumn: '1 / span 2', fontSize: 12, color: 'var(--color-text-faint)' }}>{match.endTime ? new Date(match.endTime).toLocaleString() : '-'}</div>
                                            </button>
                                            {selectedMatchId === getMatchKey(match) && (
                                                <div style={{ marginTop: 10, borderTop: '1px solid var(--color-border-light)', paddingTop: 10 }}>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, minHeight: 620 }}>
                                                        <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', minHeight: 280 }}>
                                                            <MapVisualizer match={match as any} />
                                                        </div>
                                                        <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', background: 'var(--color-bg-main)', minHeight: 280 }}>
                                                            <MatchStats
                                                                match={match as any}
                                                                onUserSelect={({ uid, name }) => handleSelectFromMatchStats({ uid: String(uid), name })}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {filteredHistory.length === 0 && <div style={{ color: 'var(--color-text-muted)' }}>필터 조건에 맞는 매치 기록이 없습니다.</div>}
                                </div>
                                {filteredHistory.length > 0 && (
                                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: 8 }}>
                                        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '8px 16px', borderRadius: 6, background: page === 1 ? 'var(--color-bg-card-hover)' : 'var(--color-border-light)', color: page === 1 ? 'var(--color-text-faint)' : 'var(--color-text-primary)', border: 'none' }}>이전</button>
                                        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '8px 16px', borderRadius: 6, background: page === totalPages ? 'var(--color-bg-card-hover)' : 'var(--color-border-light)', color: page === totalPages ? 'var(--color-text-faint)' : 'var(--color-text-primary)', border: 'none' }}>다음</button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', height: 'calc(100dvh - 36px)', background: 'var(--color-bg-main)', minWidth: 0 }}>
                    <div style={{ width: 72, flex: '0 0 72px', borderRight: '1px solid var(--color-border)', background: 'var(--color-bg-nav)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, gap: 8 }}>
                        <button
                            onClick={() => setMainTab('DASHBOARD')}
                            style={{
                                width: 56,
                                padding: '8px 4px',
                                fontSize: 10,
                                background: mainTab === 'DASHBOARD'
                                    ? 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)'
                                    : 'transparent',
                                color: mainTab === 'DASHBOARD' ? 'var(--color-text-primary)' : 'var(--color-text-faint)',
                                border: '1px solid var(--color-border-light)',
                                borderRadius: 10,
                                display: 'grid',
                                justifyItems: 'center',
                                gap: 4,
                                boxShadow: mainTab === 'DASHBOARD' ? '0 4px 10px rgba(0,0,0,0.35)' : 'none',
                            }}
                        >
                            <FaList size={12} />
                            <span>MATCH</span>
                        </button>
                        <button
                            onClick={() => setMainTab('STATISTICS')}
                            style={{
                                width: 56,
                                padding: '8px 4px',
                                fontSize: 10,
                                background: mainTab === 'STATISTICS'
                                    ? 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)'
                                    : 'transparent',
                                color: mainTab === 'STATISTICS' ? 'var(--color-text-primary)' : 'var(--color-text-faint)',
                                border: '1px solid var(--color-border-light)',
                                borderRadius: 10,
                                display: 'grid',
                                justifyItems: 'center',
                                gap: 4,
                                boxShadow: mainTab === 'STATISTICS' ? '0 4px 10px rgba(0,0,0,0.35)' : 'none',
                            }}
                        >
                            <FaChartBar size={12} />
                            <span>STAT</span>
                        </button>
                    </div>

                    <div style={{ width: 'clamp(280px, 24vw, 360px)', flex: '0 0 clamp(280px, 24vw, 360px)', borderRight: '1px solid var(--color-border)', background: 'var(--color-bg-panel)', display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
                        <div style={{ padding: 14, borderBottom: '1px solid var(--color-border)' }}>
                            <form onSubmit={onSearch} style={{ ...panelCardStyle, padding: 10, display: 'flex', gap: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, color: 'var(--color-text-faint)', border: '1px solid var(--color-border-light)', borderRadius: 8, background: 'var(--color-bg-input)' }}>
                                    <FaSearch size={12} />
                                </div>
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="닉네임 또는 UID 검색"
                                    style={{ flex: 1, minWidth: 0, background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-light)', borderRadius: 8, padding: '9px 10px', fontSize: 13 }}
                                />
                                <button type="submit" disabled={loading} style={{ padding: '8px 10px', fontSize: 12 }}>
                                    {loading ? '검색중...' : '검색'}
                                </button>
                            </form>
                        </div>

                        {error && <div style={{ margin: 14, ...sectionStyle, borderColor: 'var(--color-danger)', color: 'var(--color-danger)', fontSize: 12 }}>{error}</div>}

                        {user && (
                            <div style={{ padding: 14, display: 'grid', gap: 10, overflowY: 'auto' }}>
                                <div style={panelCardStyle}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                            <FaUserCircle size={16} color="var(--color-text-muted)" />
                                            <div style={{ fontSize: 18, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name || '-'}</div>
                                        </div>
                                        <button onClick={handleCopyProfileLink} style={{ padding: '6px 10px', fontSize: 11 }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                                <FaLink size={10} />
                                                {copied ? '복사됨' : '링크복사'}
                                            </span>
                                        </button>
                                    </div>
                                    <div style={{ marginTop: 6, color: 'var(--color-text-muted)', fontSize: 12 }}>
                                        Lv.{getNumeric(user.level) + getNumeric(user.prestige) * 500} / {user.rankName || 'Unranked'} ({getNumeric(user.rankScore)} RP)
                                    </div>
                                </div>
                                <div style={{ ...panelCardStyle, padding: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                                    <div style={statTileStyle}><span style={{ color: 'var(--color-text-faint)', fontSize: 11 }}>Matches</span><b style={{ fontSize: 15 }}>{summary.matches}</b></div>
                                    <div style={statTileStyle}><span style={{ color: 'var(--color-text-faint)', fontSize: 11 }}>Wins</span><b style={{ fontSize: 15 }}>{summary.wins}</b></div>
                                    <div style={statTileStyle}><span style={{ color: 'var(--color-text-faint)', fontSize: 11 }}>Kills</span><b style={{ fontSize: 15 }}>{summary.kills}</b></div>
                                    <div style={statTileStyle}><span style={{ color: 'var(--color-text-faint)', fontSize: 11 }}>Win Rate</span><b style={{ fontSize: 15 }}>{winRate}%</b></div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0, background: 'var(--color-bg-panel)', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
                        <div style={{ minHeight: 58, borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: 'var(--color-bg-sub-header)', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 18, fontWeight: 700 }}>{mainTab === 'DASHBOARD' ? 'Match History' : 'Simple Statistics'}</div>
                            {user && (
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    <select value={selectedSeasonId} onChange={(e) => setSelectedSeasonId(Number(e.target.value))} style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-light)', borderRadius: 6, padding: '6px 8px', fontSize: 12, fontWeight: 700 }}>
                                        {seasons.map((season) => (
                                            <option key={season.id} value={season.id}>{season.name}</option>
                                        ))}
                                    </select>
                                    <select value={selectedMode} onChange={(e) => setSelectedMode(e.target.value as 'ALL' | 'RANKED' | 'TRIO' | 'DUO')} style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-light)', borderRadius: 6, padding: '6px 8px', fontSize: 12, fontWeight: 700 }}>
                                        <option value="ALL">ALL</option>
                                        <option value="RANKED">RANKED</option>
                                        <option value="TRIO">TRIO</option>
                                        <option value="DUO">DUO</option>
                                    </select>
                                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'LATEST' | 'KILLS' | 'DAMAGE')} style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-light)', borderRadius: 6, padding: '6px 8px', fontSize: 12, fontWeight: 700 }}>
                                        <option value="LATEST">최신순</option>
                                        <option value="KILLS">킬순</option>
                                        <option value="DAMAGE">데미지순</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: 16, minWidth: 0 }}>
                            {mainTab === 'STATISTICS' ? (
                                <div style={{ display: 'grid', gap: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--color-border)', paddingBottom: 10 }}>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            {(['OVERVIEW', 'MAPS', 'LEGENDS', 'WEAPONS'] as const).map((tab) => (
                                                <button
                                                    key={tab}
                                                    style={{
                                                        padding: '8px 14px',
                                                        borderRadius: 4,
                                                        border: 'none',
                                                        fontWeight: 700,
                                                        fontSize: 12,
                                                        background: tab === 'OVERVIEW' ? 'var(--color-accent)' : 'transparent',
                                                        color: tab === 'OVERVIEW' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                                                        cursor: 'default',
                                                    }}
                                                >
                                                    {tab}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div style={{ ...panelCardStyle, padding: 14, display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
                                        <div style={statTileStyle}><span style={{ color: 'var(--color-text-faint)', fontSize: 11 }}>Matches</span><b style={{ fontSize: 16 }}>{summary.matches}</b></div>
                                        <div style={statTileStyle}><span style={{ color: 'var(--color-text-faint)', fontSize: 11 }}>Wins</span><b style={{ fontSize: 16 }}>{summary.wins}</b></div>
                                        <div style={statTileStyle}><span style={{ color: 'var(--color-text-faint)', fontSize: 11 }}>Kills</span><b style={{ fontSize: 16 }}>{summary.kills}</b></div>
                                        <div style={statTileStyle}><span style={{ color: 'var(--color-text-faint)', fontSize: 11 }}>Avg Damage</span><b style={{ fontSize: 16 }}>{summary.avgDamage}</b></div>
                                        <div style={statTileStyle}><span style={{ color: 'var(--color-text-faint)', fontSize: 11 }}>Avg Place</span><b style={{ fontSize: 16 }}>#{summary.avgPlacement || 0}</b></div>
                                    </div>
                                </div>
                            ) : (
                                <div style={panelCardStyle}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                        <div style={{ fontWeight: 700 }}>최근 전적 ({filteredHistory.length})</div>
                                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>페이지 {page} / {totalPages}</div>
                                    </div>
                                    <div style={{ display: 'grid', gap: 8 }}>
                                        {pagedHistory.map((match) => (
                                            <div key={getMatchKey(match)} style={{ background: 'var(--color-bg-sub-header)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 10, fontSize: 13, borderLeft: `4px solid ${getPlacement(match) === 1 ? 'var(--color-rank-first)' : getPlacement(match) <= 5 ? 'var(--color-rank-top5)' : 'var(--color-rank-other)'}` }}>
                                                <button
                                                    onClick={() => {
                                                        const matchKey = getMatchKey(match);
                                                        setSelectedMatchId((prev) => (prev === matchKey ? null : matchKey));
                                                    }}
                                                    style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: 0, color: 'inherit', display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr 0.8fr 0.8fr 1fr', gap: 8 }}
                                                >
                                                    <div>{match.mode || 'BR'}</div>
                                                    <div>{match.map || '-'}</div>
                                                    <div>#{getPlacement(match)}</div>
                                                    <div>K {getNumeric(match.kills)}</div>
                                                    <div>D {Math.round(getNumeric(match.damage))}</div>
                                                    <div>{match.endTime ? new Date(match.endTime).toLocaleString() : '-'}</div>
                                                </button>
                                                {selectedMatchId === getMatchKey(match) && (
                                                    <div style={{ marginTop: 10, borderTop: '1px solid var(--color-border-light)', paddingTop: 10 }}>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10, height: 430 }}>
                                                            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', minHeight: 250 }}>
                                                                <MapVisualizer match={match as any} />
                                                            </div>
                                                            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', background: 'var(--color-bg-main)', minHeight: 250 }}>
                                                                <MatchStats
                                                                    match={match as any}
                                                                    onUserSelect={({ uid, name }) => handleSelectFromMatchStats({ uid: String(uid), name })}
                                                                />
                                                            </div>
                                                        </div>
                                                        {summarizeEvents(match).length > 0 && (
                                                            <div style={{ marginTop: 8, color: 'var(--color-text-muted)' }}>
                                                                <div style={{ marginBottom: 4, fontSize: 12 }}>Kill Log 요약</div>
                                                                <div style={{ display: 'grid', gap: 4 }}>
                                                                    {summarizeEvents(match).map((line, idx) => (
                                                                        <div key={`${getMatchKey(match)}-${idx}`} style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>- {line}</div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {filteredHistory.length === 0 && <div style={{ color: 'var(--color-text-muted)' }}>필터 조건에 맞는 매치 기록이 없습니다.</div>}
                                    </div>
                                    {filteredHistory.length > 0 && (
                                        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: 8 }}>
                                            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '8px 16px', borderRadius: 6, background: page === 1 ? 'var(--color-bg-card-hover)' : 'var(--color-border-light)', color: page === 1 ? 'var(--color-text-faint)' : 'var(--color-text-primary)', border: 'none' }}>이전</button>
                                            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '8px 16px', borderRadius: 6, background: page === totalPages ? 'var(--color-bg-card-hover)' : 'var(--color-border-light)', color: page === totalPages ? 'var(--color-text-faint)' : 'var(--color-text-primary)', border: 'none' }}>다음</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );

    return (
        <div style={{ width: '100%', maxWidth: '100%', minHeight: '100dvh', background: 'var(--color-bg-main)', color: 'var(--color-text-primary)', overflowX: 'hidden' }}>
            {showLanding ? (
                <div style={{ width: '100%', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 14 : 24, boxSizing: 'border-box' }}>
                    <div style={{ width: 'min(860px, 100%)', display: 'grid', gap: isMobile ? 14 : 20, justifyItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <img
                                src="/icons/IconMouseOver.png"
                                alt="ApexTrace"
                                style={{ width: isMobile ? 48 : 64, height: isMobile ? 48 : 64, objectFit: 'contain', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}
                            />
                            <div style={{ fontSize: isMobile ? 30 : 42, fontWeight: 800, letterSpacing: 1.2, fontFamily: "'Segoe UI', Arial, sans-serif", textTransform: 'uppercase' }}>
                                ApexTrace
                            </div>
                        </div>
                        <form onSubmit={onSearch} style={{ width: '100%', display: 'flex', gap: 8, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 14, padding: isMobile ? 8 : 12 }}>
                            <div style={{ width: isMobile ? 36 : 42, borderRadius: 10, border: '1px solid var(--color-border-light)', background: 'var(--color-bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-faint)' }}>
                                <FaSearch size={isMobile ? 13 : 15} />
                            </div>
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="플레이어 닉네임 또는 UID를 입력하세요"
                                style={{ flex: 1, minWidth: 0, background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-light)', borderRadius: 10, padding: isMobile ? '10px 12px' : '12px 14px', fontSize: isMobile ? 15 : 18 }}
                            />
                            <button type="submit" disabled={loading} style={{ padding: isMobile ? '0 14px' : '0 20px', fontSize: isMobile ? 12 : 14, fontWeight: 700 }}>
                                {loading ? '검색중...' : '검색'}
                            </button>
                        </form>
                        {error && (
                            <div style={{ width: '100%', background: 'var(--color-bg-card)', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', borderRadius: 10, padding: '10px 12px', fontSize: 13, textAlign: 'center' }}>
                                {error}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                renderMainContent(isMobile)
            )}

            {toast && (
                <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 1200, background: 'var(--color-success-dark)', color: 'white', padding: '10px 14px', borderRadius: 8, boxShadow: '0 8px 20px rgba(0,0,0,0.3)', fontSize: 13 }}>
                    {toast}
                </div>
            )}

            {candidates.length > 0 && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
                        <div style={{ ...sectionStyle, width: 'min(640px, 100%)', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.45)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <div style={{ fontWeight: 800, fontSize: 18 }}>검색 결과</div>
                                <button onClick={() => setCandidates([])} style={{ padding: '6px 10px' }}>닫기</button>
                            </div>
                            <div style={{ display: 'grid', gap: 8 }}>
                                {candidates.map((c) => (
                                    <button
                                        key={c.uid}
                                        onClick={() => loadPlayer(c)}
                                        style={{
                                            textAlign: 'left',
                                            padding: 12,
                                            background: 'var(--color-bg-sub-header)',
                                            border: '1px solid var(--color-border-light)',
                                            borderRadius: 8,
                                            color: 'var(--color-text-primary)',
                                        }}
                                    >
                                        <div style={{ fontWeight: 700 }}>{c.name}</div>
                                        <div style={{ marginTop: 2, fontSize: 12, color: 'var(--color-text-muted)' }}>
                                            UID: {c.uid} | {c.rank_name || 'Unranked'} ({getNumeric(c.rank_score)} RP)
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

        </div>
    );
}
