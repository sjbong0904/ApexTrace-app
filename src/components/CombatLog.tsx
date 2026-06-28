import React from 'react';
import type { Match } from '../types';
import { formatMatchTime } from '../utils/helpers';
import { getEventIconUrl } from '../utils/eventIcons';
import { FaHandshake } from 'react-icons/fa';
import { GiCrossedSwords } from 'react-icons/gi';

import { useTranslation } from 'react-i18next';

const formatEventTypeLabel = (type: string) =>
    type.length > 0 ? type.charAt(0).toUpperCase() + type.slice(1) : type;

const ME_TOKENS = new Set(['me']);

const isMeToken = (name: string | undefined | null, myName: string, meLabel: string): boolean => {
    if (!name) return false;
    if (ME_TOKENS.has(name.trim().toLowerCase()) || name === meLabel) return true;
    return !!myName && name === myName;
};

const isUnknownToken = (name: string | undefined | null, unknownLabel: string): boolean => {
    if (!name || !name.trim()) return true;
    const trimmed = name.trim();
    if (trimmed.toLowerCase() === 'unknown') return true;
    return trimmed === unknownLabel;
};

const formatLogName = (
    name: string | undefined,
    eventType: string,
    role: 'attacker' | 'victim',
    myName: string,
    meLabel: string,
    unknownLabel: string,
): string => {
    const isSupportEvent = eventType === 'revive' || eventType === 'respawn';
    if (isSupportEvent && role === 'attacker' && isUnknownToken(name, unknownLabel)) return '';
    if (isMeToken(name, myName, meLabel)) return myName.trim() || meLabel;
    if (isUnknownToken(name, unknownLabel)) return unknownLabel;
    return name ?? unknownLabel;
};

const CombatLog = ({ match }: { match: Match }) => {
    const { t } = useTranslation();
    const events = match.events || [];
    const startTime = match.startTime;
    const meLabel = t('combatLog.me');
    const unknownLabel = t('combatLog.unknown');
    const myName = match.playerName && match.playerName !== 'Unknown' ? match.playerName : '';

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
        <div style={{
            width: '100%',
            height: '100%',
            minHeight: 0,
            boxSizing: 'border-box',
            paddingTop: '20px',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--color-bg-sub-header)',
            overflow: 'hidden',
        }}>
            
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
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 10px 12px' }}>
                {validEvents.map((event: any, index: number) => {
                    const attackerDisplay = formatLogName(
                        event.attacker, event.type, 'attacker', myName, meLabel, unknownLabel,
                    );
                    const victimDisplay = formatLogName(
                        event.victim, event.type, 'victim', myName, meLabel, unknownLabel,
                    );
                    const isAttackerMe = isMeToken(event.attacker, myName, meLabel);
                    const isVictimMe = isMeToken(event.victim, myName, meLabel);
                    const isMyKill = isAttackerMe && (event.type === 'kill' || event.type === 'knockdown');
                    const isMyDeath = isVictimMe || event.type === 'death';
                    const isMySupportEvent = (event.type === 'revive' || event.type === 'respawn') && isVictimMe;
                    
                    let FallbackIcon = GiCrossedSwords;
                    let fallbackColor = 'var(--color-text-dim)';
                    let rowBg = 'var(--color-bg-card)';
                    let borderColor = 'var(--color-border-light)';
                    const timeLabel = formatMatchTime(event.timestamp - startTime, 'digital');
                    const eventIconUrl = getEventIconUrl(event.type);

                    if (event.type === 'assist') {
                        FallbackIcon = FaHandshake;
                        fallbackColor = 'var(--color-mode-trio)';
                    }

                    if (isMyKill) {
                        if (event.type === 'kill') {
                            rowBg = 'color-mix(in srgb, var(--color-success) 18%, var(--color-bg-card))';
                            borderColor = 'var(--color-success)';
                        }
                    } else if (isMySupportEvent) {
                        rowBg = 'color-mix(in srgb, var(--color-success) 18%, var(--color-bg-card))';
                        borderColor = 'var(--color-success)';
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
                            display: 'flex', alignItems: 'center', marginBottom: index === validEvents.length - 1 ? 0 : '8px',
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
                                
                                {/* 1. 공격자 — 빈칸이어도 flex 유지로 다른 행과 정렬 통일 */}
                                <span style={{
                                    ...nameStyle,
                                    textAlign: 'center',
                                    fontWeight: 'normal',
                                    color: isAttackerMe ? 'var(--color-success)' : 'var(--color-text-dim)',
                                }} title={attackerDisplay || undefined}>
                                    {attackerDisplay}
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
                                }} title={formatEventTypeLabel(event.type)}>
                                    {eventIconUrl ? (
                                        <img
                                            src={eventIconUrl}
                                            alt=""
                                            width={20}
                                            height={20}
                                            style={{ display: 'block', objectFit: 'contain', flexShrink: 0 }}
                                        />
                                    ) : (
                                        <FallbackIcon size={10} color={fallbackColor} />
                                    )}
                                </div>
    
                                {/* 3. 피해자 */}
                                <span style={{ 
                                    ...nameStyle,
                                    textAlign: 'center',
                                    fontWeight: 'normal',
                                    color: isMySupportEvent
                                        ? 'var(--color-success)'
                                        : isVictimMe
                                            ? 'var(--color-accent)'
                                            : 'var(--color-text-dim)',
                                }} title={victimDisplay}>
                                    {victimDisplay}
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