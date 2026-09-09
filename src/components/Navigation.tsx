import React, { useState } from 'react';
import { FaChartBar, FaList, FaStar, FaCog, FaThList } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { c, useTheme } from '../theme';

export type NavTabId = 'DASHBOARD' | 'STATISTICS' | 'FAVORITES' | 'TIER_TABLE' | 'SETTINGS';

const DEFAULT_TABS: NavTabId[] = ['DASHBOARD', 'STATISTICS', 'FAVORITES', 'TIER_TABLE', 'SETTINGS'];

interface NavProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    /** When set, only these tabs render (web / free-tier shells). */
    visibleTabs?: NavTabId[];
}

const Navigation = ({ activeTab, onTabChange, visibleTabs = DEFAULT_TABS }: NavProps) => {
    const { t } = useTranslation();
    const { isDark } = useTheme();
    const [hoveredTab, setHoveredTab] = useState<string | null>(null);
    const show = (tab: NavTabId) => visibleTabs.includes(tab);
    const showDivider = show('FAVORITES') || show('TIER_TABLE');

    const navItemStyle = (isActive: boolean, tabId: string): React.CSSProperties => ({
        width: '50px',
        height: '50px',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        marginBottom: '10px',
        color: isActive ? c.textPrimary : hoveredTab === tabId ? c.textMuted : c.textFaint,
        background: isActive
            ? `linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)`
            : hoveredTab === tabId ? c.bgCardHover : 'transparent',
        transition: 'all 0.2s ease',
        boxShadow: isActive
            ? (isDark ? '0 4px 10px rgba(0,0,0,0.4)' : '0 4px 12px rgba(214, 69, 55, 0.28)')
            : 'none',
    });

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '20px', paddingBottom: '20px' }}>

            {show('DASHBOARD') && (
                <div
                    title={t('nav.matchHistory')}
                    id="nav-dashboard"
                    style={navItemStyle(activeTab === "DASHBOARD", "DASHBOARD")}
                    onClick={() => onTabChange("DASHBOARD")}
                    onMouseEnter={() => setHoveredTab("DASHBOARD")}
                    onMouseLeave={() => setHoveredTab(null)}
                >
                    <FaList size={20} />
                </div>
            )}

            {show('STATISTICS') && (
                <div
                    title={t('nav.statistics')}
                    id="nav-statistics"
                    style={navItemStyle(activeTab === "STATISTICS", "STATISTICS")}
                    onClick={() => onTabChange("STATISTICS")}
                    onMouseEnter={() => setHoveredTab("STATISTICS")}
                    onMouseLeave={() => setHoveredTab(null)}
                >
                    <FaChartBar size={20} />
                </div>
            )}

            {showDivider && <div style={{ width: '60%', height: '1px', background: c.border, margin: '15px 0' }} />}

            {show('FAVORITES') && (
                <div
                    title={t('nav.favorites')}
                    id="nav-favorites"
                    style={navItemStyle(activeTab === "FAVORITES", "FAVORITES")}
                    onClick={() => onTabChange("FAVORITES")}
                    onMouseEnter={() => setHoveredTab("FAVORITES")}
                    onMouseLeave={() => setHoveredTab(null)}
                >
                    <FaStar size={20} />
                </div>
            )}

            {show('TIER_TABLE') && (
                <div
                    title={t('nav.tierTable')}
                    id="nav-tier-table"
                    style={navItemStyle(activeTab === "TIER_TABLE", "TIER_TABLE")}
                    onClick={() => onTabChange("TIER_TABLE")}
                    onMouseEnter={() => setHoveredTab("TIER_TABLE")}
                    onMouseLeave={() => setHoveredTab(null)}
                >
                    <FaThList size={18} />
                </div>
            )}

            {show('SETTINGS') && (
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%' }}>
                    <div
                        title={t('nav.settings')}
                        id="nav-settings"
                        style={navItemStyle(activeTab === "SETTINGS", "SETTINGS")}
                        onClick={() => onTabChange("SETTINGS")}
                        onMouseEnter={() => setHoveredTab("SETTINGS")}
                        onMouseLeave={() => setHoveredTab(null)}
                    >
                        <FaCog size={22} />
                    </div>
                </div>
            )}

        </div>
    );
};

export default Navigation;
