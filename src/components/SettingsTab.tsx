import React, { useState, useEffect } from 'react';
import { FaDiscord, FaInfoCircle, FaFolderOpen, FaQuestionCircle, FaChevronRight, FaKeyboard } from 'react-icons/fa';
import { startTutorial } from '../utils/tutorial';
import { useTranslation } from 'react-i18next';

const styles = {
    container: {
        padding: '30px',
        color: '#ecf0f1',
        maxWidth: '800px',
        margin: '0 auto',
        fontFamily: "'Segoe UI', sans-serif"
    },
    sectionTitle: {
        fontSize: '13px',
        color: '#888',
        fontWeight: 'bold' as const,
        textTransform: 'uppercase' as const,
        marginBottom: '15px',
        letterSpacing: '1px'
    },
    card: {
        background: '#252525',
        borderRadius: '10px',
        overflow: 'hidden',
        border: '1px solid #333'
    },
    discordCard: {
        background: 'linear-gradient(135deg, #5865F2 0%, #4752C4 100%)',
        borderRadius: '12px',
        padding: '25px',
        display: 'flex' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
        boxShadow: '0 4px 15px rgba(88, 101, 242, 0.3)',
        marginBottom: '40px'
    },
    iconBox: {
        background: '#333',
        padding: '10px',
        borderRadius: '8px',
        marginRight: '15px',
        display: 'flex' as const,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        width: '40px',
        height: '40px'
    }
};

// ✅ any → 명시적 인터페이스
interface ActionRowProps {
    icon: React.ReactNode;
    title: string;
    desc: string;
    onClick?: () => void;
    actionElement?: React.ReactNode;
    showArrow?: boolean;
    isLast?: boolean; // ✅ 마지막 항목 borderBottom 제거용
}

const ActionRow = ({ icon, title, desc, onClick, actionElement, showArrow = false, isLast = false }: ActionRowProps) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            onClick={onClick}
            style={{
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'background 0.2s',
                background: isHovered && onClick ? '#2a2a2a' : 'transparent',
                // ✅ 마지막 항목은 borderBottom 없음
                borderBottom: isLast ? 'none' : '1px solid #333'
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={styles.iconBox}>
                    {icon}
                </div>
                <div>
                    <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#eee' }}>{title}</div>
                    <div style={{ fontSize: '12px', color: '#888' }}>{desc}</div>
                </div>
            </div>
            <div>
                {actionElement ? actionElement : showArrow ? <FaChevronRight color="#666" /> : null}
            </div>
        </div>
    );
};

const SettingsTab = () => {
    const { t } = useTranslation();
    // ✅ 버전 동적 로드
    const [appVersion, setAppVersion] = useState('...');

    useEffect(() => {
        overwolf.extensions.current.getManifest((manifest: any) => {
            setAppVersion(manifest.meta?.version || 'Unknown');
        });
    }, []);

    const openHotkeySettings = () => {
        window.location.href = "overwolf://settings/games-overlay?hotkey=toggle_app&gameId=21566";
    };

    const openDiscord = () => {
        overwolf.utils.openUrlInDefaultBrowser("https://discord.gg/vwGVAFEYyj");
    };

    const handleOpenLogs = () => {
        if (typeof overwolf.io === 'undefined' || !overwolf.io.paths) {
            alert(t('settings.alerts.fsMissing'));
            return;
        }
        const localAppData = overwolf.io.paths.localAppData;
        const logPath = `${localAppData}\\Overwolf\\Log\\Apps\\ApexTrace`;

        overwolf.utils.openWindowsExplorer(logPath, (result: any) => {
            if (!result.success) {
                prompt(t('settings.alerts.openFolderFailed'), logPath);
            }
        });
    };

    return (
        <div style={styles.container}>

            {/* 1. 커뮤니티 섹션 */}
            <div style={{ marginBottom: '40px' }}>
                <h3 style={styles.sectionTitle}>{t('settings.sections.community')}</h3>
                <div style={styles.discordCard}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                            <FaDiscord size={24} style={{ marginRight: '10px' }} />
                            {t('settings.discord.title')}
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', lineHeight: '1.4' }}>
                            {t('settings.discord.desc1')}<br />
                            {t('settings.discord.desc2')}
                        </div>
                    </div>
                    <button
                        onClick={openDiscord}
                        style={{
                            background: 'white', color: '#5865F2', border: 'none', padding: '12px 25px',
                            borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.2)', marginLeft: '20px'
                        }}
                    >
                        {t('settings.discord.button')}
                    </button>
                </div>
            </div>

            {/* 2. 유틸리티 섹션 */}
            <div style={{ marginBottom: '30px' }}>
                <h3 style={styles.sectionTitle}>{t('settings.sections.tools')}</h3>
                <div style={styles.card}>
                    <ActionRow
                        icon={<FaQuestionCircle color="#ff9915" />}
                        title={t('settings.items.tutorialTitle')}
                        desc={t('settings.items.tutorialDesc')}
                        onClick={startTutorial}
                        showArrow
                    />
                    <ActionRow
                        icon={<FaKeyboard color="#ff9915" />}
                        title={t('settings.items.hotkeyTitle')}
                        desc={t('settings.items.hotkeyDesc')}
                        onClick={openHotkeySettings}
                        showArrow
                    />
                    {/* ✅ wrapper div 제거, isLast로 borderBottom 처리 */}
                    <ActionRow
                        icon={<FaFolderOpen color="#e67e22" />}
                        title={t('settings.items.logsTitle')}
                        desc={t('settings.items.logsDesc')}
                        onClick={handleOpenLogs}
                        showArrow
                        isLast
                    />
                </div>
            </div>

            {/* 3. 앱 정보 섹션 */}
            <div style={{ marginBottom: '30px' }}>
                <h3 style={styles.sectionTitle}>{t('settings.sections.appInfo')}</h3>
                <div style={styles.card}>
                    <ActionRow
                        icon={<FaInfoCircle color="#3498db" />}
                        title={t('settings.items.versionTitle')}
                        desc={t('settings.items.versionDesc')}
                        isLast
                        actionElement={
                            // ✅ 동적 버전
                            <div style={{ color: '#888', fontWeight: 'bold', fontSize: '13px' }}>
                                v{appVersion} Beta
                            </div>
                        }
                    />
                </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '50px', color: '#444', fontSize: '12px' }}>
                {t('settings.footer.copyright')}<br />
                {t('settings.footer.poweredBy')}
            </div>
        </div>
    );
};

export default SettingsTab;