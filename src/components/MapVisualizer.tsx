import React, { useState, useRef, useMemo, useEffect } from 'react';
import { getCssPos, getMapConfig } from '../utils/helpers';
import type { Match } from '../types'
import { FaExpand, FaCompress } from 'react-icons/fa';

const PATH_COLORS = [
    "#4cd137", "#e67e22", "#f1c40f", "#00d2be", "#9b59b6", 
    "#1014ebff", "#974515ff", "#09b665ff", "#e74c3c"
];

interface MapVisualizerProps {
    match: Match; 
}

const MapVisualizer: React.FC<MapVisualizerProps> = ({ match }) => {
    const [scale, setScale] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [isFullscreen, setIsFullscreen] = useState(false);
    
    const containerRef = useRef<HTMLDivElement>(null); // 🌟 전체 화면을 위한 ref
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });

    // 🌟 Fullscreen API 상태 변경 감지
    useEffect(() => {
        const handleFullscreenChange = () => {
            const isCurrentlyFullscreen = !!document.fullscreenElement;
            setIsFullscreen(isCurrentlyFullscreen);

            if (!isCurrentlyFullscreen) {
                setScale(1);
                setPos({ x: 0, y: 0 });
            }
        };

        // 휠 스크롤 줌 로직
        const handleWheel = (e: WheelEvent) => {
            // 전체 화면일 때만 휠 줌 작동
            if (!document.fullscreenElement) return;

            e.preventDefault(); // 페이지 스크롤 방지

            const zoomStep = 0.5;
            const delta = e.deltaY > 0 ? -zoomStep : zoomStep; // 휠 아래로: 축소, 위로: 확대

            setScale(prev => {
                const newScale = prev + delta;
                const clamped = Math.min(Math.max(1, newScale), 12);
                if (clamped === 1) setPos({ x: 0, y: 0 });
                return clamped;
            });
        };

        const container = containerRef.current;
        if (container) {
            container.addEventListener('wheel', handleWheel, { passive: false });
        }

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        
        return () => {
            if (container) {
                container.removeEventListener('wheel', handleWheel);
            }
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    const toggleFullscreen = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!document.fullscreenElement) {
            try {
                // 전체 화면 요청
                if (containerRef.current?.requestFullscreen) {
                    await containerRef.current.requestFullscreen();
                }
            } catch (err) {
                console.error(`Error attempting to enable fullscreen: ${err}`);
            }
        } else {
            // 전체 화면 해제
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            }
        }
    };

    const handleZoom = (type: 'in' | 'out') => {
        setScale(prev => {
            const newScale = type === 'in' ? prev + 0.5 : prev - 0.5;
            const clamped = Math.min(Math.max(1, newScale), 12);
            if (clamped === 1) setPos({ x: 0, y: 0 });
            return clamped;
        });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (scale > 1) {
            isDragging.current = true;
            dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
        }
    };
    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging.current && scale > 1) {
            e.preventDefault();
            setPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
        }
    };
    const handleMouseUp = () => {
        isDragging.current = false;
    };

    const mapConfig = useMemo(() => {
        const config = getMapConfig(match.map);
        return config;
    }, [match.map]);

    const validPath = useMemo(() => {
        if (!match.path || !Array.isArray(match.path)) return [];
        return match.path.filter(pt => pt && typeof pt.x === 'number' && typeof pt.y === 'number');
    }, [match.path]);

    const { segments, jumpMarkers, displayPath } = useMemo(() => {
        const emptyResult = { segments: [] as string[], jumpMarkers: [] as any[], displayPath: [] as any[] };
        if (validPath.length === 0) return emptyResult;

        const filterGroundPath = (points: any[]) => {
            let filtered = points.filter((pt: any) => pt.p === 'landed');
            if (filtered.length === 0) filtered = points.filter((pt: any) => pt.p !== 'aircraft');
            if (filtered.length === 0) filtered = points;
            return filtered;
        };

        const usesLifeSegments = validPath.some(
            (pt: any) => pt.s !== undefined && pt.s !== null
        );

        const resultSegments: string[] = [];
        const resultMarkers: any[] = [];

        const pushPathFromPoints = (points: any[]) => {
            if (points.length === 0) return;
            const startCss = getCssPos(points[0].x, points[0].y, match.map);
            let pathStr = `M ${startCss.x} ${startCss.y}`;
            for (let i = 1; i < points.length; i++) {
                const css = getCssPos(points[i].x, points[i].y, match.map);
                pathStr += ` L ${css.x} ${css.y}`;
            }
            resultSegments.push(pathStr);
        };

        if (usesLifeSegments) {
            const segmentMap = new Map<number, any[]>();
            for (const pt of validPath) {
                const segId = pt.s ?? 0;
                if (!segmentMap.has(segId)) segmentMap.set(segId, []);
                segmentMap.get(segId)!.push(pt);
            }

            const groups = Array.from(segmentMap.entries())
                .sort(([a], [b]) => a - b)
                .map(([id, points]) => ({ id, points: filterGroundPath(points) }))
                .filter((group) => group.points.length > 0);

            if (groups.length === 0) return emptyResult;

            groups.forEach((group, idx) => {
                if (group.points.length === 0) return;
                if (idx > 0) {
                    const prevLast = groups[idx - 1].points[groups[idx - 1].points.length - 1];
                    const prevCss = getCssPos(prevLast.x, prevLast.y, match.map);
                    const currFirst = group.points[0];
                    const currCss = getCssPos(currFirst.x, currFirst.y, match.map);
                    const colorIndex = resultSegments.length;
                    resultMarkers.push({ x: prevCss.x, y: prevCss.y, colorIndex, type: 'death' });
                    resultMarkers.push({ x: currCss.x, y: currCss.y, colorIndex, type: 'respawn' });
                }
                pushPathFromPoints(group.points);
            });

            return {
                segments: resultSegments,
                jumpMarkers: resultMarkers,
                displayPath: groups.flatMap((group) => group.points),
            };
        }

        const filtered = filterGroundPath(validPath);
        if (filtered.length === 0) return emptyResult;

        {
            // 구 데이터: segment(s) 없으면 거리 기반 폴백
            const JUMP_THRESHOLD = 8.0;
            let prevRaw = filtered[0];
            let prevCss = getCssPos(prevRaw.x, prevRaw.y, match.map);
            let currentPathString = `M ${prevCss.x} ${prevCss.y}`;

            for (let i = 1; i < filtered.length; i++) {
                const currRaw = filtered[i];
                const currCss = getCssPos(currRaw.x, currRaw.y, match.map);
                const dist = Math.hypot(currCss.x - prevCss.x, currCss.y - prevCss.y);

                if (dist > JUMP_THRESHOLD) {
                    resultSegments.push(currentPathString);
                    const nextColorIndex = resultSegments.length;
                    resultMarkers.push({ x: prevCss.x, y: prevCss.y, colorIndex: nextColorIndex, type: 'death' });
                    resultMarkers.push({ x: currCss.x, y: currCss.y, colorIndex: nextColorIndex, type: 'respawn' });
                    currentPathString = `M ${currCss.x} ${currCss.y}`;
                } else {
                    currentPathString += ` L ${currCss.x} ${currCss.y}`;
                }
                prevRaw = currRaw;
                prevCss = currCss;
            }
            resultSegments.push(currentPathString);
        }

        return { segments: resultSegments, jumpMarkers: resultMarkers, displayPath: filtered };
    }, [validPath, match.map]);

    return (
        <div
            ref={containerRef} // 🌟 전체 화면 전환을 위한 타겟
            style={{ 
                flex: '0 0 auto', 
                height: '100%', 
                width: '100%', 
                position: 'relative', 
                borderRight: isFullscreen ? 'none' : '1px solid #333', // 전체화면 시 테두리 제거
                background: '#000', 
                overflow: 'hidden', 
                cursor: scale > 1 ? (isDragging.current ? 'grabbing' : 'grab') : 'default', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
            }}
            onMouseDown={handleMouseDown} 
            onMouseMove={handleMouseMove} 
            onMouseUp={handleMouseUp} 
            onMouseLeave={handleMouseUp}
        >
            <div style={{ position: 'absolute', top: '15px', right: '15px', display: 'flex', flexDirection: 'column', gap: '5px', zIndex: 100 }}>
                <button 
                    onClick={toggleFullscreen} // 🌟 네이티브 전체화면 함수 호출
                    className="apex-btn zoom-btn"
                    title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                    {isFullscreen ? <FaCompress size={12} /> : <FaExpand size={12} />}
                </button>
            </div>

            <div style={{ 
                width: '100%', height: '100%', position: 'relative', transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, transformOrigin: 'center', transition: isDragging.current ? 'none' : 'transform 0.2s ease-out'
            }}>
                {mapConfig?.img ?
                    <img 
                        src={`https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/${mapConfig.img}`} 
                        alt="map" 
                        style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.6, pointerEvents: 'none', userSelect: 'none' }} 
                        onDragStart={(e) => e.preventDefault()} 
                    /> 
                    : <div style={{ color: '#666', textAlign: 'center', paddingTop: '45%', fontSize: '12px' }}>Map image not available</div>
                }

                <svg viewBox="0 0 100 100" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                    {/* 경로 그리기 */}
                    {segments?.map((segment, index) => {
                        const color = PATH_COLORS[index % PATH_COLORS.length];
                        const baseWidth = 1.0 / scale;
                        const outlineWidth = baseWidth * 2.5; 

                        return (
                            <g key={`path-group-${index}`}>
                                {/* 테두리 (검은색 반투명) */}
                                <path d={segment} fill="none" stroke="#000" strokeWidth={outlineWidth} strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.6" vectorEffect="non-scaling-stroke" />
                                {/* 본체 (색상) */}
                                <path d={segment} fill="none" stroke={color} strokeWidth={baseWidth} strokeLinecap="round" strokeLinejoin="round" strokeOpacity="1" vectorEffect="non-scaling-stroke" />
                            </g>
                        );
                    })}

                    {/* 점프 마커 */}
                    {jumpMarkers?.map((marker, i) => (
                        <circle 
                            key={`marker-${i}`}
                            cx={marker.x} cy={marker.y} r={1.2 / scale}
                            fill={PATH_COLORS[marker.colorIndex % PATH_COLORS.length]} 
                            stroke="#ffffffff" strokeWidth={0.3 / scale}
                        >
                            <title>{marker.type === 'death' ? 'Teleport Start / Death' : 'Teleport End / Respawn'}</title>
                        </circle>
                    ))}

                    {/* 시작(초록) & 끝(빨강) 점 */}
                    {displayPath.length > 0 && (() => {
                        const start = displayPath[0];
                        const end = displayPath[displayPath.length - 1];
                        const sCss = getCssPos(start.x, start.y, match.map);
                        const eCss = getCssPos(end.x, end.y, match.map);
                        const dotSize = 1 / scale;

                        return (
                            <>
                                <circle cx={sCss.x} cy={sCss.y} r={dotSize} fill="#2ecc71" stroke="#fff" strokeWidth={0.3/scale} />
                                <circle cx={eCss.x} cy={eCss.y} r={dotSize} fill="#e74c3c" stroke="#fff" strokeWidth={0.3/scale} />
                            </>
                        );
                    })()}
                </svg>
            </div>

            {/* 줌 컨트롤 UI */}
            <div style={{ position: 'absolute', top: '15px', left: '15px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <button onClick={() => handleZoom('in')} className="apex-btn zoom-btn" title="Zoom In">+</button>
                <button onClick={() => handleZoom('out')} className="apex-btn zoom-btn" title="Zoom Out">-</button>
            </div>

            <div style={{ position: 'absolute', bottom: '10px', left: '10px', color: 'rgba(255,255,255,0.7)', fontSize: '10px', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px', pointerEvents: 'none' }}>
                x{scale.toFixed(1)}
            </div>
        </div>
    );
};

export default MapVisualizer;