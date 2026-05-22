import React, { useState } from 'react'; // ✅ React import 추가
import { FaChartBar, FaList, FaStar, FaCrosshairs, FaCog } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

interface NavProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

const Navigation = ({ activeTab, onTabChange }: NavProps) => {
    const { t } = useTranslation();
    const [hoveredTab, setHoveredTab] = useState<string | null>(null); // ✅ hover state

    const navItemStyle = (isActive: boolean, tabId: string): React.CSSProperties => ({
        width: '50px',
        height: '50px',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        marginBottom: '10px',
        color: isActive ? '#fff' : hoveredTab === tabId ? '#aaa' : '#666',
        background: isActive
            ? 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)'
            : hoveredTab === tabId ? '#2a2a2a' : 'transparent',
        transition: 'all 0.2s ease',
        boxShadow: isActive ? '0 4px 10px rgba(231, 76, 60, 0.3)' : 'none'
    });

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '20px', paddingBottom: '20px' }}>

            <div
                title={t('nav.matchHistory')}
                id="nav-dashboard"
                style={navItemStyle(activeTab === "DASHBOARD", "DASHBOARD")} // ✅ tabId 추가
                onClick={() => onTabChange("DASHBOARD")}
                onMouseEnter={() => setHoveredTab("DASHBOARD")}
                onMouseLeave={() => setHoveredTab(null)}
            >
                <FaList size={20} />
            </div>

            <div
                title={t('nav.statistics')}
                id="nav-statistics"
                style={navItemStyle(activeTab === "STATISTICS", "STATISTICS")} // ✅ tabId 추가
                onClick={() => onTabChange("STATISTICS")}
                onMouseEnter={() => setHoveredTab("STATISTICS")}
                onMouseLeave={() => setHoveredTab(null)}
            >
                <FaChartBar size={20} />
            </div>

            <div style={{ width: '60%', height: '1px', background: '#333', margin: '15px 0' }} />

            <div
                title={t('nav.favorites')}
                id="nav-favorites"
                style={navItemStyle(activeTab === "FAVORITES", "FAVORITES")} // ✅ tabId 추가
                onClick={() => onTabChange("FAVORITES")}
                onMouseEnter={() => setHoveredTab("FAVORITES")}
                onMouseLeave={() => setHoveredTab(null)}
            >
                <FaStar size={20} />
            </div>

            <div
                title={t('nav.weapons')}
                id="nav-weapons"
                style={navItemStyle(activeTab === "WEAPONS", "WEAPONS")} // ✅ tabId 추가
                onClick={() => onTabChange("WEAPONS")}
                onMouseEnter={() => setHoveredTab("WEAPONS")}
                onMouseLeave={() => setHoveredTab(null)}
            >
                <FaCrosshairs size={20} />
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%' }}>
                <div
                    title={t('nav.settings')}
                    id="nav-settings"
                    style={navItemStyle(activeTab === "SETTINGS", "SETTINGS")} // ✅ tabId 추가
                    onClick={() => onTabChange("SETTINGS")}
                    onMouseEnter={() => setHoveredTab("SETTINGS")}
                    onMouseLeave={() => setHoveredTab(null)}
                >
                    <FaCog size={22} />
                </div>
            </div>

        </div>
    );
};

export default Navigation;