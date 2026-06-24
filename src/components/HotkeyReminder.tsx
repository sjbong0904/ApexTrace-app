import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const HOTKEYS = [
    {
        name: 'toggle_desktop_window',
        defaultBinding: 'Ctrl+Shift+=',
        cacheKey: 'apextrace_desktop_hotkey',
        labelKey: 'hotkeyReminder.desktopLabel',
    },
    {
        name: 'toggle_in_game_window',
        defaultBinding: 'Ctrl+Shift+-',
        cacheKey: 'apextrace_in_game_hotkey',
        labelKey: 'hotkeyReminder.inGameLabel',
    },
] as const;

type HotkeyName = typeof HOTKEYS[number]['name'];
type HotkeyState = Record<HotkeyName, string>;

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

const HotkeyReminder = () => {
    const { t } = useTranslation();
    const [hotkeys, setHotkeys] = useState<HotkeyState>(() => {
        return HOTKEYS.reduce((acc, config) => {
            acc[config.name] = localStorage.getItem(config.cacheKey) || config.defaultBinding;
            return acc;
        }, {} as HotkeyState);
    });

    const applyHotkey = useCallback((hotkeyName: HotkeyName, binding: string) => {
        const config = HOTKEYS.find((item) => item.name === hotkeyName);
        if (!config) return;

        setHotkeys((prev) => ({ ...prev, [hotkeyName]: binding }));
        localStorage.setItem(config.cacheKey, binding);
    }, []);

    useEffect(() => {
        if (typeof overwolf === 'undefined' || !overwolf.settings?.hotkeys) return;

        overwolf.settings.hotkeys.get((result) => {
            if (!result?.success) return;
            HOTKEYS.forEach((config) => {
                const binding = findBindingByName(result as HotkeyGetResult, config.name);
                if (binding) applyHotkey(config.name, binding);
            });
        });

        const hotkeyChangeListener = (event: HotkeyBinding) => {
            const hotkeyName = event.name as HotkeyName;
            if (HOTKEYS.some((config) => config.name === hotkeyName) && event.binding) {
                applyHotkey(hotkeyName, event.binding);
            }
        };

        overwolf.settings.hotkeys.onChanged.addListener(hotkeyChangeListener);

        return () => {
            overwolf.settings.hotkeys.onChanged.removeListener(hotkeyChangeListener);
        };
    }, [applyHotkey]);

    return (
        <div
            className="hotkey-reminder"
            style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: 'color-mix(in srgb, var(--color-bg-card) 92%, transparent)',
            backdropFilter: 'blur(4px)',
            color: 'var(--color-text-muted)',
            padding: '8px 14px',
            borderRadius: '8px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 9999,
            border: '1px solid var(--color-border-light)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: '6px',
        }}>
            {HOTKEYS.map((config) => (
                <div key={config.name} style={{
                    display: 'flex',
            alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                }}>
                    <span>{t(config.labelKey)}</span>
                    <kbd style={{ 
                        background: 'var(--color-border)', 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        color: 'var(--color-text-primary)',
                        fontWeight: 'bold',
                        fontFamily: 'monospace',
                        border: '1px solid var(--color-text-subtle)',
                        whiteSpace: 'nowrap',
                    }}>
                        {hotkeys[config.name]}
                    </kbd>
                </div>
            ))}
        </div>
    );
};

export default HotkeyReminder;