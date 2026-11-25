import React, { useState } from 'react';
import { FaChartBar, FaList, FaStar, FaCog, FaThList, FaUser, FaCrown } from 'react-icons/fa';
import { openPremiumDialog } from '../utils/premium';
import { useTranslation } from 'react-i18next';
import { c, useTheme } from '../theme';

export type NavTabId = 'DASHBOARD' | 'STATISTICS' | 'FAVORITES' | 'TIER_TABLE' | 'SETTINGS';

const DEFAULT_TABS: NavTabId[] = ['DASHBOARD', 'STATISTICS', 'FAVORITES', 'TIER_TABLE', 'SETTINGS'];

interface NavProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    /** When set, only these tabs render (web / free-tier shells). */
    visibleTabs?: NavTabId[];
    /**
     * Desktop: Match History + Statistics share one "Records" entry (they share the profile header);
     * the page itself switches between them. Clicking it opens Match History.
     */
    mergeRecords?: boolean;
    /** Small text label under each icon. */
    showLabels?: boolean;
    /** Free tier: gold Premium entry above Settings (opens the compare sheet). */
    showPremiumEntry?: boolean;
}

const Navigation = ({ activeTab, onTabChange, visibleTabs = DEFAULT_TABS, mergeRecords = false, showLabels = false, showPremiumEntry = false }: NavProps) => {
    const { t } = useTranslation();
    const { isDark } = useTheme();
    const [hoveredTab, setHoveredTab] = useState<string | null>(null);
    const show = (tab: NavTabId) => visibleTabs.includes(tab);
    // Divider separates profile-based tabs (Records, Favorites) from global meta tabs (Tier Table).
    const showDivider = (show('DASHBOARD') || show('STATISTICS') || show('FAVORITES')) && show('TIER_TABLE');
    const recordsActive = activeTab === 'DASHBOARD' || activeTab === 'STATISTICS';

    const navItemStyle = (isActive: boolean, tabId: string): React.CSSProperties => ({
        width: '50px',
        height: showLabels ? '40px' : '50px',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: isActive ? c.textPrimary : hoveredTab === tabId ? c.textDim : c.textMuted,
        background: isActive
            ? `linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)`
            : hoveredTab === tabId ? c.bgCardHover : 'transparent',
        transition: 'all 0.2s ease',
        boxShadow: isActive
            ? (isDark ? '0 4px 10px rgba(0,0,0,0.4)' : '0 4px 12px rgba(214, 69, 55, 0.28)')
            : 'none',
    });

    const renderItem = (
        tabId: string,
        domId: string,
        label: string,
        icon: React.ReactNode,
        isActive: boolean,
    ) => (
        <div
            key={tabId}
            title={label}
            id={domId}
            // Merged "Records": stay on whichever of Matches / Statistics is open.
            onClick={() => { if (mergeRecords && tabId === 'DASHBOARD' && recordsActive) return; onTabChange(tabId); }}
            onMouseEnter={() => setHoveredTab(tabId)}
            onMouseLeave={() => setHoveredTab(null)}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                marginBottom: showLabels ? '12px' : '10px',
                cursor: 'pointer',
                width: '64px',
            }}
        >
            <div style={navItemStyle(isActive, tabId)}>{icon}</div>
            {showLabels && (
                <div style={{
                    fontSize: '10px',
                    lineHeight: 1.2,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? c.textPrimary : c.textMuted,
                    textAlign: 'center',
                    width: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}>
                    {label}
                </div>
            )}
        </div>
    );

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '20px', paddingBottom: '20px' }}>

            {mergeRecords && show('DASHBOARD') ? (
                renderItem('DASHBOARD', 'nav-dashboard', t('nav.records', { defaultValue: 'Records' }), <FaUser size={18} />, recordsActive)
            ) : (
                <>
                    {show('DASHBOARD') && renderItem('DASHBOARD', 'nav-dashboard', t('nav.matchHistory'), <FaList size={20} />, activeTab === 'DASHBOARD')}
                    {show('STATISTICS') && renderItem('STATISTICS', 'nav-statistics', t('nav.statistics'), <FaChartBar size={20} />, activeTab === 'STATISTICS')}
                </>
            )}

            {show('FAVORITES') && renderItem('FAVORITES', 'nav-favorites', t('nav.favorites'), <FaStar size={20} />, activeTab === 'FAVORITES')}

            {showDivider && <div style={{ width: '60%', height: '1px', background: c.border, margin: '8px 0 15px' }} />}

            {show('TIER_TABLE') && renderItem('TIER_TABLE', 'nav-tier-table', t('nav.tierTable'), <FaThList size={18} />, activeTab === 'TIER_TABLE')}

            {(show('SETTINGS') || showPremiumEntry) && (
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                    {showPremiumEntry && (
                        <button
                            type="button"
                            id="nav-premium"
                            title={t('premium.nav', { defaultValue: 'Premium' })}
                            onClick={() => openPremiumDialog('nav')}
                            onMouseEnter={() => setHoveredTab('PREMIUM')}
                            onMouseLeave={() => setHoveredTab(null)}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, marginBottom: showLabels ? '12px' : '10px', width: '64px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                        >
                            <div style={{
                                width: '50px',
                                height: showLabels ? '40px' : '50px',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--color-rank-first)',
                                border: '1px solid color-mix(in srgb, var(--color-rank-first) 35%, transparent)',
                                background: hoveredTab === 'PREMIUM'
                                    ? 'color-mix(in srgb, var(--color-rank-first) 18%, transparent)'
                                    : 'color-mix(in srgb, var(--color-rank-first) 9%, transparent)',
                                transition: 'all 0.2s ease',
                                boxSizing: 'border-box',
                            }}>
                                <FaCrown size={18} />
                            </div>
                            {showLabels && (
                                <div style={{ fontSize: '10px', lineHeight: 1.2, fontWeight: 700, color: 'var(--color-rank-first)' }}>
                                    {t('premium.nav', { defaultValue: 'Premium' })}
                                </div>
                            )}
                        </button>
                    )}
                    {show('SETTINGS') && renderItem('SETTINGS', 'nav-settings', t('nav.settings'), <FaCog size={22} />, activeTab === 'SETTINGS')}
                </div>
            )}

        </div>
    );
};

export default Navigation;
