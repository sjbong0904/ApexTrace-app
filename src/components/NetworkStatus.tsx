//NetworkStatus.tsx
import { useState, useEffect } from 'react';
import { FaExclamationTriangle, FaWifi } from 'react-icons/fa';

// 🌟 i18next 훅 임포트
import { useTranslation } from 'react-i18next';

const NetworkStatus = () => {
    const { t } = useTranslation(); // 🌟 다국어 훅 추가
    const [isOnline, setIsOnline] = useState(navigator.onLine);

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

    if (isOnline) return null;

    return (
        <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, animation: 'slideDown 0.5s ease-out' }}>
            {/* 알림창 본체 */}
            <div style={{ background: 'rgba(220, 53, 69, 0.95)', color: 'white', padding: '12px 25px', borderRadius: '50px', boxShadow: '0 4px 15px rgba(0,0,0,0.4)', border: '1px solid #ff6b6b', display: 'flex', alignItems: 'center', gap: '12px', backdropFilter: 'blur(4px)', minWidth: '300px', justifyContent: 'center' }}>
                <FaExclamationTriangle size={20} color="#ffeca0" />
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{t('networkStatus.disconnected')}</span>
                    <span style={{ fontSize: '11px', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <FaWifi size={10}/> {t('networkStatus.reconnecting')}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default NetworkStatus;