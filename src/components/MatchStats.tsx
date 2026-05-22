import { useMemo, useState } from "react";
import { getMapConfig, formatMatchTime } from '../utils/helpers';
import type { Match } from '../types';
import { FaInfoCircle } from 'react-icons/fa';
import type { TFunction } from 'i18next'; // ✅ TFunction 타입 import
import { useTranslation } from 'react-i18next';

interface AutoResizingTextProps {
    text: string | number;
    baseSize?: number;
    color?: string;
    weight?: string;
    suffix?: string;
}

// ✅ any → AutoResizingTextProps 적용
const AutoResizingText = ({ text, baseSize = 16, color = '#fff', weight = '800', suffix = '' }: AutoResizingTextProps) => {
    const str = String(text);
    const len = str.length + (suffix ? suffix.length : 0);

    let fontSize = baseSize;
    if (len > 18) fontSize = baseSize * 0.8;
    else if (len > 14) fontSize = baseSize * 0.9;

    return (
        <div style={{
            fontSize: `${fontSize}px`,
            fontWeight: weight,
            color: color,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            width: '100%',
            lineHeight: '1.2'
        }} title={str}>
            {str}{suffix && <span style={{ fontSize: `${fontSize * 0.7}px`, fontWeight: 'normal', color: '#888', marginLeft: '2px' }}>{suffix}</span>}
        </div>
    );
};

const calculateTotalDistance = (path: any[], mapName: string) => {
    if (!path || !Array.isArray(path) || path.length < 2) return 0;
    const config = getMapConfig(mapName);
    const scale = config?.scale || 30;
    const RAW_JUMP_THRESHOLD = 5.0 * scale;

    let totalDist = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i];
        const p2 = path[i + 1];
        if (!p1 || !p2 || typeof p1.x !== 'number' || typeof p2.x !== 'number') continue;
        const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        if (dist <= RAW_JUMP_THRESHOLD) totalDist += dist;
    }
    return Math.round(totalDist);
};

