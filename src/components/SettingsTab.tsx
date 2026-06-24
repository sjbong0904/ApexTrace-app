import React, { useState, useEffect } from 'react';
import { FaDiscord, FaInfoCircle, FaFolderOpen, FaQuestionCircle, FaChevronRight, FaKeyboard, FaPalette } from 'react-icons/fa';
import { startTutorial } from '../utils/tutorial';
import { useTranslation } from 'react-i18next';
import { useTheme, c } from '../theme';

const HOTKEY_CONFIGS = [
    {
        name: 'toggle_desktop_window',
        defaultBinding: 'Ctrl+Shift+=',
        cacheKey: 'apextrace_desktop_hotkey',
        titleKey: 'settings.items.desktopHotkeyTitle',
        descKey: 'settings.items.desktopHotkeyDesc',
    },
    {
        name: 'toggle_in_game_window',
        defaultBinding: 'Ctrl+Shift+-',
        cacheKey: 'apextrace_in_game_hotkey',
        titleKey: 'settings.items.inGameHotkeyTitle',
        descKey: 'settings.items.inGameHotkeyDesc',
    },
] as const;

type HotkeyName = typeof HOTKEY_CONFIGS[number]['name'];
type HotkeyBindings = Record<HotkeyName, string>;

interface ParsedHotkey {
    binding: string;
    virtualKey: number;
    modifiers: {
        ctrl?: boolean;
        shift?: boolean;
        alt?: boolean;
    };
}

interface HotkeyBinding {
    name?: string;
    binding?: string;
}

interface GameHotkeys {
    gameId?: number;
    hotkeys?: HotkeyBinding[];
}

interface HotkeyGetResult {
    success?: boolean;
    games?: GameHotkeys[] | Record<string, HotkeyBinding[]>;
    globals?: HotkeyBinding[];
}

const parseHotkeyEvent = (event: KeyboardEvent): ParsedHotkey | null => {
    const modifierKeys = ['Control', 'Shift', 'Alt', 'Meta'];
    if (modifierKeys.includes(event.key)) return null;

    const parts: string[] = [];
    const modifiers = {
        ctrl: event.ctrlKey || undefined,
        shift: event.shiftKey || undefined,
        alt: event.altKey || undefined,
    };

    if (modifiers.ctrl) parts.push('Ctrl');
    if (modifiers.shift) parts.push('Shift');
    if (modifiers.alt) parts.push('Alt');

    let key = event.key;
    const virtualKey = event.keyCode || event.which;
    if (!virtualKey) return null;

    if (event.code === 'Equal') key = '=';
    else if (event.code === 'Minus') key = '-';
    else if (event.code === 'Space') key = 'Space';
    else if (/^Key[A-Z]$/.test(event.code)) key = event.code.replace('Key', '');
    else if (/^Digit\d$/.test(event.code)) key = event.code.replace('Digit', '');
    else if (key.length === 1) key = key.toUpperCase();

    parts.push(key);
    return {
        binding: parts.join('+'),
        virtualKey,
        modifiers,
    };
};

const findBindingByName = (result: HotkeyGetResult, hotkeyName: HotkeyName): string | null => {
    const games = Array.isArray(result.games)
        ? result.games
        : Object.entries(result.games || {}).map(([gameId, hotkeys]) => ({
            gameId: Number(gameId),
            hotkeys,
        }));
    const apexHotkeys = games.find((game) => Number(game.gameId) === 21566)?.hotkeys;
    const gameMatch = Array.isArray(apexHotkeys)
        ? apexHotkeys.find((hotkey) => hotkey.name === hotkeyName)
        : null;

    if (gameMatch?.binding) return gameMatch.binding;

    const globals = Array.isArray(result.globals) ? result.globals : [];
    const globalMatch = globals.find((hotkey) => hotkey.name === hotkeyName);
    return globalMatch?.binding || null;
};

const styles = {
    container: {
        padding: '30px',
        color: 'var(--color-text-secondary)',
        maxWidth: '800px',
        margin: '0 auto',
        fontFamily: "'Segoe UI', sans-serif"
    } as React.CSSProperties,
    sectionTitle: {
        fontSize: '13px',
        color: 'var(--color-text-muted)',
        fontWeight: 'bold' as const,
        textTransform: 'uppercase' as const,
        marginBottom: '15px',
        letterSpacing: '1px'
    },
    card: {
        background: 'var(--color-bg-card)',
        borderRadius: '10px',
        overflow: 'hidden',
        border: '1px solid var(--color-border)'
    } as React.CSSProperties,
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
        background: 'var(--color-border)',
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

interface ActionRowProps {
    icon: React.ReactNode;
    title: string;
    desc: string;
    onClick?: () => void;
    actionElement?: React.ReactNode;
    showArrow?: boolean;
    isLast?: boolean;
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
                background: isHovered && onClick ? c.bgCardHover : 'transparent',
                borderBottom: isLast ? 'none' : `1px solid ${c.border}`
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={styles.iconBox}>{icon}</div>
                <div>
                    <div style={{ fontWeight: 'bold', fontSize: '15px', color: c.textSecondary }}>{title}</div>
                    <div style={{ fontSize: '12px', color: c.textMuted }}>{desc}</div>
                </div>
            </div>
            <div>
                {actionElement ?? (showArrow ? <FaChevronRight color={c.textFaint} /> : null)}
            </div>
        </div>
    );
};

