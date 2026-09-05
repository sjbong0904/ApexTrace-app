import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaCrown, FaLock } from 'react-icons/fa';

interface PremiumBlurGateProps {
    locked: boolean;
    title?: string;
    children: React.ReactNode;
    compact?: boolean;
}

const PremiumBlurGate: React.FC<PremiumBlurGateProps> = ({ locked, title, children, compact = false }) => {
    const { t } = useTranslation();

    if (!locked) return <>{children}</>;

    const card = (
        <div className={compact ? 'premium-blur-card premium-blur-card--compact' : 'premium-blur-card'}>
            <div className={compact ? 'premium-blur-icon premium-blur-icon--compact' : 'premium-blur-icon'}>
                <FaLock size={compact ? 18 : 22} color="var(--color-text-dim)" />
            </div>
            {title && (
                <div className={compact ? 'premium-blur-title premium-blur-title--compact' : 'premium-blur-title'}>
                    {t('statistics.premiumLock.unlockAnalytics', { title })}
                </div>
            )}
            {!compact && (
                <div className="premium-blur-desc">
                    {t('statistics.premiumLock.getDetailedInsights')}
                </div>
            )}
            <button type="button" className={compact ? 'premium-blur-cta premium-blur-cta--compact' : 'premium-blur-cta'}>
                <FaCrown size={compact ? 12 : 14} style={{ flexShrink: 0 }} /> {t('statistics.premiumLock.comingSoonCta')}
            </button>
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
