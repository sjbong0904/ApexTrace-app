import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Match } from '../types';
import { formatMatchElapsedTime } from '../utils/helpers';
import { SHORT_WEAPON_NAMES } from '../utils/gameData';
import { getLoadoutRowTheme, getWeaponSilhouetteUrl, getWeaponSilhouetteScale, WHITE_SILHOUETTE_FILTER } from '../utils/weaponTheme';
import { MATCH_PANEL_BODY_PADDING, MATCH_TIMELINE_CONTENT_HEIGHT, matchTimelineContentStyle, matchTimelineRowGap, matchTimelineRowStyle, matchTimelineTimeStyle } from './matchPanelStyles';

const isEmptyWeapon = (weapon?: string | null) =>
    !weapon || weapon.trim() === '' || weapon.toLowerCase() === 'unknown';

const weaponDisplayName = (weapon?: string | null) =>
    weapon ? (SHORT_WEAPON_NAMES(weapon) ?? weapon.replace(/-/g, ' ')) : '-';

const weaponImageWrapStyle = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    height: '100%',
} as const;

const WeaponImage = ({ weapon }: { weapon?: string | null }) => {
    const [failed, setFailed] = useState(false);
    const displayName = weaponDisplayName(weapon);
    const empty = isEmptyWeapon(weapon);

    if (empty || failed) {
        return (
            <div style={weaponImageWrapStyle}>
                <span style={{ color: 'var(--color-text-faint)', fontSize: '10px', fontWeight: 700 }}>—</span>
            </div>
        );
    }

    const scale = getWeaponSilhouetteScale(weapon);

    return (
        <div style={weaponImageWrapStyle}>
            <img
                src={getWeaponSilhouetteUrl(weapon!)}
                alt={displayName}
                title={displayName}
                style={{
                    maxWidth: '72px',
                    maxHeight: `${MATCH_TIMELINE_CONTENT_HEIGHT}px`,
                    objectFit: 'contain',
                    filter: WHITE_SILHOUETTE_FILTER,
                    transform: scale !== 1 ? `scale(${scale})` : undefined,
                    transformOrigin: 'center',
                }}
                onError={() => setFailed(true)}
            />
        </div>
    );
};

interface LoadoutTimelineProps {
    match: Match;
    /** Row clicked → move the map replay to this epoch-ms moment. */
    onSeek?: (timestamp: number) => void;
    activeTimestamp?: number | null;
}

const LoadoutTimeline = ({ match, onSeek, activeTimestamp = null }: LoadoutTimelineProps) => {
    const { t } = useTranslation();

    const entries = useMemo(() => {
        return [...(match.weaponTimeline || [])]
            .filter((entry) => !isEmptyWeapon(entry.primary) || !isEmptyWeapon(entry.secondary))
            .sort((a, b) => a.timestamp - b.timestamp);
    }, [match.weaponTimeline]);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: MATCH_PANEL_BODY_PADDING }}>
                {entries.length === 0 ? (
                    <div
                        style={{
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '24px',
                            color: 'var(--color-text-muted)',
                            textAlign: 'center',
                            fontSize: '12px',
                            lineHeight: 1.5,
                        }}
                    >
                        {t('matchDetails.noLoadoutTimeline', { defaultValue: 'No weapon changes recorded for this match.' })}
                    </div>
                ) : (
                    entries.map((entry, index) => {
                        const { rowBg, borderColor } = getLoadoutRowTheme(entry.primary, entry.secondary);
                        const timeLabel = formatMatchElapsedTime(entry.timestamp - match.startTime, 'digital');

                        return (
                            <div
                                key={`${entry.timestamp}-${index}`}
                                role={onSeek ? 'button' : undefined}
                                tabIndex={onSeek ? 0 : undefined}
                                title={onSeek ? t('combatLog.seekHint', { defaultValue: 'Show this moment in the replay' }) : undefined}
                                onClick={onSeek ? () => onSeek(entry.timestamp) : undefined}
                                onKeyDown={onSeek ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSeek(entry.timestamp); } } : undefined}
                                style={{
                                    ...matchTimelineRowStyle({
                                        background: rowBg,
                                        borderLeft: `4px solid ${borderColor}`,
                                    }),
                                    ...matchTimelineRowGap(index === entries.length - 1),
                                    cursor: onSeek ? 'pointer' : undefined,
                                    outline: activeTimestamp === entry.timestamp ? '1px solid var(--color-rank-first)' : undefined,
                                    outlineOffset: -1,
                                }}
                            >
                                <div style={matchTimelineTimeStyle}>
                                    {timeLabel}
                                </div>
                                <div style={{ ...matchTimelineContentStyle, gap: '4px' }}>
                                    <WeaponImage weapon={entry.primary} />
                                    <WeaponImage weapon={entry.secondary} />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default LoadoutTimeline;
