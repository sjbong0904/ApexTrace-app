import React, { useState } from 'react';
import type { Match } from '../types';
import { formatMatchElapsedTime } from '../utils/helpers';
import { getEventIconUrl } from '../utils/eventIcons';
import { FaHandshake } from 'react-icons/fa';
import { GiCrossedSwords } from 'react-icons/gi';

import { useTranslation } from 'react-i18next';
import { getWeaponDisplayName, getWeaponSilhouetteUrl, WHITE_SILHOUETTE_FILTER } from '../utils/weaponTheme';
import { MATCH_PANEL_BODY_PADDING, MATCH_PANEL_HEADER, matchTimelineContentStyle, matchTimelineRowGap, matchTimelineRowStyle, matchTimelineTimeStyle } from './matchPanelStyles';

/**
 * Fixed kill-feed columns: attacker | weapon | event icon | victim.
 * The middle slots keep the same width whether or not a weapon is known, and both
 * names get an equal share, so every row lines up regardless of event type or name length.
 */
const EVENT_ICON_SLOT = 20;
const WEAPON_SLOT = 48;
const killFeedGridStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: 'grid',
    gridTemplateColumns: `minmax(0, 1fr) ${WEAPON_SLOT}px ${EVENT_ICON_SLOT}px minmax(0, 1fr)`,
    columnGap: 6,
    alignItems: 'center',
};

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

/** Small white silhouette of the weapon used in an event; hidden when unknown or the image is missing. */
const EventWeapon = ({ weapon }: { weapon?: string | null }) => {
    const [failed, setFailed] = useState(false);
    if (!weapon || failed || weapon.toLowerCase() === 'unknown') return null;
    const name = getWeaponDisplayName(weapon);
    return (
        <img
            src={getWeaponSilhouetteUrl(weapon)}
            alt={name}
            title={name}
            onError={() => setFailed(true)}
            style={{ display: 'block', height: 14, maxWidth: '100%', objectFit: 'contain', filter: WHITE_SILHOUETTE_FILTER, opacity: 0.85, transform: 'scaleX(-1)' }}
        />
    );
};

interface CombatLogProps {
    match: Match;
    /** Used inside a tab strip that already names the panel. */
    hideHeader?: boolean;
    /** Row clicked → move the map replay to this epoch-ms moment. */
    onSeek?: (timestamp: number) => void;
    /** Highlight the row last sent to the replay. */
    activeTimestamp?: number | null;
}

const CombatLog = ({ match, hideHeader = false, onSeek, activeTimestamp = null }: CombatLogProps) => {
    const { t } = useTranslation();
    const events = match.events || [];
    const startTime = match.startTime;
    const meLabel = t('combatLog.me');
    const unknownLabel = t('combatLog.unknown');
    const myName = match.playerName && match.playerName !== 'Unknown' ? match.playerName : '';

    const validEvents = events.filter((e) => 
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
            
            {!hideHeader && <div style={MATCH_PANEL_HEADER}>
                <span>{t('combatLog.title')}</span>
                <span style={{ fontWeight: 400 }}>{t('combatLog.eventsCount', { count: validEvents.length })}</span>
            </div>}

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: MATCH_PANEL_BODY_PADDING }}>
                {validEvents.map((event, index) => {
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
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    };

                    return (
                        <div
                            key={index}
                            role={onSeek ? 'button' : undefined}
                            tabIndex={onSeek ? 0 : undefined}
                            title={onSeek ? t('combatLog.seekHint', { defaultValue: 'Show this moment in the replay' }) : undefined}
                            onClick={onSeek ? () => onSeek(event.timestamp) : undefined}
                            onKeyDown={onSeek ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSeek(event.timestamp); } } : undefined}
                            style={{
                                ...matchTimelineRowStyle({
                                    background: rowBg,
                                    borderLeft: `4px solid ${borderColor}`,
                                }),
                                ...matchTimelineRowGap(index === validEvents.length - 1),
                                cursor: onSeek ? 'pointer' : undefined,
                                outline: activeTimestamp === event.timestamp ? '1px solid var(--color-rank-first)' : undefined,
                                outlineOffset: -1,
                            }}
                        >
                            <div style={matchTimelineTimeStyle}>
                                {timeLabel}
                            </div>

                            <div style={{ ...matchTimelineContentStyle, ...killFeedGridStyle }}>
                                {/* Attacker hugs the icon from the left, victim from the right — a kill-feed layout. */}
                                <span style={{
                                    ...nameStyle,
                                    textAlign: 'right',
                                    fontWeight: 'normal',
                                    color: isAttackerMe ? 'var(--color-success)' : 'var(--color-text-dim)',
                                }} title={attackerDisplay || undefined}>
                                    {attackerDisplay}
                                </span>

                                {/* Always rendered (empty when no weapon) so the icon and victim columns never shift. */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
                                    <EventWeapon weapon={event.weapon} />
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={formatEventTypeLabel(event.type)}>
                                    {eventIconUrl ? (
                                        <img
                                            src={eventIconUrl}
                                            alt=""
                                            width={EVENT_ICON_SLOT}
                                            height={EVENT_ICON_SLOT}
                                            style={{ display: 'block', objectFit: 'contain' }}
                                        />
                                    ) : (
                                        <FallbackIcon size={12} color={fallbackColor} />
                                    )}
                                </div>

                                <span style={{
                                    ...nameStyle,
                                    textAlign: 'left',
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