import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaCrown, FaCheck } from 'react-icons/fa';
import { PremiumNotifyButton } from './PremiumDialog';
import { openPremiumDialog } from '../utils/premium';

export interface PremiumTeaser {
    /** e.g. "Best map" */
    label: string;
    /** e.g. "World's Edge" */
    name: string;
    /** e.g. ["Avg dmg 1,240", "Avg place #6.1", "14 games"] */
    stats: string[];
}

interface PremiumBlurGateProps {
    locked: boolean;
    /** Value headline for this tab, e.g. "See which maps you're losing on". */
    headline?: string;
    /** 2–3 concrete things Premium shows here. */
    bullets?: string[];
    /** One free row of the user's own data, shown unblurred. */
    teaser?: PremiumTeaser | null;
    children: React.ReactNode;
    compact?: boolean;
}

const GOLD = 'var(--color-rank-first)';

const PremiumBlurGate: React.FC<PremiumBlurGateProps> = ({ locked, headline, bullets = [], teaser, children, compact = false }) => {
    const { t } = useTranslation();

    if (!locked) return <>{children}</>;

    const card = (
        <div className={compact ? 'premium-blur-card premium-blur-card--compact' : 'premium-blur-card'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 900, letterSpacing: '0.06em', color: GOLD }}>
                <FaCrown size={12} /> PREMIUM
            </div>

            {teaser && (
                <div className="premium-teaser">
                    <div className="premium-teaser-head">
                        <span className="premium-teaser-label">{teaser.label}</span>
                        <span className="premium-teaser-free">{t('statistics.premiumLock.freePreview', { defaultValue: 'Free preview' })}</span>
                    </div>
                    <div className="premium-teaser-name">{teaser.name}</div>
                    <div className="premium-teaser-stats">
                        {teaser.stats.map((s) => <span key={s}>{s}</span>)}
                    </div>
                </div>
            )}

            {headline && (
                <div className={compact ? 'premium-blur-title premium-blur-title--compact' : 'premium-blur-title'}>
                    {headline}
                </div>
            )}

            {!compact && bullets.length > 0 && (
                <ul className="premium-blur-bullets">
                    {bullets.map((b) => (
                        <li key={b}><FaCheck size={10} color={GOLD} style={{ flexShrink: 0, marginTop: 4 }} />{b}</li>
                    ))}
                </ul>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                <PremiumNotifyButton compact={compact} />
                <button type="button" className="premium-blur-link" onClick={() => openPremiumDialog('stats-lock')}>
                    {t('statistics.premiumLock.compare', { defaultValue: 'Compare Free and Premium' })} ›
                </button>
            </div>
        </div>
    );

    return (
        <div
            className={compact ? 'premium-blur-gate premium-blur-gate--compact' : 'premium-blur-gate'}
        >
            {/* Sticky anchor follows the stats scrollport so the lock card stays in view. */}
            <div className="premium-blur-sticky" aria-hidden={false}>
                {card}
            </div>
            <div
                aria-hidden
                className="premium-blur-content"
            >
                {children}
            </div>
            <div className="premium-blur-dim" aria-hidden />
        </div>
    );
};

export default PremiumBlurGate;
