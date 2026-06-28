import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Match, WeaponTimelineEntry } from '../types';
import { formatMatchTime } from '../utils/helpers';
import { SHORT_WEAPON_NAMES } from '../utils/gameData';

const WEAPON_IMAGE_BASE = 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images';

const isEmptyWeapon = (weapon?: string | null) =>
    !weapon || weapon.trim() === '' || weapon.toLowerCase() === 'unknown';

const actionLabel = (entry: WeaponTimelineEntry, t: ReturnType<typeof useTranslation>['t']) => {
    if (!entry.action || entry.action === 'loadout_change') {
        return t('matchDetails.actionLoadoutChange', { defaultValue: 'Loadout Change' });
    }
    return entry.action.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
};

const WeaponImage = ({ weapon }: { weapon?: string | null }) => {
    const [failed, setFailed] = useState(false);
    const displayName = weapon ? (SHORT_WEAPON_NAMES(weapon) ?? weapon.toUpperCase().replace(/-/g, ' ')) : '-';

    if (isEmptyWeapon(weapon)) {
        return (
            <div
                title={displayName}
                style={{
                    width: '52px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: '4px',
                    color: 'var(--color-border)',
                    fontSize: '10px',
                    fontWeight: 700,
                }}
            >
                -
            </div>
        );
    }

    if (failed) {
        return (
            <div
                title={displayName}
                style={{
                    width: '52px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: '4px',
                    padding: '0 4px',
                }}
            >
                <span style={{ color: 'var(--color-warning)', fontSize: '8px', textAlign: 'center', lineHeight: 1.2, wordBreak: 'break-all' }}>
                    {displayName}
                </span>
            </div>
        );
    }

    return (
        <div
            style={{
                width: '52px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '4px',
            }}
        >
            <img
                src={`${WEAPON_IMAGE_BASE}/${weapon}.png`}
                alt={displayName}
                title={displayName}
                style={{
                    maxWidth: '48px',
                    maxHeight: '24px',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.45))',
                }}
                onError={() => setFailed(true)}
            />
        </div>
    );
};

const WeaponPairImages = ({ primary, secondary }: { primary?: string | null; secondary?: string | null }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <WeaponImage weapon={primary} />
        <span style={{ color: 'var(--color-text-faint)', fontSize: '9px', fontWeight: 700 }}>/</span>
        <WeaponImage weapon={secondary} />
    </div>
);

const LoadoutTimeline = ({ match }: { match: Match }) => {
    const { t } = useTranslation();

    const entries = useMemo(() => {
        return [...(match.weaponTimeline || [])].sort((a, b) => a.timestamp - b.timestamp);
    }, [match.weaponTimeline]);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-main)' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
                <div style={{ color: 'var(--color-text-primary)', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {t('matchDetails.loadoutTimeline', { defaultValue: 'Loadout Timeline' })}
                </div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: '11px', marginTop: '4px' }}>
                    {t('matchDetails.loadoutTimelineDesc', { defaultValue: 'Weapon changes detected during this match.' })}
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                {entries.length === 0 ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', color: 'var(--color-text-muted)', textAlign: 'center', fontSize: '12px', lineHeight: 1.5 }}>
                        {t('matchDetails.noLoadoutTimeline', { defaultValue: 'No weapon changes recorded for this match.' })}
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--color-bg-table-header)' }}>
                            <tr>
                                <th style={headerCellStyle}>{t('matchDetails.time', { defaultValue: 'Time' })}</th>
                                <th style={headerCellStyle}>{t('matchDetails.before', { defaultValue: 'Before' })}</th>
                                <th style={headerCellStyle}>{t('matchDetails.after', { defaultValue: 'After' })}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((entry, index) => {
                                const elapsed = Math.max(0, entry.timestamp - match.startTime);
                                return (
                                    <tr key={`${entry.timestamp}-${index}`} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                        <td style={{ ...bodyCellStyle, color: 'var(--color-warning)', fontWeight: 800, whiteSpace: 'nowrap' }}>
                                            {formatMatchTime(elapsed)}
                                            <div style={{ color: 'var(--color-text-faint)', fontSize: '9px', fontWeight: 700, marginTop: '2px' }}>{actionLabel(entry, t)}</div>
                                        </td>
                                        <td style={bodyCellStyle}>
                                            <WeaponPairImages primary={entry.previousPrimary} secondary={entry.previousSecondary} />
                                        </td>
                                        <td style={bodyCellStyle}>
                                            <WeaponPairImages primary={entry.primary} secondary={entry.secondary} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

const headerCellStyle: React.CSSProperties = {
    padding: '9px 10px',
    color: 'var(--color-text-muted)',
    fontSize: '10px',
    textAlign: 'left',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
};

const bodyCellStyle: React.CSSProperties = {
    padding: '10px',
    color: 'var(--color-text-dim)',
    verticalAlign: 'middle',
    lineHeight: 1.35,
};

export default LoadoutTimeline;
