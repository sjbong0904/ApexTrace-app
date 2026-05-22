// src/hooks/useAppToggle.ts
import { useCallback, useEffect, useState } from 'react';

const HOTKEY_NAME = 'toggle_app';

export const useAppToggle = () => {
    const [hotkeyText, setHotkeyText] = useState<string>('Ctrl+Shift+=');

    // ✅ useCallback으로 안정화
    const toggleWindow = useCallback(() => {
        overwolf.windows.getCurrentWindow((result) => {
            if (result.success) {
                if (result.window.isVisible) {
                    overwolf.windows.minimize(result.window.id, () => {});
                } else {
                    overwolf.windows.restore(result.window.id, () => {});
                    overwolf.windows.bringToFront(result.window.id, () => {});
                }
            }
        });
    }, []);

    useEffect(() => {
        overwolf.settings.hotkeys.get((result) => {
            if (result.success && result.globals) {
                const myHotkey = result.globals.find(h => h.name === HOTKEY_NAME);
                if (myHotkey) setHotkeyText(myHotkey.binding);
            }
        });

        // ✅ any → Overwolf 타입
        const onChange = (evt: overwolf.settings.hotkeys.OnChangedEvent) => {
            if (evt.name === HOTKEY_NAME) setHotkeyText(evt.binding);
        };

        const onPress = (evt: overwolf.settings.hotkeys.OnPressedEvent) => {
            if (evt.name === HOTKEY_NAME) toggleWindow();
        };

        overwolf.settings.hotkeys.onChanged.addListener(onChange);
        overwolf.settings.hotkeys.onPressed.addListener(onPress);

        return () => {
            overwolf.settings.hotkeys.onChanged.removeListener(onChange);
            overwolf.settings.hotkeys.onPressed.removeListener(onPress);
        };
    }, [toggleWindow]);

    return { hotkeyText };
};