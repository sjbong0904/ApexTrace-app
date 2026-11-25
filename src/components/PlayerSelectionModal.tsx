import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatRelativeTime, formatFullRankName, getPlatformInfo, getRelativeTime, getRankTierColor } from '../utils/helpers';
import { FaWindows, FaXbox, FaPlaystation, FaGamepad } from 'react-icons/fa';
import { BsNintendoSwitch } from 'react-icons/bs';
import type { PlayerCandidate } from '../types';

/** Generic so each caller gets back its own candidate type. */
interface PlayerSelectionModalProps<T extends PlayerCandidate> {
    candidates: T[];
    onSelect: (user: T) => void;
    onClose: () => void;
    onSearchApi: () => Promise<void>;
}

const PlatformIcon = ({ hw }: { hw?: number | string | null }) => {
    if (hw === undefined || hw === null) return <FaGamepad color="var(--color-text-faint)" size={14} title="Unknown Platform" />;
    const h = Number(hw);
    if (h === 7 || h === 2) return <FaWindows color="#00a8fc" size={14} title="PC" />;
    if (h === 1) return <FaPlaystation color="#003791" size={16} title="PlayStation" />;
    if (h === 0) return <FaXbox color="#107C10" size={14} title="Xbox" />;
    if (h === 9) return <BsNintendoSwitch color="#e60012" size={14} title="Switch" />;
    return <FaGamepad color="var(--color-text-faint)" size={14} title="Unknown" />;
};

const PlayerSelectionModal = <T extends PlayerCandidate>({ candidates, onSelect, onClose }: PlayerSelectionModalProps<T>) => {
    const { t } = useTranslation();
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    if (!candidates || candidates.length === 0) return null;

    const getTierColor = (rankName: unknown) => getRankTierColor(String(rankName ?? ''));

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}>
            <div style={{ background: 'var(--color-bg-sub-header)', width: '500px', maxHeight: '80vh', borderRadius: '12px', border: '1px solid var(--color-border-light)', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '18px' }}>
                            {t('playerModal.title', 'Select Player')}
                        </h3>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginTop: '4px' }}>
                            {t('playerModal.found', 'Found {{count}} profiles.', { count: candidates.length })}
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '24px', cursor: 'pointer' }}>×</button>
                </div>

                <div style={{ overflowY: 'auto', padding: '15px' }}>
                    {candidates.map((user, idx) => {
                        const platformData = getPlatformInfo(user.hw);
                        const rawRankName = user.rank_name || user.rankName || 'Unranked';
                        const displayRank = rawRankName === 'Apex Predator'
                            ? 'Predator'
                            : formatFullRankName(rawRankName, user.rankDiv ?? user.rank_div);

                        const timePart = getRelativeTime(user.updated_at || user.updatedAt);
                        const lastActiveLabel = !timePart
                            ? t('playerModal.neverSearched', 'Never searched')
                            : formatRelativeTime(timePart, t, {
                                agoKey: 'playerModal.searched',
                                justNowKey: 'playerModal.searchedJustNow',
                            });
                        const legendName = user.legend ? user.legend.toLowerCase() : 'unknown';
                        const portrait = `/images/${legendName}.png`;

                        return (
                            <div
                                key={`${user.uid}-${idx}`}
                                onClick={() => onSelect(user)}
                                onMouseEnter={() => setHoveredIdx(idx)}
                                onMouseLeave={() => setHoveredIdx(null)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '12px 15px',
                                    background: hoveredIdx === idx ? 'var(--color-bg-card-hover)' : 'var(--color-bg-card)',
                                    marginBottom: '10px',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    border: `1px solid ${hoveredIdx === idx ? 'var(--color-border-light)' : 'var(--color-border)'}`,
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', border: `2px solid ${getTierColor(rawRankName)}`, marginRight: '15px', flexShrink: 0 }}>
                                    <img
                                        src={portrait}
                                        alt={user.name}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onError={(e) => { (e.target as HTMLImageElement).src = '/images/unknown.png'; }}
                                    />
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                        <span style={{ color: 'var(--color-text-primary)', fontWeight: 'bold', fontSize: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</span>
                                        {user.matchType === 'alias' && (
                                            <span
                                                style={{
                                                    flexShrink: 0,
                                                    fontSize: '10px',
                                                    fontWeight: 600,
                                                    color: 'var(--color-text-muted)',
                                                    background: 'var(--color-bg-nav)',
                                                    border: '1px solid var(--color-border)',
                                                    borderRadius: '4px',
                                                    padding: '1px 6px',
                                                }}
                                            >
                                                {t('playerModal.formerName', 'Former name')}
                                            </span>
                                        )}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-nav)', borderRadius: '4px', width: '20px', height: '20px', flexShrink: 0 }} title={platformData.label}>
                                            <PlatformIcon hw={user.hw} />
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ color: getTierColor(rawRankName), fontWeight: 'bold' }}>{displayRank}</span>
                                        <span style={{ color: 'var(--color-text-muted)' }}>Lv.{user.level || 0}</span>
                                        <span style={{ color: (timePart && timePart !== 'justNow') ? 'var(--color-success)' : 'var(--color-text-subtle)' }}>
                                            {lastActiveLabel}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ color: 'var(--color-text-subtle)', fontSize: '14px', marginLeft: '10px' }}>❯</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default PlayerSelectionModal;