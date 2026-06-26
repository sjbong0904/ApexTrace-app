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

    const handleUpgrade = () => {
        alert(t('premium.redirecting'));
    };

    return (
        <div
            className="premium-blur-gate"
            style={{
                position: 'relative',
                borderRadius: compact ? '10px' : '12px',
                overflow: 'hidden',
                ...(compact ? {} : { minHeight: 320 }),
            }}
        >
            <div
                aria-hidden
                className="premium-blur-content"
                style={{
                    filter: 'blur(11px)',
                    pointerEvents: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    transform: 'scale(1.01)',
                }}
            >
                {children}
            </div>
            <div
                className="premium-blur-overlay"
                onClick={handleUpgrade}
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'color-mix(in srgb, var(--color-bg-main) 40%, transparent)',
                    backdropFilter: 'blur(2px)',
                    cursor: 'pointer',
                    padding: compact ? '12px' : '24px',
                    zIndex: 5,
                }}
            >
                <div
                    style={{
                        background: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: '12px',
                        padding: compact ? '16px 20px' : '28px 32px',
                        textAlign: 'center',
                        maxWidth: compact ? 300 : 420,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: compact ? '10px' : '14px',
                    }}
                >
                    <div style={{
                        background: 'var(--color-bg-card-hover)',
                        width: compact ? 44 : 56,
                        height: compact ? 44 : 56,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
                    }}>
                        <FaLock size={compact ? 18 : 22} color="var(--color-text-dim)" />
                    </div>
                    {title && (
                        <div style={{
                            fontSize: compact ? '14px' : '18px',
                            fontWeight: 'bold',
                            color: 'var(--color-text-primary)',
                            lineHeight: 1.3,
                        }}>
                            {t('statistics.premiumLock.unlockAnalytics', { title })}
                        </div>
                    )}
                    {!compact && (
                        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                            {t('statistics.premiumLock.getDetailedInsights')}
                        </div>
                    )}
                    <button
                        type="button"
                        style={{
                            marginTop: compact ? 2 : 4,
                            padding: compact ? '8px 18px' : '10px 24px',
                            background: 'linear-gradient(90deg, var(--color-warning) 0%, var(--color-warning-hover) 100%)',
                            border: 'none',
                            borderRadius: '6px',
                            color: 'var(--color-text-primary)',
                            fontWeight: 'bold',
                            fontSize: compact ? '12px' : '13px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 6px rgba(230, 126, 34, 0.3)',
                        }}
                    >
                        <FaCrown size={compact ? 12 : 14} /> {t('statistics.premiumLock.upgradeToPremium')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PremiumBlurGate;