// ✅ t: any → TFunction 적용
const determinePlaystyle = (t: TFunction, timeMin: number, dpm: number, speed: number, dist: number, dpk: number, kills: number, damage: number, KillConversionRate: number, Assists: number, placement: number, KPP: number, squadKills: number) => {

    if (timeMin < 3 && damage < 150)
        return { name: t('playstyles.deathbox.name'), sub: t('playstyles.deathbox.sub'), color: "#ccc", bgGradient: "linear-gradient(135deg, #4b4340 0%, #24201e 100%)" };

    if (kills >= 7 && damage >= (150 * kills) && damage <= (250 * kills))
        return { name: t('playstyles.aimbot.name'), sub: t('playstyles.aimbot.sub'), color: "#000", bgGradient: "linear-gradient(135deg, #008ea0 0%, #3dffb5 100%)", isPrimary: true };

    if (kills >= 10 && KillConversionRate > 85)
        return { name: t('playstyles.dominator.name'), sub: t('playstyles.dominator.sub'), color: "#fff", bgGradient: "linear-gradient(135deg, #b224ef 0%, #ff8b50 100%)", isPrimary: true };

    if (kills >= 7 && damage >= 2500)
        return { name: t('playstyles.warlord.name'), sub: t('playstyles.warlord.sub'), color: '#fff', bgGradient: "linear-gradient(135deg, #ff0844 0%, #635198 100%)", isPrimary: true };

    if (squadKills >= 6 && KPP >= 70)
        return { name: t('playstyles.atlas.name'), sub: t('playstyles.atlas.sub'), color: "#000", bgGradient: "linear-gradient(135deg, #f7903c 0%, #00c7aa 100%)", isPrimary: true };

    if (squadKills >= 6 && KPP === 90)
        return { name: t('playstyles.protagonist.name'), sub: t('playstyles.protagonist.sub'), color: "#fff", bgGradient: "linear-gradient(135deg, #8871ed 0%, #00107b 100%)", isPrimary: true };

    if (squadKills >= 6 && KPP <= 10 && timeMin > 5)
        return { name: t('playstyles.observer.name'), sub: t('playstyles.observer.sub'), color: "#ddd", bgGradient: "linear-gradient(135deg, #304352 0%, #171d24 100%)" };

    if (placement === 1 && kills === 0 && Assists === 0 && damage < 300)
        return { name: t('playstyles.pacifist.name'), sub: t('playstyles.pacifist.sub'), color: "#fff", bgGradient: "linear-gradient(135deg, #e7f6d1 0%, #a8e063 100%)" };

    if (placement === 1 && kills <= 2 && damage < 500 && Assists <= 2)
        return { name: t('playstyles.backpack.name'), sub: t('playstyles.backpack.sub'), color: "#fff", bgGradient: "linear-gradient(135deg, #fa8d75 0%, #B5AB87 100%)" };

    if (placement === 1)
        return { name: t('playstyles.champion.name'), sub: t('playstyles.champion.sub'), color: "#000", bgGradient: "linear-gradient(135deg, #FDC830 0%, #F37335 100%)", isPrimary: true };

    if (placement > 10 && kills >= 5)
        return { name: t('playstyles.unluckyAce.name'), sub: t('playstyles.unluckyAce.sub'), color: "#eee", bgGradient: "linear-gradient(135deg, #5a2e2e 0%, #2a1616 100%)", isPrimary: true };

    if (kills >= 4 && dpk < 140)
        return { name: t('playstyles.assassin.name'), sub: t('playstyles.assassin.sub'), color: "#fff", bgGradient: "linear-gradient(135deg, #141517 0%, #2c2f33 100%)" };

    if (damage >= 2000 && (kills <= 3 || dpk > 600))
        return { name: t('playstyles.sniper.name'), sub: t('playstyles.sniper.sub'), color: "#fff", bgGradient: "linear-gradient(135deg, #1a2a6c 0%, #11998e 100%)" };

    if (Assists >= 5 && Assists > (kills * 3))
        return { name: t('playstyles.sidekick.name'), sub: t('playstyles.sidekick.sub'), color: "#fff", bgGradient: "linear-gradient(135deg, #d4a373 0%, #a07a58 100%)" };

    if (timeMin < 5 && (dpm > 180 || kills >= 3))
        return { name: t('playstyles.berserker.name'), sub: t('playstyles.berserker.sub'), color: "#fff", bgGradient: "linear-gradient(135deg, #cb2d3e 0%, #c63900 100%)" };

    if (kills >= 5 && dpk < 100)
        return { name: t('playstyles.janitor.name'), sub: t('playstyles.janitor.sub'), color: "#ddd", bgGradient: "linear-gradient(135deg, #6c5b4e 0%, #3e332a 100%)" };

    if (kills >= 5)
        return { name: t('playstyles.sweeper.name'), sub: t('playstyles.sweeper.sub'), color: "#fff", bgGradient: "linear-gradient(135deg, #e65c00 0%, #F9D423 100%)" };

    if (kills >= 1 && damage >= 300)
        return { name: t('playstyles.soldier.name'), sub: t('playstyles.soldier.sub'), color: "#ccc", bgGradient: "linear-gradient(135deg, #515e63 0%, #2f383d 100%)" };

    if (kills === 0 && damage >= 600)
        return { name: t('playstyles.chihuahua.name'), sub: t('playstyles.chihuahua.sub'), color: "#fff", bgGradient: "linear-gradient(135deg, #a67c8e 0%, #6b4d5a 100%)" };

    if (speed > 120 && dist > 3000)
        return { name: t('playstyles.runner.name'), sub: t('playstyles.runner.sub'), color: "#ddd", bgGradient: "linear-gradient(135deg, #4f745e 0%, #2d4536 100%)" };

    if (timeMin > 15 && dist > 2000 && damage < 300)
        return { name: t('playstyles.ghost.name'), sub: t('playstyles.ghost.sub'), color: "#bbb", bgGradient: "linear-gradient(135deg, #4f5b66 0%, #2a3137 100%)" };

    if (timeMin > 12 && speed < 45)
        return { name: t('playstyles.rat.name'), sub: t('playstyles.rat.sub'), color: "#999", bgGradient: "linear-gradient(135deg, #2b302c 0%, #151a17 100%)" };

    if (placement === 2)
        return { name: t('playstyles.heartbreaker.name'), sub: t('playstyles.heartbreaker.sub'), color: "#ccc", bgGradient: "linear-gradient(135deg, #604561 0%, #362436 100%)" };

    if (dist > 1500 && damage < 200)
        return { name: t('playstyles.delivery.name'), sub: t('playstyles.delivery.sub'), color: "#ddd", bgGradient: "linear-gradient(135deg, #705e49 0%, #453727 100%)" };

    if (kills === 0 && damage < 100)
        return { name: t('playstyles.tourist.name'), sub: t('playstyles.tourist.sub'), color: "#ccc", bgGradient: "linear-gradient(135deg, #6c6675 0%, #3f3a47 100%)" };

    return { name: t('playstyles.npc.name'), sub: t('playstyles.npc.sub'), color: "#999", bgGradient: "linear-gradient(135deg, #424242 0%, #222222 100%)" };
};

