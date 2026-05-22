import { useMemo } from 'react';
import { useTranslation } from 'react-i18next'; // ✅ i18n 추가
import type { Match } from '../types'; // ✅ any[] → Match[]

const PerformanceTrend = ({ history }: { history: Match[] }) => {
    const { t } = useTranslation(); // ✅ i18n 훅

    // ✅ data를 useMemo로 감싸기 — 매 렌더마다 새 배열 생성 방지
    const data = useMemo(() => history.slice(0, 20).reverse(), [history]);

    const width = 600;
    const height = 120;
    const paddingY = 25;
    const paddingX = 30;
    const maxRank = 20;

    // ✅ animationTriggerKey useMemo — data가 안정적인 참조를 가지므로 정상 동작
    const animationTriggerKey = useMemo(() => {
        if (data.length === 0) return 'empty';
        const first = data[0].matchId || data[0].startTime;
        const last = data[data.length - 1].matchId || data[data.length - 1].startTime;
        return `${first}-${last}-${data.length}`;
    }, [data]);

    const getX = (index: number) =>
        paddingX + (index / 19) * (width - paddingX * 2);

    const getXPercent = (index: number) => (getX(index) / width) * 100;

    const getY = (rank: number) => {
        const safeRank = Math.min(Math.max(rank, 1), maxRank);
        return paddingY + ((safeRank - 1) / (maxRank - 1)) * (height - paddingY * 2);
    };

    // ✅ 모든 Hook 선언 후 조기 return — Rules of Hooks 준수
    if (data.length === 0) {
        return (
            <div style={{ width: '100%', height: '100px', background: '#252525', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: '12px' }}>
                {t('performanceTrend.noData', 'No match data available')}
            </div>
        );
    }

    const coordinates = data.map((match, i) => {
        let rank = 20;
        if (match.placement && match.placement !== '-') {
            rank = typeof match.placement === 'string' ? parseInt(match.placement) : match.placement;
        }
        return { x: getX(i), y: getY(rank) };
    });

    const strokePathData = coordinates.map((pt, i) =>
        i === 0 ? `M ${pt.x},${pt.y}` : `L ${pt.x},${pt.y}`
    ).join(' ');

    const fillAreaPathData = `
        M ${coordinates.map(pt => `${pt.x},${pt.y}`).join(' ')} 
        L ${getX(data.length - 1)},${height} 
        L ${getX(0)},${height} 
        Z
    `;

    return (
        <div style={{ width: '100%', padding: '10px 0' }}>
            <h3 style={{ marginTop: 0, marginBottom: '10px', color: '#eee', fontSize: '18px' }}>
                {/* ✅ i18n 적용 */}
                {t('performanceTrend.title', 'Performance Trend')}
                <span style={{ fontSize: '12px', color: '#666', fontWeight: 'normal', marginLeft: '8px' }}>
                    {t('performanceTrend.subtitle', '(Old → Recent)')}
                </span>
            </h3>

            <div style={{ width: '100%', height: '120px', background: '#252525', borderRadius: '8px', position: 'relative', border: '1px solid #333', overflow: 'visible' }}>
                <div style={{ position: 'absolute', top: `${paddingY}px`, left: '10px', right: '10px', borderTop: '1px dashed #444', height: '1px' }} />
                <div style={{ position: 'absolute', top: '50%', left: '10px', right: '10px', borderTop: '1px dashed #333', height: '1px' }} />
                <div style={{ position: 'absolute', bottom: `${paddingY}px`, left: '10px', right: '10px', borderTop: '1px dashed #444', height: '1px' }} />

                <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
                    <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#c9d0d3" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#c9d0d3" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    {data.length > 1 && (
                        <>
                            <path d={fillAreaPathData} fill="url(#chartGradient)" stroke="none" />
                            <path
                                key={animationTriggerKey}
                                d={strokePathData}
                                fill="none"
                                stroke="#c9d0d3"
                                strokeOpacity="0.5"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="path-draw-animation apex-glow-line"
                            />
                        </>
                    )}
                </svg>

                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                    {data.map((match, i) => {
                        let rank = 20;
                        if (match.placement && match.placement !== '-') {
                            rank = typeof match.placement === 'string' ? parseInt(match.placement) : match.placement;
                        }
                        const isWin = rank === 1;
                        let pointColor = '#818181ff';
                        if (rank === 1) pointColor = "#ff4757";
                        else if (rank <= 5) pointColor = "#00d2be";
                        else pointColor = "#dfe6e9";

                        const left = getXPercent(i);
                        const top = getY(rank);

                        return (
                            <div
                                key={i}
                                style={{ position: 'absolute', left: `${left}%`, top: `${top}px`, transform: 'translate(-50%, -50%)', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto', cursor: 'default' }}
                                title={`#${rank} Place (${match.kills} Kills)`}
                            >
                                <div style={{ width: isWin ? '8px' : '6px', height: isWin ? '8px' : '6px', background: pointColor, boxShadow: `0 0 4px ${pointColor}, 0 0 7px ${pointColor}`, borderRadius: '50%', border: '1px solid #252525' }} />
                                <div style={{ position: 'absolute', top: '-10px', color: '#ccc', fontSize: '11px', fontWeight: 'bold', textShadow: '1px 1px 2px #000', whiteSpace: 'nowrap' }}>
                                    {rank}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default PerformanceTrend;