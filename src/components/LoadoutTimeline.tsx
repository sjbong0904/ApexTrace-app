import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Match } from '../types';
import { formatMatchElapsedTime } from '../utils/helpers';
import { SHORT_WEAPON_NAMES } from '../utils/gameData';
import { getLoadoutRowTheme, getWeaponSilhouetteScale, PROFILE_IMAGE_BASE, WHITE_SILHOUETTE_FILTER } from '../utils/weaponTheme';
import { MATCH_PANEL_BODY_PADDING, MATCH_TIMELINE_CONTENT_HEIGHT, matchTimelineContentStyle, matchTimelineRowGap, matchTimelineRowStyle, matchTimelineTimeStyle } from './matchPanelStyles';

const WEAPON_IMAGE_BASE = PROFILE_IMAGE_BASE;

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
                src={`${WEAPON_IMAGE_BASE}/${weapon}.png`}
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

const LoadoutTimeline = ({ match }: { match: Match }) => {
    const { t } = useTranslation();

    const entries = useMemo(() => {
        return [...(match.weaponTimeline || [])].sort((a, b) => a.timestamp - b.timestamp);
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
                                style={{
                                    ...matchTimelineRowStyle({
                                        background: rowBg,
                                        borderLeft: `4px solid ${borderColor}`,
                                    }),
                                    ...matchTimelineRowGap(index === entries.length - 1),
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
