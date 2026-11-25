import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCrown, FaTimes, FaCheck, FaBell } from 'react-icons/fa';
import { PREMIUM_DIALOG_EVENT, PREMIUM_STATE_EVENT, isLaunchNotifyOn, setLaunchNotify } from '../utils/premium';

const ADS_COVER_EVENT = 'apex-ads-cover';
const GOLD = 'var(--color-rank-first)';
const GOLD_BG = 'color-mix(in srgb, var(--color-rank-first) 9%, var(--color-bg-card))';

type Cell = string | true | null;

/** Free vs Premium sheet. Mounted once in the desktop shell; opened via `openPremiumDialog()`. */
const PremiumDialog: React.FC = () => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [notifyOn, setNotifyOn] = useState(isLaunchNotifyOn);

    useEffect(() => {
        const onOpen = () => setOpen(true);
        const onState = () => setNotifyOn(isLaunchNotifyOn());
        window.addEventListener(PREMIUM_DIALOG_EVENT, onOpen);
        window.addEventListener(PREMIUM_STATE_EVENT, onState);
        return () => {
            window.removeEventListener(PREMIUM_DIALOG_EVENT, onOpen);
            window.removeEventListener(PREMIUM_STATE_EVENT, onState);
        };
    }, []);

    useEffect(() => {
        if (!open) return;
        // Overwolf ads must not sit under a modal.
        window.dispatchEvent(new CustomEvent(ADS_COVER_EVENT, { detail: true }));
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => {
            window.dispatchEvent(new CustomEvent(ADS_COVER_EVENT, { detail: false }));
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

    if (!open) return null;

    const rows: Array<{ label: string; free: Cell; premium: Cell }> = [
        { label: t('premium.compare.rowMatch', { defaultValue: 'Match records · damage · kills · loadout · combat log' }), free: true, premium: true },
        { label: t('premium.compare.rowMap', { defaultValue: 'Route and death spot on the map' }), free: true, premium: true },
        { label: t('premium.compare.rowShare', { defaultValue: 'Share card' }), free: true, premium: true },
        { label: t('premium.compare.rowReplay', { defaultValue: 'Match replay (ring + movement)' }), free: t('premium.compare.oncePerDay', { defaultValue: 'Once a day' }), premium: t('premium.compare.unlimited', { defaultValue: 'Unlimited' }) },
        { label: t('premium.compare.rowOverview', { defaultValue: 'Stats overview · last 20 games trend' }), free: true, premium: true },
        { label: t('premium.compare.rowBreakdown', { defaultValue: 'Map · legend · weapon · teammate analysis' }), free: t('premium.compare.previewOnly', { defaultValue: 'Top pick only' }), premium: t('premium.compare.full', { defaultValue: 'Full' }) },
        { label: t('premium.compare.rowHistory', { defaultValue: 'Season / career totals, past ranked seasons' }), free: null, premium: true },
        { label: t('premium.compare.rowAds', { defaultValue: 'Ads' }), free: t('premium.compare.adsOn', { defaultValue: 'Shown' }), premium: t('premium.compare.adsOff', { defaultValue: 'None' }) },
    ];

    const renderCell = (value: Cell, premium: boolean) => {
        const color = premium ? GOLD : 'var(--color-text-dim)';
        if (value === true) return <FaCheck size={12} color={color} aria-label="✓" />;
        if (value === null) return <span style={{ color: 'var(--color-text-faint)' }}>—</span>;
        return <span style={{ color, fontWeight: premium ? 700 : 500 }}>{value}</span>;
    };

    return (
        <div
            onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
            style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="premium-dialog-title"
                style={{ width: 'min(720px, 100%)', maxHeight: '100%', overflowY: 'auto', background: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', color: 'var(--color-text-primary)' }}
            >
                <div style={{ padding: '22px 24px 14px', display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 900, color: GOLD, letterSpacing: '0.06em' }}>
                            <FaCrown size={14} /> APEXTRACE PREMIUM
                        </div>
                        <h2 id="premium-dialog-title" style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>
                            {t('premium.compare.title', { defaultValue: 'Why you lost — and whether you’re improving' })}
                        </h2>
                        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                            {t('premium.compare.subtitle', { defaultValue: 'Free shows each match. Premium shows the patterns between them.' })}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        aria-label={t('controls.close', { defaultValue: 'Close' })}
                        className="apex-btn"
                        style={{ width: 36, height: 36, flexShrink: 0, border: 'none', borderRadius: 8, background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <FaTimes size={14} />
                    </button>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ background: 'var(--color-bg-table-header)', color: 'var(--color-text-muted)', fontSize: 12 }}>
                            <th scope="col" style={{ textAlign: 'left', padding: '9px 24px', fontWeight: 700 }}>{t('premium.compare.feature', { defaultValue: 'Feature' })}</th>
                            <th scope="col" style={{ width: 120, padding: '9px 8px', fontWeight: 700 }}>{t('premium.compare.free', { defaultValue: 'Free' })}</th>
                            <th scope="col" style={{ width: 130, padding: '9px 24px 9px 8px', fontWeight: 900, color: GOLD, background: GOLD_BG }}>Premium</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.label} style={{ borderTop: '1px solid var(--color-border)' }}>
                                <th scope="row" style={{ textAlign: 'left', padding: '10px 24px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{row.label}</th>
                                <td style={{ textAlign: 'center', padding: '10px 8px' }}>{renderCell(row.free, false)}</td>
                                <td style={{ textAlign: 'center', padding: '10px 24px 10px 8px', background: GOLD_BG }}>{renderCell(row.premium, true)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div style={{ padding: '16px 24px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', minWidth: 0 }}>
                        {notifyOn
                            ? t('premium.notify.on', { defaultValue: 'You’re on the list — we’ll tell you in the app when Premium launches.' })
                            : t('premium.notify.hint', { defaultValue: 'Premium is coming soon. Get notified in the app when it launches.' })}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="apex-btn"
                            style={{ height: 40, padding: '0 16px', border: '1px solid var(--color-border-light)', borderRadius: 10, background: 'transparent', color: 'var(--color-text-dim)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                        >
                            {t('premium.compare.later', { defaultValue: 'Later' })}
                        </button>
                        <PremiumNotifyButton />
                    </div>
                </div>
            </div>
        </div>
    );
};

/** "Notify me at launch" toggle — shared by the compare sheet and the stats lock card. */
export const PremiumNotifyButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
    const { t } = useTranslation();
    const [on, setOn] = useState(isLaunchNotifyOn);

    useEffect(() => {
        const sync = () => setOn(isLaunchNotifyOn());
        window.addEventListener(PREMIUM_STATE_EVENT, sync);
        return () => window.removeEventListener(PREMIUM_STATE_EVENT, sync);
    }, []);

    return (
        <button
            type="button"
            aria-pressed={on}
            onClick={() => setLaunchNotify(!on)}
            className="apex-btn"
            style={{
                height: compact ? 36 : 40,
                padding: compact ? '0 14px' : '0 18px',
                borderRadius: 10,
                border: on ? `1px solid ${GOLD}` : 'none',
                background: on ? 'transparent' : GOLD,
                color: on ? GOLD : '#1a1408',
                fontWeight: 900,
                fontSize: compact ? 12 : 13,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                whiteSpace: 'nowrap',
            }}
        >
            {on ? <FaCheck size={11} /> : <FaBell size={11} />}
            {on
                ? t('premium.notify.done', { defaultValue: 'Launch alert on' })
                : t('premium.notify.cta', { defaultValue: 'Notify me at launch' })}
        </button>
    );
};

export default PremiumDialog;
