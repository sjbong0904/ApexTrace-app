import React, { useState, useEffect } from 'react';
import { FaWindowMinimize, FaWindowMaximize, FaWindowRestore, FaTimes } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

// ✅ 공통 유틸로 분리 권장: utils/overwolf.ts
const getCurrentWindow = (): Promise<any> =>
    new Promise((resolve) => overwolf.windows.getCurrentWindow((r) => resolve(r.window)));

const WindowControls = () => {
    const { t } = useTranslation(); // ✅ 번역 훅 추가
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        overwolf.windows.getCurrentWindow((result) => {
            if (result.success) {
                setIsMaximized(
                    result.window.stateEx === 'maximized' ||
                    result.window.state === 'Maximized'
                );
            }
        });

        const onWindowStateChanged = (state: any) => {
            if (state.window_state_ex === 'maximized') setIsMaximized(true);
            else if (state.window_state_ex === 'normal') setIsMaximized(false);
        };

        overwolf.windows.onStateChanged.addListener(onWindowStateChanged);
        return () => overwolf.windows.onStateChanged.removeListener(onWindowStateChanged);
    }, []);

    const handleMinimize = async () => {
        const win = await getCurrentWindow();
        overwolf.windows.minimize(win.id);
    };

    const handleToggleMaximize = async () => {
        const win = await getCurrentWindow();
        isMaximized ? overwolf.windows.restore(win.id) : overwolf.windows.maximize(win.id);
    };

    const handleClose = async () => {
        const win = await getCurrentWindow();
        overwolf.windows.close(win.id);
    };

    const btnStyle: React.CSSProperties = {
        background: 'transparent', border: 'none', color: '#888',
        width: '45px', height: '100%', cursor: 'pointer', fontSize: '14px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s', outline: 'none',
    };

    return (
        <div style={{ display: 'flex', height: '100%', WebkitAppRegion: 'no-drag', zIndex: 9999 } as any}>

            <button
                onClick={handleMinimize}
                style={btnStyle}
                // ✅ 번역 키 적용
                title={t('controls.minimize')}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#333'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888'; }}
            >
                <FaWindowMinimize size={10} style={{ marginBottom: '5px' }} />
            </button>

            <button
                onClick={handleToggleMaximize}
                style={btnStyle}
                // ✅ 번역 키 적용
                title={isMaximized ? t('controls.restore') : t('controls.maximize')}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#333'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888'; }}
            >
                {isMaximized ? <FaWindowRestore size={11} /> : <FaWindowMaximize size={11} />}
            </button>

            <button
                onClick={handleClose}
                style={btnStyle}
                // ✅ 번역 키 적용
                title={t('controls.close')}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#e74c3c'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888'; }}
            >
                <FaTimes size={15} />
            </button>
        </div>
    );
};

export default WindowControls;