import React, { useEffect, useState } from 'react';
// 🌟 i18next 훅 임포트
import { useTranslation } from 'react-i18next';

// Overwolf 상태 API 응답 타입 정의
interface GameEventStatus {
    state: number; // 1: Green, 2: Yellow, 3: Red
    features?: any[];
}

const GameStatusIndicator: React.FC = () => {
    const { t } = useTranslation(); // 🌟 다국어 훅 추가
    const [status, setStatus] = useState<number>(1); // 기본값: Green

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                // Apex Legends (ID: 21566) 상태 조회
                const response = await fetch('https://game-events-status.overwolf.com/21566_prod.json');
                if (response.ok) {
                    const data: GameEventStatus = await response.json();
                    setStatus(data.state);
                }
            } catch (error) {
                console.error("Failed to fetch GEP status:", error);
            }
        };

        fetchStatus();
        // 5분(300초)마다 상태 갱신
        const interval = setInterval(fetchStatus, 300000); 
        return () => clearInterval(interval);
    }, []);

    // 상태별 색상 및 메시지 설정
    const getStatusInfo = (s: number) => {
        switch (s) {
            case 1: 
                return { 
                    color: '#2ecc71', // 초록
                    shadow: '0 0 10px #2ecc71',
                    text: t('gameStatus.good')
                };
            case 2: 
                return { 
                    color: '#f1c40f', // 노랑
                    shadow: '0 0 10px #f1c40f',
                    text: t('gameStatus.partial')
                };
            case 3: 
                return { 
                    color: '#e74c3c', // 빨강
                    shadow: '0 0 10px #e74c3c',
                    text: t('gameStatus.unavailable')
                };
            default: 
                return { 
                    color: '#95a5a6',
                    shadow: 'none',
                    text: t('gameStatus.unknown')
                };
        }
    };

    const info = getStatusInfo(status);

    return (
        <div 
            title={info.text} // 마우스 오버 시 나오는 설명 (다국어 적용)
            style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: info.color,
                boxShadow: info.shadow,
                margin: 0,
                cursor: 'help',
                transition: 'all 0.3s ease',
                flexShrink: 0
            }}
        />
    );
};

export default GameStatusIndicator;