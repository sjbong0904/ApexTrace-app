import React, { useState } from 'react'; // ✅ useState 추가
import { useTranslation } from 'react-i18next'; // ✅ i18n 추가
import { formatRelativeTime, getPlatformInfo, getRelativeTime } from '../utils/helpers';
import { FaWindows, FaXbox, FaPlaystation, FaGamepad } from 'react-icons/fa';
import { BsNintendoSwitch } from 'react-icons/bs';

interface PlayerSelectionModalProps {
    candidates: any[];
    onSelect: (user: any) => void;
    onClose: () => void;
    onSearchApi: () => Promise<void>;
}

const getRankRoman = (div: number | null | undefined) => {
    if (!div) return '';
    if (div === 1) return 'I';
    if (div === 2) return 'II';
    if (div === 3) return 'III';
    if (div === 4) return 'IV';
    return '';
};

const PlatformIcon = ({ hw }: { hw?: number | null }) => {
    if (hw === undefined || hw === null) return <FaGamepad color="var(--color-text-faint)" size={14} title="Unknown Platform" />;
    const h = Number(hw);
    if (h === 7 || h === 2) return <FaWindows color="#00a8fc" size={14} title="PC" />;
    if (h === 1) return <FaPlaystation color="#003791" size={16} title="PlayStation" />;
    if (h === 0) return <FaXbox color="#107C10" size={14} title="Xbox" />;
    if (h === 9) return <BsNintendoSwitch color="#e60012" size={14} title="Switch" />;
    return <FaGamepad color="var(--color-text-faint)" size={14} title="Unknown" />;
};

const PlayerSelectionModal: React.FC<PlayerSelectionModalProps> = ({ candidates, onSelect, onClose }) => {
    const { t } = useTranslation(); // ✅ i18n 훅
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null); // ✅ hover state

    if (!candidates || candidates.length === 0) return null;

    const getTierColor = (rankName: any) => {
        const tier = String(rankName || "").toLowerCase();
        if (tier.includes('gold')) return '#f1c40f';
        if (tier.includes('silver')) return '#bdc3c7';
        if (tier.includes('platinum')) return '#55efc4';
        if (tier.includes('diamond')) return '#74b9ff';
        if (tier.includes('master')) return '#a29bfe';
        if (tier.includes('apex') || tier.includes('predator')) return '#ff7675';
        return 'var(--color-text-muted)';
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}>
            <div style={{ background: 'var(--color-bg-sub-header)', width: '500px', maxHeight: '80vh', borderRadius: '12px', border: '1px solid var(--color-border-light)', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                {/* 헤더 */}
                <div style={{ padding: '20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        {/* ✅ i18n 적용 */}
                        <h3 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '18px' }}>
                            {t('playerModal.title', 'Select Player')}
                        </h3>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginTop: '4px' }}>
                            {t('playerModal.found', 'Found {{count}} profiles.', { count: candidates.length })}
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '24px', cursor: 'pointer' }}>×</button>
                </div>

                {/* 리스트 영역 */}
                <div style={{ overflowY: 'auto', padding: '15px' }}>
                    {candidates.map((user, idx) => {
                        const platformData = getPlatformInfo(user.hw);
                        const rawRankName = user.rank_name || user.rankName || 'Unranked';
                        let displayRank = rawRankName;
                        if (rawRankName === 'Apex Predator') displayRank = 'Predator';

                        const isSpecialRank = ['Unranked', 'Apex Predator', 'Master'].includes(rawRankName);

                        // ✅ roman 실제로 displayRank에 포함
                        if (!isSpecialRank && user.rankDiv) {
                            const roman = getRankRoman(user.rankDiv);
                            if (roman) displayRank = `${rawRankName} ${roman}`;
                        }

                        const timePart = getRelativeTime(user.updated_at || user.updatedAt);
                        const lastActiveLabel = !timePart
                            ? t('playerModal.neverSearched', 'Never searched')
                            : formatRelativeTime(timePart, t, {
                                agoKey: 'playerModal.searched',
                                justNowKey: 'playerModal.searchedJustNow',
                            });
                        const legendName = user.legend ? user.legend.toLowerCase() : 'unknown';
                        const portrait = `https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/${legendName}.png`;

                        return (
                            <div
                                key={`${user.uid}-${idx}`}
                                onClick={() => onSelect(user)}
                                // ✅ DOM 직접 조작 → state 기반 hover
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
                                {/* 아바타 */}
                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', border: `2px solid ${getTierColor(rawRankName)}`, marginRight: '15px', flexShrink: 0 }}>
                                    <img
                                        src={portrait}
                                        alt={user.name} // ✅ alt 추가
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/unknown.png'; }}
                                    />
                                </div>

                                {/* 정보 */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                        <span style={{ color: 'var(--color-text-primary)', fontWeight: 'bold', fontSize: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-nav)', borderRadius: '4px', width: '20px', height: '20px', flexShrink: 0 }} title={platformData.label}>
                                            <PlatformIcon hw={user.hw} />
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ color: getTierColor(rawRankName), fontWeight: 'bold' }}>{displayRank}</span>
                                        <span style={{ color: 'var(--color-text-muted)' }}>Lv.{user.level || 0}</span>
                                        <span style={{ color: (timePart && timePart !== 'justNow') ? '#4ade80' : 'var(--color-text-subtle)' }}>
                                            {lastActiveLabel}
                                        </span>
                                    </div>
                                </div>

                                {/* 화살표 */}
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