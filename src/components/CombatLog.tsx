import React from 'react';
import type { Match } from '../types';
import { formatMatchTime } from '../utils/helpers';
import { FaCross, FaHandshake, FaCrosshairs, FaSkull } from 'react-icons/fa'; 
import { GiCrossedSwords } from 'react-icons/gi';

// 🌟 i18next 훅 임포트
import { useTranslation } from 'react-i18next';

const CombatLog = ({ match }: { match: Match }) => {
    const { t } = useTranslation(); // 🌟 다국어 훅 추가
    const events = match.events || [];
    const startTime = match.startTime;
    const myName = match.playerName || t('combatLog.unknown');

    const validEvents = events.filter((e: any) => 
        ['kill', 'death', 'knockdown', 'assist', 'revive', 'respawn'].includes(e.type)
    );

    if (validEvents.length === 0) {
        return (
            <div style={{ width: '100%', height: '100%', background: '#1e1e1e', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>
                {t('combatLog.noEvents')}
            </div>
        );
    }

    return (
        <div style={{ paddingTop: '20px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
            
            {/* 헤더 */}
            <div style={{ 
                borderBottom: '1px solid #333', 
                background: '#1e1e1e',
                color: '#888', 
                fontWeight: 'bold',
                fontSize: '11px',
                display: 'flex',
                textTransform: 'uppercase',
                justifyContent: 'space-between',
                padding: '0 15px 5px 15px'
            }}>
                <span>{t('combatLog.title')}</span>
                <span style={{ fontWeight: 'normal' }}>{t('combatLog.eventsCount', { count: validEvents.length })}</span>
            </div>

            {/* 로그 리스트 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                {validEvents.map((event: any, index: number) => {
                    // "Me"라는 텍스트 비교 부분도 사전의 값을 참조하도록 수정
                    const isAttackerMe = event.attacker === t('combatLog.me') || event.attacker === myName;
                    const isVictimMe = event.victim === t('combatLog.me') || event.victim === myName;
                    const isMyKill = isAttackerMe && (event.type === 'kill' || event.type === 'knockdown');
                    const isMyDeath = isVictimMe || event.type === 'death';
                    
                    let Icon = GiCrossedSwords;
                    let color = '#ccc';
                    let rowBg = '#252525';
                    let borderColor = '#555';
                    const timeLabel = formatMatchTime(event.timestamp - startTime, 'digital');

                    if (event.type === 'kill') { Icon = FaSkull; color = '#c4c4c4'; }
                    else if (event.type === 'death') { Icon = FaCross; color = '#c4c4c4';}
                    else if (event.type === 'knockdown') { Icon = FaCrosshairs; color = '#fa5a2a'; }
                    else if (event.type === 'assist') { Icon = FaHandshake; color = '#3498db'; }
                    else if (event.type === 'revive' || event.type === 'respawn') { Icon = FaHandshake; color = '#2ecc71'; }

                    if (isMyKill) {
                        if(event.type === 'kill'){
                            rowBg = '#2ecc7027';
                            borderColor = '#2ecc70c7';
                        }
                    } else if (isMyDeath) {
                        if(event.type === 'kill' || event.type === 'death'){
                            rowBg = '#e74d3c2a';
                            borderColor = '#e74d3cd5';
                        }
                    }

                    const nameStyle: React.CSSProperties = {
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    };

                    return (
                        <div key={index} style={{ 
                            display: 'flex', alignItems: 'center', marginBottom: '8px', 
                            fontSize: '12px', padding: '8px', borderRadius: '4px',
                            background: rowBg,
                            width: '100%',
                            borderLeft: `4px solid ${borderColor}`, boxSizing: 'border-box'
                        }}>
                            {/* 시간 */}
                            <div style={{ minWidth: '40px', color: '#777', fontSize: '11px', fontWeight: 'bold' }}>
                                {timeLabel}
                            </div>
                            
                            {/* 내용 */}
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}>
                                
                                {/* 1. 공격자 */}
                                <span style={{
                                    ...nameStyle,
                                    textAlign: 'center',
                                    fontWeight: 'normal', 
                                    color: isAttackerMe ? '#2ecc71' : '#ccc', 
                                }} title={event.attacker}>
                                    {event.attacker}
                                </span>
                                
                                {/* 2. 중앙 아이콘 그룹 */}
                                <div style={{ 
                                    flex: '0 0 auto',
                                    margin: '0 5px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px',
                                    color: '#555',
                                }} title={event.type}>
                                    <span style={{ fontSize: '10px' }}>▶</span>
                                    <Icon size={10} color={color} />
                                </div>
    
                                {/* 3. 피해자 */}
                                <span style={{ 
                                    ...nameStyle,
                                    textAlign: 'center',
                                    fontWeight: 'normal',
                                    color: isVictimMe ? '#e74c3c' : '#ccc', 
                                }} title={event.victim}>
                                    {event.victim}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CombatLog;