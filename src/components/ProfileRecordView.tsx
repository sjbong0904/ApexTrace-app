import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AccountStats } from '../types';
import { getAvgDamageColor, getKdColor, getWinRateColor } from '../utils/helpers';
import { summarizeBrBlock as summarize } from '../utils/accountRecord';

const Cell = ({ label, value, color = 'var(--color-text-primary)', dense }: {
    label: string; value: string; color?: string; dense: boolean;
}) => (
    <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: dense ? '5px 4px' : '7px 6px', borderRadius: 8,
        border: '1px solid var(--color-border)', background: 'rgba(255,255,255,0.03)',
        minWidth: 0, boxSizing: 'border-box',
    }}>
        <span style={{ fontSize: dense ? 9 : 10, fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
            {label}
        </span>
        <span style={{ fontSize: dense ? 13 : 15, fontWeight: 'bold', color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.25 }}>
            {value}
        </span>
    </div>
);

const SectionTitle = ({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, width: '100%', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{children}</span>
        {aside ? <span style={{ fontSize: 10, color: 'var(--color-text-faint)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{aside}</span> : null}
    </div>
);

/**
 * Account-wide record (GEP player_stats career BR, incl. games played without the app).
 * Replaces the rank box + tags under the XP bar; only account-wide numbers, no season data.
 */
const ProfileRecordView = ({ account, dense = false }: { account: AccountStats | null; dense?: boolean }) => {
    const { t } = useTranslation();
    const career = summarize(account?.career?.battle_royale);
    if (!career) return null;
    const grid: React.CSSProperties = {
        display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: dense ? 4 : 6, width: '100%',
    };

    return (
        <div
            title={t('profileRecord.hint', { defaultValue: 'Whole account, including games played without ApexTrace. Filters do not apply.' })}
            style={{ width: '100%', textAlign: 'left' }}
        >
            <SectionTitle aside={t('profileRecord.games', { count: career.games, formatted: career.games.toLocaleString(), defaultValue: '{{formatted}} games' })}>
                {t('profileRecord.careerTitle', { defaultValue: 'All-time BR' })}
            </SectionTitle>
            <div style={grid}>
                <Cell dense={dense} label={t('profileRecord.wins', { defaultValue: 'Wins' })} value={career.wins.toLocaleString()} />
                <Cell dense={dense} label={t('sidebarStats.winRate')} value={`${career.winRate}%`} color={getWinRateColor(career.winRate)} />
                <Cell dense={dense} label={t('sidebarStats.top5Rate', { defaultValue: 'Top 5' })} value={`${career.top5Rate}%`} />
                <Cell dense={dense} label={t('profileRecord.kills', { defaultValue: 'Kills' })} value={career.kills.toLocaleString()} />
                <Cell dense={dense} label={t('statistics.legends.kd', { defaultValue: 'K/D' })} value={career.kd} color={getKdColor(career.kd)} />
                <Cell dense={dense} label={t('sidebarStats.avgDamage')} value={career.avgDamage.toLocaleString()} color={getAvgDamageColor(career.avgDamage)} />
            </div>
        </div>
    );
};

export default ProfileRecordView;
