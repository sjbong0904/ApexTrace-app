import React from 'react';
import type { Match } from '../types';
import { formatMatchElapsedTime } from '../utils/helpers';
import { getEventIconUrl } from '../utils/eventIcons';
import { FaHandshake } from 'react-icons/fa';
import { GiCrossedSwords } from 'react-icons/gi';

import { useTranslation } from 'react-i18next';
import { MATCH_PANEL_BODY_PADDING, MATCH_PANEL_HEADER, matchTimelineContentStyle, matchTimelineRowGap, matchTimelineRowStyle, matchTimelineTimeStyle } from './matchPanelStyles';

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
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--color-bg-sub-header)',
            overflow: 'hidden',
        }}>
            
            {/* 헤더 */}
            <div style={MATCH_PANEL_HEADER}>
                <span>{t('combatLog.title')}</span>
                <span style={{ fontWeight: 400 }}>{t('combatLog.eventsCount', { count: validEvents.length })}</span>
            </div>

            {/* 로그 리스트 */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: MATCH_PANEL_BODY_PADDING }}>
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
                    const timeLabel = formatMatchElapsedTime(event.timestamp - startTime, 'digital');
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
                        <div
                            key={index}
                            style={{
                                ...matchTimelineRowStyle({
                                    background: rowBg,
                                    borderLeft: `4px solid ${borderColor}`,
                                }),
                                ...matchTimelineRowGap(index === validEvents.length - 1),
                            }}
                        >
                            <div style={matchTimelineTimeStyle}>
                                {timeLabel}
                            </div>

                            <div style={matchTimelineContentStyle}>
                                
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