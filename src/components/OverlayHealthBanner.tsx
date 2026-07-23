import { useEffect, useState } from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

type OverlayHealth = { hookError?: boolean; at?: number };

const readOverlayHealth = (): OverlayHealth => {
    try {
        const bg = window.overwolf?.windows?.getMainWindow() as {
            apexData?: { getOverlayHealth?: () => OverlayHealth };
            Store?: { overlayHealth?: OverlayHealth };
        } | undefined;
        return bg?.apexData?.getOverlayHealth?.()
            ?? bg?.Store?.overlayHealth
            ?? { hookError: false };
    } catch {
        return { hookError: false };
    }
};

/** Surfaces Overwolf overlay input-hook failure (in-game window may not accept input). */
const NETWORK_BANNER_STACK_OFFSET = 72;

const OverlayHealthBanner = () => {
    const { t } = useTranslation();
    const [hookError, setHookError] = useState(false);
    const [isOnline, setIsOnline] = useState(
        typeof navigator !== 'undefined' ? navigator.onLine : true,
    );

    useEffect(() => {
        const poll = () => {
            const health = readOverlayHealth();
            setHookError(Boolean(health.hookError));
        };
        poll();
        const id = window.setInterval(poll, 2000);
        return () => window.clearInterval(id);
    }, []);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (!hookError) return null;

    const top = isOnline ? 20 : 20 + NETWORK_BANNER_STACK_OFFSET;

    return (
        <div style={{ position: 'absolute', top, left: '50%', transform: 'translateX(-50%)', zIndex: 9998, animation: 'slideDown 0.5s ease-out' }}>
            <div style={{
                background: 'rgba(180, 110, 20, 0.95)',
                color: 'white',
                padding: '12px 25px',
                borderRadius: '50px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
                border: '1px solid #f0c36a',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                backdropFilter: 'blur(4px)',
                minWidth: '320px',
                maxWidth: '520px',
                justifyContent: 'center',
            }}>
                <FaExclamationTriangle size={20} color="#ffeca0" style={{ flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '14px' }}>
                        {t('overlayHealth.title', { defaultValue: 'In-game overlay input failed' })}
                    </span>
                    <span style={{ fontSize: '11px', opacity: 0.9, lineHeight: 1.4 }}>
                        {t('overlayHealth.message', {
                            defaultValue: 'Restart your PC, then relaunch Apex Legends and Overwolf. Desktop tracking still works.',
                        })}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default OverlayHealthBanner;