// ── Theme toggle ─────────────────────────────────────────────────────────────
const ThemeToggle = () => {
    const { t } = useTranslation();
    const { isDark, setThemeById } = useTheme();

    const optionStyle = (active: boolean): React.CSSProperties => ({
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '10px 0',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '13px',
        transition: 'all 0.2s',
        background: active ? 'var(--color-accent)' : 'transparent',
        color: active ? '#ffffff' : 'var(--color-text-muted)',
        userSelect: 'none',
    });

    return (
        <div style={{
            display: 'flex',
            gap: '4px',
            padding: '4px',
            background: 'var(--color-bg-main)',
            borderRadius: '10px',
            border: '1px solid var(--color-border)',
        }}>
            <div style={optionStyle(isDark)} onClick={() => setThemeById('dark')}>
                <span style={{ fontSize: '15px' }}>🌙</span>
                {t('settings.theme.dark')}
            </div>
            <div style={optionStyle(!isDark)} onClick={() => setThemeById('light')}>
                <span style={{ fontSize: '15px' }}>☀️</span>
                {t('settings.theme.light')}
            </div>
        </div>
    );
};

const HotkeySettingsRows = () => {
    const { t } = useTranslation();
    const [bindings, setBindings] = useState<HotkeyBindings>(() => {
        return HOTKEY_CONFIGS.reduce((acc, config) => {
            acc[config.name] = localStorage.getItem(config.cacheKey) || config.defaultBinding;
            return acc;
        }, {} as HotkeyBindings);
    });
    const [listeningFor, setListeningFor] = useState<HotkeyName | null>(null);
    const [feedback, setFeedback] = useState<{ hotkeyName: HotkeyName; message: string } | null>(null);

    useEffect(() => {
        if (typeof overwolf === 'undefined' || !overwolf.settings?.hotkeys) return;

        overwolf.settings.hotkeys.get((result) => {
            if (!result?.success) return;
            HOTKEY_CONFIGS.forEach((config) => {
                const binding = findBindingByName(result as HotkeyGetResult, config.name);
                if (!binding) return;
                setBindings((prev) => ({ ...prev, [config.name]: binding }));
                localStorage.setItem(config.cacheKey, binding);
            });
        });

        const onChanged = (event: HotkeyBinding) => {
            const hotkeyName = event.name as HotkeyName;
            const config = HOTKEY_CONFIGS.find((item) => item.name === hotkeyName);
            if (!config || !event.binding) return;
            setBindings((prev) => ({ ...prev, [hotkeyName]: event.binding! }));
            localStorage.setItem(config.cacheKey, event.binding);
        };

        overwolf.settings.hotkeys.onChanged.addListener(onChanged);
        return () => overwolf.settings.hotkeys.onChanged.removeListener(onChanged);
    }, []);

    useEffect(() => {
        if (!listeningFor) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            event.preventDefault();
            event.stopPropagation();

            if (event.key === 'Escape') {
                setListeningFor(null);
                setFeedback(null);
                return;
            }

            const hotkey = parseHotkeyEvent(event);
            if (!hotkey) return;

            assignHotkey(listeningFor, hotkey);
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [listeningFor, t]);

    const assignHotkey = (hotkeyName: HotkeyName, hotkey: ParsedHotkey) => {
        const config = HOTKEY_CONFIGS.find((item) => item.name === hotkeyName);
        if (!config || typeof overwolf === 'undefined' || !overwolf.settings?.hotkeys) return;

        setFeedback({ hotkeyName, message: t('settings.hotkeys.saving', { defaultValue: 'Saving...' }) });

        const finish = (result: { success?: boolean; error?: string }) => {
            if (result?.success) {
                setBindings((prev) => ({ ...prev, [hotkeyName]: hotkey.binding }));
                localStorage.setItem(config.cacheKey, hotkey.binding);
                setFeedback({ hotkeyName, message: t('settings.hotkeys.savedShort', { defaultValue: 'Saved' }) });
                window.setTimeout(() => {
                    setFeedback((current) => current?.hotkeyName === hotkeyName ? null : current);
                }, 1600);
            } else {
                setFeedback({ hotkeyName, message: result?.error || t('settings.hotkeys.failedShort', { defaultValue: 'Failed' }) });
            }
            setListeningFor(null);
        };

        const hotkeysApi = overwolf.settings.hotkeys as unknown as {
            assign?: (...args: unknown[]) => void;
        };

        const payloads = [
            {
                name: hotkeyName,
                gameId: 21566,
                virtualKey: hotkey.virtualKey,
                modifiers: hotkey.modifiers,
            },
            {
                name: hotkeyName,
                gameid: 21566,
                virtualKey: hotkey.virtualKey,
                modifiers: hotkey.modifiers,
            },
        ];

        const tryAssign = (index = 0) => {
            const payload = payloads[index];
            if (!payload || !hotkeysApi.assign) {
                finish({ success: false });
                return;
            }

            hotkeysApi.assign(payload, (result: { success?: boolean; status?: string; error?: string }) => {
                const success = result?.success || result?.status === 'success';
                const canRetry = !success && /find hotkey/i.test(result?.error || '') && index < payloads.length - 1;
                if (canRetry) {
                    tryAssign(index + 1);
                    return;
                }
                finish({ success, error: result?.error });
            });
        };

        try {
            tryAssign();
        } catch {
            finish({ success: false });
        }
    };

    return (
        <>
            <div>
                {HOTKEY_CONFIGS.map((config) => (
                    <div key={config.name} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '20px',
                        padding: '20px',
                        borderBottom: `1px solid ${c.border}`,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                            <div style={styles.iconBox}>
                                <FaKeyboard color="var(--color-warning)" />
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ color: c.textSecondary, fontWeight: 'bold', fontSize: '15px' }}>
                                    {t(config.titleKey)}
                                </div>
                                <div style={{ color: c.textMuted, fontSize: '12px', lineHeight: 1.35 }}>
                                    {t(config.descKey)}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', minWidth: 'fit-content' }}>
                            <kbd style={{
                                background: 'var(--color-bg-main)',
                                color: 'var(--color-text-primary)',
                                border: `1px solid ${c.borderLight}`,
                                borderRadius: '6px',
                                padding: '6px 10px',
                                fontFamily: 'monospace',
                                fontWeight: 800,
                                minWidth: '96px',
                                maxWidth: '150px',
                                textAlign: 'center',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}>
                                {listeningFor === config.name
                                    ? t('settings.hotkeys.listening', { defaultValue: 'Press keys...' })
                                    : bindings[config.name]}
                            </kbd>
                            <button
                                type="button"
                                onClick={() => {
                                    setListeningFor(config.name);
                                    setFeedback(null);
                                }}
                                style={{
                                    background: listeningFor === config.name ? 'var(--color-warning)' : 'var(--color-bg-sub-header)',
                                    color: 'var(--color-text-primary)',
                                    border: `1px solid ${c.borderLight}`,
                                    borderRadius: '6px',
                                    padding: '7px 10px',
                                    fontSize: '12px',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {feedback?.hotkeyName === config.name
                                    ? feedback.message
                                    : t('settings.hotkeys.change', { defaultValue: 'Change' })}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
};

const SettingsTab = (_props: { isPremium?: boolean }) => {
    const { t } = useTranslation();
    const [appVersion, setAppVersion] = useState('...');

    useEffect(() => {
        overwolf.extensions.current.getManifest((manifest: any) => {
            setAppVersion(manifest.meta?.version || 'Unknown');
        });
    }, []);

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

            {/* 2. 테마 섹션 */}
            <div style={{ marginBottom: '40px' }}>
                <h3 style={styles.sectionTitle}>{t('settings.sections.theme')}</h3>
                <div style={styles.card}>
                    <div style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={styles.iconBox}>
                                <FaPalette color={c.accent} size={18} />
                            </div>
                            <div>
                                <div style={{ fontWeight: 'bold', fontSize: '15px', color: c.textSecondary }}>{t('settings.theme.modeTitle')}</div>
                                <div style={{ fontSize: '12px', color: c.textMuted }}>{t('settings.theme.modeDesc')}</div>
                            </div>
                        </div>
                        <div style={{ minWidth: '200px' }}>
                            <ThemeToggle />
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. 유틸리티 섹션 */}
            <div style={{ marginBottom: '30px' }}>
                <h3 style={styles.sectionTitle}>{t('settings.sections.tools')}</h3>
                <div style={styles.card}>
                    <ActionRow
                        icon={<FaQuestionCircle color="var(--color-warning)" />}
                        title={t('settings.items.tutorialTitle')}
                        desc={t('settings.items.tutorialDesc')}
                        onClick={startTutorial}
                        showArrow
                    />
                    <HotkeySettingsRows />
                    <ActionRow
                        icon={<FaFolderOpen color="var(--color-warning)" />}
                        title={t('settings.items.logsTitle')}
                        desc={t('settings.items.logsDesc')}
                        onClick={handleOpenLogs}
                        showArrow
                        isLast
                    />
                </div>
            </div>

            {/* 4. 앱 정보 섹션 */}
            <div style={{ marginBottom: '30px' }}>
                <h3 style={styles.sectionTitle}>{t('settings.sections.appInfo')}</h3>
                <div style={styles.card}>
                    <ActionRow
                        icon={<FaInfoCircle color="#3498db" />}
                        title={t('settings.items.versionTitle')}
                        desc={t('settings.items.versionDesc')}
                        isLast
                        actionElement={
                            <div style={{ color: c.textMuted, fontWeight: 'bold', fontSize: '13px' }}>
                                v{appVersion} Beta
                            </div>
                        }
                    />
                </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '50px', color: c.textFaint, fontSize: '12px' }}>
                {t('settings.footer.copyright')}<br />
                {t('settings.footer.poweredBy')}
            </div>
        </div>
    );
};

export default SettingsTab;
