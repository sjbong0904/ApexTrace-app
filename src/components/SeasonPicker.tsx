import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import AppSelect from './AppSelect';
import type { SeasonBoundary } from '../utils/seasons';
import { findSeasonGroup, groupSeasons, splitNumberOf } from '../utils/seasonGroups';

interface SeasonPickerProps {
    seasons: SeasonBoundary[];
    /** Selected split row id (the anchor; stays a split even in whole-season mode). */
    selectedSeasonId: number;
    wholeSeason: boolean;
    onChange: (next: { seasonId: number; wholeSeason: boolean }) => void;
    compact?: boolean;
}

/** Seasons normally have two splits; slots always show at least Split 1 / Split 2. */
const MIN_SPLIT_SLOTS = 2;

/**
 * Season dropdown (one entry per season, splits grouped), then Split 1 / Split 2 / Season buttons.
 * The buttons are always shown; a split that hasn't started (or isn't listed) is disabled.
 * Season is always available (on a one-split season it covers the same games as that split,
 * but also turns on the account-level season card in Statistics).
 */
const SeasonPicker = ({ seasons, selectedSeasonId, wholeSeason, onChange, compact = false }: SeasonPickerProps) => {
    const { t } = useTranslation();
    const groups = useMemo(() => groupSeasons(seasons), [seasons]);
    const group = findSeasonGroup(groups, selectedSeasonId);
    const wholeActive = wholeSeason;

    /** Split slots by number: listed splits plus empty (disabled) slots up to Split 2. */
    const slots = useMemo(() => {
        const byNumber = new Map<number, SeasonBoundary>();
        group?.splits.forEach((s) => byNumber.set(splitNumberOf(group, s.id), s));
        const maxNumber = Math.max(MIN_SPLIT_SLOTS, ...byNumber.keys());
        return Array.from({ length: maxNumber }, (_, i) => ({ number: i + 1, split: byNumber.get(i + 1) ?? null }));
    }, [group]);

    const seasonLabel = (g: (typeof groups)[number]) => (
        g.seasonNumber != null
            ? t('seasonPicker.season', { season: g.seasonNumber, defaultValue: 'Season {{season}}' })
            : g.splits[0]?.name ?? ''
    );

    const pill = (active: boolean, disabled: boolean): React.CSSProperties => ({
        padding: compact ? '6px 10px' : '6px 12px', fontSize: 11, fontWeight: 'bold',
        border: 'none', borderRadius: 4, cursor: disabled ? 'not-allowed' : 'pointer',
        background: active ? 'var(--color-bg-card-hover)' : 'transparent',
        color: active ? 'var(--color-text-primary)' : 'var(--color-text-faint)',
        opacity: disabled ? 0.35 : 1,
        outline: 'none', boxShadow: 'none', whiteSpace: 'nowrap', flexShrink: 0,
    });

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 8 : 10, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <AppSelect
                sizeVariant="md"
                value={group?.key ?? ''}
                onChange={(e) => {
                    const next = groups.find((g) => g.key === e.target.value);
                    const latest = next?.splits[next.splits.length - 1];
                    if (latest) onChange({ seasonId: latest.id, wholeSeason });
                }}
            >
                {groups.map((g) => (
                    <option key={g.key} value={g.key}>{seasonLabel(g)}</option>
                ))}
            </AppSelect>
            <div role="group" aria-label={t('seasonPicker.splitGroup', { defaultValue: 'Split' })} style={{ display: 'flex', gap: 5, background: 'var(--color-bg-deep)', padding: 4, borderRadius: 6, flexShrink: 0 }}>
                {slots.map(({ number, split }) => {
                    const disabled = !split;
                    const active = !disabled && !wholeActive && split.id === selectedSeasonId;
                    return (
                        <button
                            key={number}
                            type="button"
                            className="btn-tab"
                            aria-pressed={active}
                            disabled={disabled}
                            title={disabled ? t('seasonPicker.splitUnavailable', { defaultValue: 'Not started yet' }) : undefined}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { if (split) onChange({ seasonId: split.id, wholeSeason: false }); }}
                            style={pill(active, disabled)}
                        >
                            {t('seasonPicker.split', { split: number, defaultValue: 'Split {{split}}' })}
                        </button>
                    );
                })}
                <button
                    type="button"
                    className="btn-tab"
                    aria-pressed={wholeActive}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onChange({ seasonId: selectedSeasonId, wholeSeason: true })}
                    style={pill(wholeActive, false)}
                >
                    {t('seasonPicker.wholeSeason', { defaultValue: 'Season' })}
                </button>
            </div>
        </div>
    );
};

export default SeasonPicker;
