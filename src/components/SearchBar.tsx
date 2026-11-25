import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaSearch, FaSync, FaTimes } from 'react-icons/fa';
import { formatFullRankName, getRankTierColor } from '../utils/helpers';
import type { RecentSearchProfile } from '../utils/recentSearches';

const LEGEND_IMG = (legend: string) =>
    `/images/${(legend || 'unknown').toLowerCase()}.png`;
const UNKNOWN_LEGEND_IMG = '/images/unknown.png';

export type SearchBarProps = {
    onSearch: (query: string) => void;
    isSearching: boolean;
    resetKey: number;
    recent: RecentSearchProfile[];
    onSelectRecent: (profile: RecentSearchProfile) => void;
    onRemoveRecent: (uid: string) => void;
    onClearRecent: () => void;
};

const SearchBar = memo(({
    onSearch,
    isSearching,
    resetKey,
    recent,
    onSelectRecent,
    onRemoveRecent,
    onClearRecent,
}: SearchBarProps) => {
    const [localQuery, setLocalQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [hoveredUid, setHoveredUid] = useState<string | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();

    // Parent bumps resetKey after a successful load → clear the box (during render, not in an effect).
    const [seenResetKey, setSeenResetKey] = useState(resetKey);
    if (seenResetKey !== resetKey) {
        setSeenResetKey(resetKey);
        if (resetKey > 0) setLocalQuery('');
    }

    useEffect(() => {
        const onPointerDown = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (localQuery.trim().length > 0) {
            setOpen(false);
            onSearch(localQuery);
        }
    };

    const showDropdown = open && !isSearching && localQuery.trim().length === 0;

    return (
        <div ref={rootRef} style={{ position: 'relative', width: '100%' }}>
            <form
                id="search-bar"
                onSubmit={handleSubmit}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--color-bg-card)',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border-light)',
                    padding: '0 10px',
                    height: '40px',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
                }}
            >
                <FaSearch color="var(--color-text-faint)" style={{ marginRight: '8px' }} />
                <input
                    type="text"
                    value={localQuery}
                    onChange={(e) => {
                        setLocalQuery(e.target.value);
                        if (e.target.value.trim().length === 0) setOpen(true);
                        else setOpen(false);
                    }}
                    onFocus={() => {
                        setOpen(true);
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
                    autoComplete="off"
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-text-secondary)',
                        fontSize: '14px',
                        width: '100%',
                        outline: 'none',
                        fontWeight: '500',
                    }}
                />
                {isSearching && <FaSync className="spin-animation" color="var(--color-warning)" />}
            </form>

            {showDropdown && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        right: 0,
                        zIndex: 40,
                        background: 'var(--color-bg-sub-header)',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: 10,
                        boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px 8px',
                            borderBottom: '1px solid var(--color-border)',
                        }}
                    >
                        <span
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: 'var(--color-text-muted)',
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                            }}
                        >
                            {t('search.recent')}
                        </span>
                        {recent.length > 0 && (
                            <button
                                type="button"
                                onClick={onClearRecent}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--color-text-faint)',
                                    fontSize: 11,
                                    cursor: 'pointer',
                                    padding: 0,
                                }}
                            >
                                {t('search.clearRecent')}
                            </button>
                        )}
                    </div>

                    {recent.length === 0 ? (
                        <div style={{ padding: '16px 12px', fontSize: 12, color: 'var(--color-text-faint)', textAlign: 'center' }}>
                            {t('search.noRecent')}
                        </div>
                    ) : (
                        <div style={{ padding: 6 }}>
                            {recent.map((profile) => {
                                const rankLabel = profile.rankName === 'Apex Predator'
                                    ? t('favorites.predator')
                                    : formatFullRankName(profile.rankName) || t('favorites.unranked');
                                const totalLevel = (profile.prestige || 0) * 500 + (profile.level || 0);
                                const hovered = hoveredUid === profile.uid;
                                return (
                                    <div
                                        key={profile.uid}
                                        onMouseEnter={() => setHoveredUid(profile.uid)}
                                        onMouseLeave={() => setHoveredUid(null)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            padding: '8px 8px',
                                            borderRadius: 8,
                                            cursor: 'pointer',
                                            background: hovered ? 'var(--color-bg-card-hover)' : 'transparent',
                                            transition: 'background 0.15s',
                                        }}
                                        onClick={() => {
                                            setOpen(false);
                                            onSelectRecent(profile);
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: '50%',
                                                overflow: 'hidden',
                                                border: `2px solid ${getRankTierColor(profile.rankName)}`,
                                                flexShrink: 0,
                                                background: 'var(--color-bg-deep)',
                                            }}
                                        >
                                            <img
                                                src={LEGEND_IMG(profile.legend)}
                                                alt=""
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.08)' }}
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = UNKNOWN_LEGEND_IMG;
                                                }}
                                            />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                                style={{
                                                    fontSize: 13,
                                                    fontWeight: 700,
                                                    color: 'var(--color-text-primary)',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                }}
                                            >
                                                {profile.name}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 11,
                                                    color: 'var(--color-text-muted)',
                                                    marginTop: 2,
                                                    display: 'flex',
                                                    gap: 6,
                                                    minWidth: 0,
                                                }}
                                            >
                                                <span style={{ color: getRankTierColor(profile.rankName), fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                    {rankLabel}
                                                </span>
                                                <span style={{ whiteSpace: 'nowrap' }}>{profile.rankScore.toLocaleString()} RP</span>
                                                <span style={{ whiteSpace: 'nowrap' }}>Lv.{totalLevel}</span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            title={t('search.clearRecent')}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRemoveRecent(profile.uid);
                                            }}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'var(--color-text-subtle)',
                                                cursor: 'pointer',
                                                padding: 4,
                                                display: 'flex',
                                                alignItems: 'center',
                                                flexShrink: 0,
                                            }}
                                        >
                                            <FaTimes size={11} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

export default SearchBar;
