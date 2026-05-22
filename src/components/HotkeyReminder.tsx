import { useState, useEffect } from 'react';

const HotkeyReminder = () => {
    const [hotkey, setHotkey] = useState<string>("Ctrl+Shift+=");

    useEffect(() => {
        if (typeof overwolf !== 'undefined' && overwolf.settings && overwolf.settings.hotkeys) {
            // 1. 앱 실행 시 현재 설정된 단축키 가져오기
            overwolf.settings.hotkeys.get((result: any) => {
                if (result.success) {
                    let toggleKey = null;

                    // Apex Legends (21566) 전용 단축키 확인
                    if (result.games && result.games.length > 0) {
                        const gameHotkeys = result.games.find((g: any) => g.gameId === 21566); // Apex
                        const match = gameHotkeys?.hotkeys?.find((h: any) => h.name === 'toggle_app');
                        if (match) toggleKey = match.binding;
                    }

                    // 전용 단축키가 없으면 글로벌 단축키 확인
                    if (!toggleKey && result.globals) {
                        const match = result.globals.find((h: any) => h.name === 'toggle_app');
                        if (match) toggleKey = match.binding;
                    }

                    if (toggleKey) {
                        setHotkey(toggleKey);
                    }
                }
            });

            // 2. 유저가 Overwolf 설정에서 단축키를 변경하면 실시간으로 반영
            const hotkeyChangeListener = (e: any) => {
                if (e.name === 'toggle_app' && e.binding) {
                    setHotkey(e.binding);
                }
            };
            
            overwolf.settings.hotkeys.onChanged.addListener(hotkeyChangeListener);
            
            return () => {
                overwolf.settings.hotkeys.onChanged.removeListener(hotkeyChangeListener);
            };
        }
    }, []);

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: 'rgba(20, 20, 20, 0.85)',
            backdropFilter: 'blur(4px)',
            color: '#aaa',
            padding: '8px 14px',
            borderRadius: '8px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 9999,
            border: '1px solid #444',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
        }}>
            <span>In-Game Hotkey</span>
            <kbd style={{ 
                background: '#333', 
                padding: '4px 8px', 
                borderRadius: '4px', 
                color: '#fff',
                fontWeight: 'bold',
                fontFamily: 'monospace',
                border: '1px solid #555'
            }}>
                {hotkey}
            </kbd>
        </div>
    );
};

export default HotkeyReminder;