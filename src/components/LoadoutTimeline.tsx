import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Match, WeaponTimelineEntry } from '../types';
import { formatMatchTime } from '../utils/helpers';
import { SHORT_WEAPON_NAMES } from '../utils/gameData';

const formatWeapon = (weapon?: string | null) => {
    if (!weapon || weapon.toLowerCase() === 'unknown') return '-';
    return SHORT_WEAPON_NAMES(weapon) ?? weapon.toUpperCase().replace(/-/g, ' ');
};

const formatPair = (primary?: string | null, secondary?: string | null) =>
    `${formatWeapon(primary)} / ${formatWeapon(secondary)}`;

const actionLabel = (entry: WeaponTimelineEntry, t: ReturnType<typeof useTranslation>['t']) => {
    if (!entry.action || entry.action === 'loadout_change') {
        return t('matchDetails.actionLoadoutChange', { defaultValue: 'Loadout Change' });
    }
    return entry.action.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
};

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
                                        <td style={bodyCellStyle}>{formatPair(entry.previousPrimary, entry.previousSecondary)}</td>
                                        <td style={{ ...bodyCellStyle, color: 'var(--color-text-primary)', fontWeight: 700 }}>{formatPair(entry.primary, entry.secondary)}</td>
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
    verticalAlign: 'top',
    lineHeight: 1.35,
};

export default LoadoutTimeline;