const boxStyle: React.CSSProperties = {
    background: '#252525',
    padding: '6px 10px',
    borderRadius: '8px',
    border: '1px solid #333',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    minWidth: 0
};

const labelStyle: React.CSSProperties = {
    fontSize: '10px',
    color: '#888',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    width: '100%'
};

const valContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    gap: '4px',
    width: '100%',
    overflow: 'hidden'
};

interface MatchStatsProps {
    match: Match;
    onUserSelect?: (user: { uid: string, name: string }) => void;
}

const MatchStats = ({ match, onUserSelect }: MatchStatsProps) => {
    const { t } = useTranslation();
    const [showTooltip, setShowTooltip] = useState(false);
    const [showTooltip2, setShowTooltip2] = useState(false);
    // ✅ DOM 직접 조작 대신 state로 hover 관리
    const [hoveredTm, setHoveredTm] = useState<number | null>(null);

    const placement = typeof match.placement === 'string' ? parseInt(match.placement) : (match.placement || 20);
    const totalDamage = Number(match.damage || 0);
    const totalKills = Number(match.kills || 0);
    const totalAssists = Number(match.assists || 0);
    const totalKnocks = Number(match.knocks || 0);
    const events = match.events || [];
    const myName = match.playerName;

    const teammateStats = useMemo(() => {
        const roster = (match.teamStats || []).filter(tm => tm.name !== myName);
        // ✅ member: any 제거 — types.ts의 teamStats 타입 그대로 사용
        const stats = roster.map((member) => ({
            name: member.name,
            uid: member.uid,
            kills: Number(member.kills || 0)
        }));
        return stats.sort((a, b) => b.kills - a.kills);
    }, [match.teamStats, myName]);

    const knockEvents = events.filter(e =>
        e.type === 'knockdown' && e.attacker === myName
    );
    const killEvents = events.filter(e =>
        e.type === 'kill' && e.attacker === myName
    );

    // 넉다운→킬 전환율: 피해자 기준 유니크 (동일 넉다운 로그 중복 시 분모 과대 방지)
    const KillConversionRate = useMemo(() => {
        const norm = (s: string) => s.replace(/\[.*?\]/g, '').replace(/\s+/g, '').toLowerCase();
        const knockedVictims = new Set(
            knockEvents.map(k => k.victim).filter((v): v is string => !!v).map(norm)
        );
        if (knockedVictims.size > 0) {
            const finishedVictims = new Set(
                killEvents
                    .filter(k => k.victim && knockedVictims.has(norm(k.victim)))
                    .map(k => norm(k.victim!))
            );
            return Math.min(100, Math.round((finishedVictims.size / knockedVictims.size) * 100));
        }
        const tk = Number(match.knocks || 0);
        if (tk > 0) return Math.min(100, Math.round((totalKills / tk) * 100));
        return 0;
    }, [knockEvents, killEvents, match.knocks, totalKills]);

    let squadKills = Number(match.squadKills || 0);
    if (totalAssists + totalKills > squadKills) {
        squadKills = totalAssists + totalKills;
    }

    const durationMs = (match.endTime || Date.now()) - match.startTime;
    const durationMin = durationMs / 1000 / 60;
    const timeLabel = formatMatchTime(durationMs, 'text');
    const dpm = durationMin > 0.1 ? Math.round(totalDamage / durationMin) : 0;
    const distance = useMemo(() => calculateTotalDistance(match.path, match.map), [match.path, match.map]);
    const avgSpeed = durationMin > 0.5 ? Math.round(distance / durationMin) : 0;
    const avgSpeedSec = (avgSpeed / 60).toFixed(1);
    const dmgPerKill = totalKills > 0 ? Math.round(totalDamage / totalKills) : 0;

    // ✅ == → === 수정
    let KPP = Number(Math.round(((totalKills + totalAssists) / squadKills) * 100));
    if (squadKills === 0) KPP = 0;
    else if (KPP > 100) KPP = 100;

    const style = determinePlaystyle(t, durationMin, dpm, avgSpeed, distance, dmgPerKill, totalKills, totalDamage, KillConversionRate, totalAssists, placement, KPP, squadKills);

    const handleTeammateClick = (tm: { uid: any; name: string }) => {
        if (tm.uid && onUserSelect) {
            onUserSelect({ uid: tm.uid, name: tm.name });
        }
    };

    return (
        <div style={{ width: '100%', height: '100%', padding: '20px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gridTemplateRows: 'repeat(5, 1fr)',
                gap: '12px',
                flex: 1,
                minHeight: 0
            }}>
                {/* Playstyle */}
                <div style={{
                    ...boxStyle,
                    background: style.bgGradient ? style.bgGradient : `${style.color}22`,
                    border: style.bgGradient ? 'none' : `1px solid ${style.color}`,
                    color: style.bgGradient ? (style.color === '#333' ? '#333' : '#fff') : style.color,
                    position: 'relative',
                    textShadow: style.isPrimary ? '0 2px 4px rgba(0,0,0,0.4)' : 'none',
                    boxShadow: style.bgGradient ? `0 4px 15px ${style.color}40` : 'none',
                }}>
                    <div style={{
                        ...labelStyle,
                        color: style.bgGradient
                            ? (style.color === '#333' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.75)')
                            : '#888',
                        fontWeight: style.bgGradient ? '600' : 'normal',
                        letterSpacing: '0.5px'
                    }}>
                        {t('matchStats.playedLike')}
                    </div>
                    <div style={valContainerStyle}>
                        <AutoResizingText
                            text={style.name}
                            color={style.bgGradient ? (style.color === '#333' ? '#333' : '#fff') : style.color}
                        />
                    </div>
                    <div
                        onMouseEnter={() => setShowTooltip(true)}
                        onMouseLeave={() => setShowTooltip(false)}
                        style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            color: style.bgGradient
                                ? (style.color === '#333' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.6)')
                                : '#666',
                            cursor: 'help',
                            display: 'flex',
                            alignItems: 'center',
                            zIndex: 100
                        }}
                    >
                        <FaInfoCircle size={12} />
                    </div>
                    {showTooltip && (
                        <div style={{
                            position: 'absolute',
                            display: 'flex',
                            flexDirection: 'column',
                            top: '28px',
                            background: '#252525',
                            border: `1px solid #555`,
                            borderRadius: '4px',
                            padding: '6px 10px',
                            zIndex: 100,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            pointerEvents: 'none',
                            whiteSpace: 'nowrap',
                            minWidth: '120px'
                        }}>
                            <span style={{ fontSize: '10px', color: '#ddd', marginBottom: '2px' }}>
                                {t('matchStats.matchPlaystyle')}
                            </span>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#ddd' }}>
                                {style.name}
                            </span>
                            <span style={{ fontSize: '11px', color: '#ddd' }}>
                                "{style.sub}"
                            </span>
                        </div>
                    )}
                </div>

                {/* Survived */}
                <div style={boxStyle}>
                    <div style={labelStyle}>{t('matchStats.survivalTime')}</div>
                    <div style={valContainerStyle}>
                        <AutoResizingText text={timeLabel} color='#eeeeee' />
                    </div>
                </div>

                {/* KPP */}
                <div style={boxStyle}>
                    <div style={labelStyle}>{t('matchStats.killParticipant')}</div>
                    <div style={valContainerStyle}>
                        <AutoResizingText text={KPP} color='#32da78' suffix="%" />
                    </div>
                </div>

                {/* Conv. Rate */}
                <div style={{ ...boxStyle, position: 'relative' }}>
                    <div style={labelStyle}>{t('matchStats.knockToKill')}</div>
                    <div style={valContainerStyle}>
                        <AutoResizingText text={KillConversionRate} suffix="%" />
                    </div>
                    <div
                        onMouseEnter={() => setShowTooltip2(true)}
                        onMouseLeave={() => setShowTooltip2(false)}
                        style={{ position: 'absolute', top: '8px', right: '8px', color: '#666', cursor: 'help', alignItems: 'center', zIndex: 100 }}
                    >
                        <FaInfoCircle size={12} />
                    </div>
                    {showTooltip2 && (
                        <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', top: '28px', right: '20px', background: '#252525', border: `1px solid #666`, borderRadius: '4px', padding: '4px 8px', zIndex: 100, boxShadow: '0 4px 6px rgba(0,0,0,0.5)', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: '11px', color: '#eee' }}>
                                {t('matchStats.knockToKillTooltip1')}
                            </span>
                            <span style={{ fontSize: '11px', color: '#eee' }}>
                                {t('matchStats.knockToKillTooltip2')}
                            </span>
                        </div>
                    )}
                </div>

                {/* Damage Per Kill */}
                <div style={boxStyle}>
                    <div style={labelStyle}>{t('matchStats.damagePerKill')}</div>
                    <div style={valContainerStyle}>
                        <AutoResizingText text={dmgPerKill} color='#ae49f1' suffix={t('matchStats.dmgKillSuffix')} />
                    </div>
                </div>

                {/* DPM */}
                <div style={boxStyle}>
                    <div style={labelStyle}>{t('matchStats.damagePerMin')}</div>
                    <div style={valContainerStyle}>
                        <AutoResizingText text={dpm} suffix={t('matchStats.dmgMinSuffix')} />
                    </div>
                </div>

                {/* Distance */}
                <div style={boxStyle}>
                    <div style={labelStyle}>{t('matchStats.travelDistance')}</div>
                    <div style={valContainerStyle}>
                        <AutoResizingText text={distance.toLocaleString()} color='#509df5ff' suffix={t('matchStats.mSuffix')} />
                    </div>
                </div>

                {/* Avg Speed */}
                <div style={boxStyle}>
                    <div style={labelStyle}>{t('matchStats.avgMoveSpeed')}</div>
                    <div style={valContainerStyle}>
                        <AutoResizingText text={avgSpeedSec} suffix={t('matchStats.msSuffix')} />
                    </div>
                </div>

                {teammateStats.length > 0 ? (
                    <>
                        {teammateStats.slice(0, 2).map((tm, idx) => (
                            <div
                                key={idx}
                                onClick={() => handleTeammateClick(tm)}
                                // ✅ DOM 직접 조작 제거 → hoveredTm state로 대체
                                onMouseEnter={() => { if (tm.uid && onUserSelect) setHoveredTm(idx); }}
                                onMouseLeave={() => setHoveredTm(null)}
                                style={{
                                    ...boxStyle,
                                    border: '1px solid #f89b44',
                                    background: hoveredTm === idx ? '#333' : '#252525',
                                    cursor: (tm.uid && onUserSelect) ? 'pointer' : 'default',
                                    transition: 'background 0.2s'
                                }}
                                title={tm.uid ? t('matchStats.clickToViewProfile') : t('matchStats.profileNotAvailable')}
                            >
                                <div style={{ fontSize: '12px', color: '#ffffff', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                                    {tm.name}
                                </div>
                                <div style={valContainerStyle}>
                                    <AutoResizingText text={tm.kills} color='#f89b44' suffix={t('matchStats.killsSuffix')} />
                                </div>
                            </div>
                        ))}

                        {/* 듀오용 빈칸 채우기 */}
                        {teammateStats.length === 1 && (
                            <div style={{ ...boxStyle, border: '1px solid #333' }}>
                                <div style={labelStyle}>{t('matchStats.totalKnocks')}</div>
                                <div style={valContainerStyle}>
                                    <AutoResizingText text={totalKnocks} color='#9b59b6' suffix={t('matchStats.knocksSuffix')} />
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div style={boxStyle}>
                            <div style={labelStyle}>{t('matchStats.totalKnocks')}</div>
                            <div style={valContainerStyle}>
                                <AutoResizingText text={totalKnocks} color='#9b59b6' suffix={t('matchStats.knocksSuffix')} />
                            </div>
                        </div>
                        <div style={boxStyle}>
                            <div style={labelStyle}>{t('matchStats.totalAssists')}</div>
                            <div style={valContainerStyle}>
                                <AutoResizingText text={totalAssists} color='#f1c40f' suffix={t('matchStats.assistsSuffix')} />
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default MatchStats;