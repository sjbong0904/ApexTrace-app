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
            <div style={{ width: '100%', height: '100%', background: 'var(--color-bg-sub-header)', color: 'var(--color-text-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>
                {t('combatLog.noEvents')}
            </div>
        );
    }

    return (
        <div style={{ paddingTop: '20px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-sub-header)' }}>
            
            {/* 헤더 */}
            <div style={{ 
                borderBottom: '1px solid var(--color-border)', 
                background: 'var(--color-bg-sub-header)',
                color: 'var(--color-text-muted)', 
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
                    let color = 'var(--color-text-dim)';
                    let rowBg = 'var(--color-bg-card)';
                    let borderColor = 'var(--color-border-light)';
                    const timeLabel = formatMatchTime(event.timestamp - startTime, 'digital');

                    if (event.type === 'kill') { Icon = FaSkull; color = 'var(--color-text-muted)'; }
                    else if (event.type === 'death') { Icon = FaCross; color = 'var(--color-text-muted)'; }
                    else if (event.type === 'knockdown') { Icon = FaCrosshairs; color = 'var(--color-warning)'; }
                    else if (event.type === 'assist') { Icon = FaHandshake; color = 'var(--color-mode-trio)'; }
                    else if (event.type === 'revive' || event.type === 'respawn') { Icon = FaHandshake; color = 'var(--color-success)'; }

                    if (isMyKill) {
                        if (event.type === 'kill') {
                            rowBg = 'color-mix(in srgb, var(--color-success) 18%, var(--color-bg-card))';
                            borderColor = 'var(--color-success)';
                        }
                    } else if (isMyDeath) {
                        if (event.type === 'kill' || event.type === 'death') {
                            rowBg = 'color-mix(in srgb, var(--color-accent) 18%, var(--color-bg-card))';
                            borderColor = 'var(--color-accent)';
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
                            <div style={{ minWidth: '40px', color: 'var(--color-text-subtle)', fontSize: '11px', fontWeight: 'bold' }}>
                                {timeLabel}
                            </div>
                            
                            {/* 내용 */}
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}>
                                
                                {/* 1. 공격자 */}
                                <span style={{
                                    ...nameStyle,
                                    textAlign: 'center',
                                    fontWeight: 'normal', 
                                    color: isAttackerMe ? 'var(--color-success)' : 'var(--color-text-dim)', 
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
                                    color: 'var(--color-text-subtle)',
                                }} title={event.type}>
                                    <span style={{ fontSize: '10px' }}>▶</span>
                                    <Icon size={10} color={color} />
                                </div>
    
                                {/* 3. 피해자 */}
                                <span style={{ 
                                    ...nameStyle,
                                    textAlign: 'center',
                                    fontWeight: 'normal',
                                    color: isVictimMe ? 'var(--color-accent)' : 'var(--color-text-dim)', 
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