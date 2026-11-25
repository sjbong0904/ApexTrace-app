import React, { useState, useRef, useMemo, useEffect, useId } from 'react';
import { getCssPos, getMapConfig } from '../utils/helpers';
import { buildRingCircles, DEFAULT_RING_UNITS_PER_METER } from '../utils/ringOverlay';
import { buildMapReplay, getReplayFrame, formatReplayClock } from '../utils/mapReplay';
import type { ReplayPoint } from '../utils/mapReplay';
import { groundPathPoints } from '../utils/groundPath';
import type { Match } from '../types';
import { FaExpand, FaCompress, FaRegCircle, FaPlay, FaPause, FaHistory, FaCrown, FaSync } from 'react-icons/fa';
import { PREMIUM_STATE_EVENT, consumeFreeReplay, getFreeReplayState, openPremiumDialog, type FreeReplayState } from '../utils/premium';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import { REPLAY_PLAYED_EVENT } from '../utils/demoMode';

const PATH_COLORS = [
    "#4cd137", "#e67e22", "#f1c40f", "#00d2be", "#9b59b6", 
    "#1014ebff", "#974515ff", "#09b665ff", "#e74c3c"
];
/** viewBox units; fullscreen map is much larger on screen so dots use a smaller base radius */
const FULLSCREEN_MARKER_SCALE = 0.5;
const HOVER_LEAVE_DELAY_MS = 40;

type PathPoint = Match["path"][number];

interface JumpMarker {
    x: number;
    y: number;
    colorIndex: number;
    type: 'death' | 'respawn';
    pairIndex: number;
}

interface MapDotProps {
    cx: number;
    cy: number;
    fill: string;
    dotSize: number;
    dotStroke: number;
    isHovered: boolean;
    onEnter: () => void;
    onLeave: () => void;
}

const MapDot: React.FC<MapDotProps> = ({
    cx,
    cy,
    fill,
    dotSize,
    dotStroke,
    isHovered,
    onEnter,
    onLeave,
}) => {
    const r = isHovered ? dotSize * 1.35 : dotSize;
    const hitR = Math.max(dotSize * 2.5, 0.6);

    return (
        <g
            pointerEvents="all"
            style={{ cursor: 'pointer' }}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
        >
            <circle cx={cx} cy={cy} r={hitR} fill="transparent" />
            <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={fill}
                stroke="#fff"
                strokeWidth={isHovered ? dotStroke * 1.6 : dotStroke}
            />
        </g>
    );
};

interface MapVisualizerProps {
    match: Match;
    /** Premium: replay player (moving marker + live rings) instead of the static map. */
    isPremium?: boolean;
    /** Combat log / loadout row clicked: jump the replay to `t` (epoch ms). `n` changes per click. */
    seekRequest?: { t: number; n: number } | null;
}

/** Playback speeds cycled by the square speed button (a match is ~20 min at 1x). */
const REPLAY_SPEEDS = [1, 2, 4, 8, 16, 32];
/** Replay redraw cadence while playing (~30fps). */
const REPLAY_COMMIT_INTERVAL_MS = 33;

/** Map view cycle: path only → path + static rings → replay player (Premium). */
type MapMode = 'none' | 'static' | 'replay';
const MAP_MODE_ORDER: MapMode[] = ['none', 'static', 'replay'];
const MAP_MODE_LABEL: Record<MapMode, string> = {
    none: 'Rings: off',
    static: 'Rings: static',
    replay: 'Rings: replay',
};

const MapVisualizer: React.FC<MapVisualizerProps> = ({ match, isPremium = false, seekRequest = null }) => {
    const { isDark } = useTheme();
    const { t } = useTranslation();
    /** The 4096² map image takes a moment; show a loading state instead of a black box. Keyed by URL. */
    const [loadedMapSrc, setLoadedMapSrc] = useState<string | null>(null);
    const [scale, setScale] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [hoveredJumpPair, setHoveredJumpPair] = useState<number | null>(null);
    const [hoveredEndpoint, setHoveredEndpoint] = useState<'start' | 'end' | null>(null);
    /** null = default for this tier (Premium → replay, Free → static rings). */
    const [mapModePick, setMapModePick] = useState<MapMode | null>(null);
    /** Unique per instance — several expanded maps can be on screen at once. */
    const svgIdBase = useId().replace(/[^a-zA-Z0-9_-]/g, '');
    /** Map images are square (4096²) and fill viewBox 0–100 exactly — clip rings to it. */
    const mapClipId = `map-clip-${svgIdBase}`;
    const jumpHoverClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const handleFullscreenChange = () => {
            const isCurrentlyFullscreen = !!document.fullscreenElement;
            setIsFullscreen(isCurrentlyFullscreen);

            if (!isCurrentlyFullscreen) {
                setScale(1);
                setPos({ x: 0, y: 0 });
            }
        };

        // Wheel zoom is fullscreen-only so the match panel still scrolls normally.
        const handleWheel = (e: WheelEvent) => {
            if (!document.fullscreenElement) return;

            e.preventDefault();

            const zoomStep = 0.5;
            const delta = e.deltaY > 0 ? -zoomStep : zoomStep;

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

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            const fsEl = document.fullscreenElement;
            if (!fsEl || fsEl !== containerRef.current) return;
            e.preventDefault();
            void document.exitFullscreen?.();
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('keydown', handleKeyDown);
        
        return () => {
            if (container) {
                container.removeEventListener('wheel', handleWheel);
            }
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const toggleFullscreen = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!document.fullscreenElement) {
            try {
                if (containerRef.current?.requestFullscreen) {
                    await containerRef.current.requestFullscreen();
                }
            } catch (err) {
                console.error(`Error attempting to enable fullscreen: ${err}`);
            }
        } else {
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

    const enterJumpPair = (pairIndex: number) => {
        if (jumpHoverClearTimer.current) {
            clearTimeout(jumpHoverClearTimer.current);
            jumpHoverClearTimer.current = null;
        }
        setHoveredJumpPair(pairIndex);
    };

    const leaveJumpPair = (pairIndex: number) => {
        jumpHoverClearTimer.current = setTimeout(() => {
            setHoveredJumpPair((prev) => (prev === pairIndex ? null : prev));
            jumpHoverClearTimer.current = null;
        }, HOVER_LEAVE_DELAY_MS);
    };

    useEffect(() => {
        return () => {
            if (jumpHoverClearTimer.current) clearTimeout(jumpHoverClearTimer.current);
        };
    }, []);

    const matchTimeMs = match.startTime ?? match.endTime ?? null;

    const mapConfig = useMemo(() => {
        const bg = typeof window !== 'undefined'
            ? (window.overwolf?.windows?.getMainWindow() as { SEASONS?: import('../utils/match').Season[] } | undefined)
            : undefined;
        return getMapConfig(match.map, matchTimeMs, bg?.SEASONS);
    }, [match.map, matchTimeMs]);

    /** Static ring overlay (Free): every ring the zone closed onto, in map viewBox units. */
    const ringCircles = useMemo(() => {
        const unitsPerMeter = match.ringUnitsPerMeter ?? DEFAULT_RING_UNITS_PER_METER;
        return buildRingCircles(match.ringRounds, unitsPerMeter).map((c) => {
            const center = getCssPos(c.x, c.y, match.map, matchTimeMs);
            // Same transform as the path, so radius stays consistent with any map scale/offset.
            const edge = getCssPos(c.x + c.r, c.y, match.map, matchTimeMs);
            return { ...c, cx: center.x, cy: center.y, vr: Math.abs(edge.x - center.x) };
        });
    }, [match.ringRounds, match.ringUnitsPerMeter, match.map, matchTimeMs]);


    // ---- Premium replay -------------------------------------------------------------
    const replayData = useMemo(() => buildMapReplay(match), [match]);
    // Free: one replay per day (stays open for that match all day). Premium: unlimited.
    const matchKey = String(match.matchId ?? '');
    const [freeReplayState, setFreeReplayState] = useState<FreeReplayState>(() => getFreeReplayState(matchKey));
    useEffect(() => {
        const sync = () => setFreeReplayState(getFreeReplayState(matchKey));
        sync();
        window.addEventListener(PREMIUM_STATE_EVENT, sync);
        return () => window.removeEventListener(PREMIUM_STATE_EVENT, sync);
    }, [matchKey]);
    const replayAllowed = isPremium || freeReplayState === 'unlocked';
    const replay = replayAllowed ? replayData : null;
    const replayDuration = replay ? replay.endT - replay.startT : 0;
    /**
     * Playback starts at the first landed point, but the clock label uses match.startTime as 0:00
     * (same as CombatLog / LoadoutTimeline) so row times and the replay clock agree.
     * Falls back to 0 (landing = 0:00) when startTime is missing or after the landing point.
     */
    const replayClockLead = replay && match.startTime > 0 && match.startTime <= replay.startT
        ? replay.startT - match.startTime
        : 0;
    /** ms from replay start. Opens at the start point, ready to play. */
    const [replayOffset, setReplayOffset] = useState<number>(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speedIdx, setSpeedIdx] = useState(0);
    const replayOffsetRef = useRef(replayOffset);
    const clampedOffset = Math.min(Math.max(0, replayOffset), replayDuration);

    useEffect(() => {
        replayOffsetRef.current = clampedOffset;
    }, [clampedOffset]);

    useEffect(() => {
        if (!isPlaying || !replay) return;
        const speed = REPLAY_SPEEDS[speedIdx];
        let raf = 0;
        let last = performance.now();
        let lastCommit = 0;
        const tick = (now: number) => {
            const next = replayOffsetRef.current + (now - last) * speed;
            last = now;
            if (next >= replayDuration) {
                replayOffsetRef.current = replayDuration;
                setReplayOffset(replayDuration);
                setIsPlaying(false);
                return;
            }
            replayOffsetRef.current = next;
            // Re-render (and repaint the map SVG) at ~30fps, not every display frame —
            // the clock keeps advancing in the ref, so playback speed is unchanged.
            if (now - lastCommit >= REPLAY_COMMIT_INTERVAL_MS) {
                lastCommit = now;
                setReplayOffset(next);
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => {
            cancelAnimationFrame(raf);
            // Pause / speed change: show exactly where the clock stopped (may be up to one commit ahead).
            setReplayOffset(replayOffsetRef.current);
        };
    }, [isPlaying, speedIdx, replay, replayDuration]);

    useEffect(() => {
        if (isPlaying) window.dispatchEvent(new CustomEvent(REPLAY_PLAYED_EVENT));
    }, [isPlaying]);

    const togglePlay = () => {
        if (!replay) return;
        if (!isPlaying && clampedOffset >= replayDuration) {
            replayOffsetRef.current = 0;
            setReplayOffset(0);
        }
        setIsPlaying((p) => !p);
    };

    const cycleSpeed = () => setSpeedIdx((i) => (i + 1) % REPLAY_SPEEDS.length);

    // ---- Seek from combat log / loadout rows ----------------------------------------
    /** Free user clicked a row before spending today's replay: start there once they do. */
    const pendingSeekRef = useRef<number | null>(null);
    const [seekNudge, setSeekNudge] = useState(false);
    const offsetFor = (t: number) => {
        if (!replayData) return 0;
        return Math.min(Math.max(0, t - replayData.startT), replayData.endT - replayData.startT);
    };
    const lastSeekN = useRef<number | null>(null);
    useEffect(() => {
        if (!seekRequest || seekRequest.n === lastSeekN.current) return;
        lastSeekN.current = seekRequest.n;
        if (!replayData) return;
        if (replayAllowed) {
            setMapModePick('replay');
            setIsPlaying(false);
            const off = offsetFor(seekRequest.t);
            replayOffsetRef.current = off;
            setReplayOffset(off);
            return;
        }
        pendingSeekRef.current = seekRequest.t;
        setSeekNudge(true);
        const id = window.setTimeout(() => setSeekNudge(false), 1200);
        return () => window.clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- react to each new click only
    }, [seekRequest]);

    const seekReplay = (value: number) => {
        replayOffsetRef.current = value;
        setReplayOffset(value);
    };

    // Only modes that have something to show are in the cycle.
    const availableModes = MAP_MODE_ORDER.filter((mode) => (
        mode === 'none'
        || (mode === 'static' && ringCircles.length > 0)
        || (mode === 'replay' && !!replay)
    ));
    const defaultMode: MapMode = availableModes.includes('replay')
        ? 'replay'
        : availableModes.includes('static') ? 'static' : 'none';
    const mapMode: MapMode = mapModePick && availableModes.includes(mapModePick) ? mapModePick : defaultMode;
    const isReplayMode = mapMode === 'replay';

    const cycleMapMode = () => {
        const next = availableModes[(availableModes.indexOf(mapMode) + 1) % availableModes.length];
        if (next !== 'replay') setIsPlaying(false);
        setMapModePick(next);
    };

    const replayFrame = useMemo(
        () => (replay && isReplayMode ? getReplayFrame(replay, replay.startT + clampedOffset) : null),
        [replay, isReplayMode, clampedOffset],
    );

    const toCss = (x: number, y: number) => getCssPos(x, y, match.map, matchTimeMs);
    const ringToCss = (ring: { x: number; y: number; r: number }) => {
        const c = toCss(ring.x, ring.y);
        const e = toCss(ring.x + ring.r, ring.y);
        return { cx: c.x, cy: c.y, vr: Math.abs(e.x - c.x) };
    };
    const trailToPath = (pts: ReplayPoint[]) => pts
        .map((pt, i) => {
            const c = toCss(pt.x, pt.y);
            return `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`;
        })
        .join(' ');

    const validPath = useMemo(() => {
        if (!match.path || !Array.isArray(match.path)) return [];
        return match.path.filter(pt => pt && typeof pt.x === 'number' && typeof pt.y === 'number');
    }, [match.path]);

    const { segments, jumpMarkers, displayPath } = useMemo(() => {
        const emptyResult = { segments: [] as string[], jumpMarkers: [] as JumpMarker[], displayPath: [] as PathPoint[] };
        if (validPath.length === 0) return emptyResult;

        const filterGroundPath = (points: PathPoint[]) => groundPathPoints(points);

        const usesLifeSegments = validPath.some(
            (pt) => pt.s !== undefined && pt.s !== null
        );

        const resultSegments: string[] = [];
        const resultMarkers: JumpMarker[] = [];

        const pushPathFromPoints = (points: PathPoint[]) => {
            if (points.length === 0) return;
            const startCss = getCssPos(points[0].x, points[0].y, match.map, matchTimeMs);
            let pathStr = `M ${startCss.x} ${startCss.y}`;
            for (let i = 1; i < points.length; i++) {
                const css = getCssPos(points[i].x, points[i].y, match.map, matchTimeMs);
                pathStr += ` L ${css.x} ${css.y}`;
            }
            resultSegments.push(pathStr);
        };

        if (usesLifeSegments) {
            const segmentMap = new Map<number, PathPoint[]>();
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
                    const prevCss = getCssPos(prevLast.x, prevLast.y, match.map, matchTimeMs);
                    const currFirst = group.points[0];
                    const currCss = getCssPos(currFirst.x, currFirst.y, match.map, matchTimeMs);
                    const colorIndex = resultSegments.length;
                    const pairIndex = resultMarkers.length / 2;
                    resultMarkers.push({ x: prevCss.x, y: prevCss.y, colorIndex, type: 'death', pairIndex });
                    resultMarkers.push({ x: currCss.x, y: currCss.y, colorIndex, type: 'respawn', pairIndex });
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
            let prevCss = getCssPos(prevRaw.x, prevRaw.y, match.map, matchTimeMs);
            let currentPathString = `M ${prevCss.x} ${prevCss.y}`;

            for (let i = 1; i < filtered.length; i++) {
                const currRaw = filtered[i];
                const currCss = getCssPos(currRaw.x, currRaw.y, match.map, matchTimeMs);
                const dist = Math.hypot(currCss.x - prevCss.x, currCss.y - prevCss.y);

                if (dist > JUMP_THRESHOLD) {
                    resultSegments.push(currentPathString);
                    const nextColorIndex = resultSegments.length;
                    const pairIndex = resultMarkers.length / 2;
                    resultMarkers.push({ x: prevCss.x, y: prevCss.y, colorIndex: nextColorIndex, type: 'death', pairIndex });
                    resultMarkers.push({ x: currCss.x, y: currCss.y, colorIndex: nextColorIndex, type: 'respawn', pairIndex });
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
    }, [validPath, match.map, matchTimeMs]);

    /** Original map from Supabase, then reused from the image cache. */
    const mapImgSrc = mapConfig?.img ? `/images/${mapConfig.img}` : null;
    const isMapLoading = mapImgSrc !== null && loadedMapSrc !== mapImgSrc;

    return (
        <div
            ref={containerRef}
            style={{ 
                flex: '0 0 auto', 
                height: '100%', 
                width: '100%', 
                position: 'relative', 
                borderRight: isFullscreen ? 'none' : '1px solid var(--color-border)',
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
                    onClick={toggleFullscreen}
                    className="apex-btn zoom-btn"
                    title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                    {isFullscreen ? <FaCompress size={12} /> : <FaExpand size={12} />}
                </button>
                {availableModes.length > 1 && (
                    <button
                        onClick={(e) => { e.stopPropagation(); cycleMapMode(); }}
                        className="apex-btn zoom-btn"
                        title={MAP_MODE_LABEL[mapMode]}
                        aria-label={MAP_MODE_LABEL[mapMode]}
                    >
                        {mapMode === 'none' && <FaRegCircle size={12} style={{ opacity: 0.35 }} />}
                        {mapMode === 'static' && <FaRegCircle size={12} />}
                        {mapMode === 'replay' && <FaHistory size={12} />}
                    </button>
                )}
            </div>

            <div style={{ 
                width: '100%', height: '100%', position: 'relative', transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, transformOrigin: 'center', transition: isDragging.current ? 'none' : 'transform 0.2s ease-out'
            }}>
                {mapConfig?.img ?
                    <img
                        src={mapImgSrc!}
                        alt="map"
                        decoding="async"
                        onLoad={() => setLoadedMapSrc(mapImgSrc)}
                        onError={() => setLoadedMapSrc(mapImgSrc)}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            opacity: isDark ? 0.6 : 0.92,
                            filter: isDark ? undefined : 'brightness(1.12) contrast(1.04)',
                            pointerEvents: 'none',
                            userSelect: 'none',
                        }} 
                        onDragStart={(e) => e.preventDefault()} 
                    /> 
                    : <div style={{ color: 'var(--color-text-faint)', textAlign: 'center', paddingTop: '45%', fontSize: '12px' }}>Map image not available</div>
                }

                {/* While the replay plays, the overlay repaints ~30×/s: keep it on its own layer so the
                    4096² map image under it is not re-rasterized every frame. */}
                <svg viewBox="0 0 100 100" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', willChange: isPlaying ? 'transform' : undefined }}>
                    <defs>
                        <clipPath id={mapClipId} clipPathUnits="userSpaceOnUse">
                            <rect x="0" y="0" width="100" height="100" />
                        </clipPath>
                    </defs>
                    {(() => {
                        const markerBase = isFullscreen ? FULLSCREEN_MARKER_SCALE : 1;
                        const dotSize = markerBase / scale;
                        const dotStroke = (0.3 * markerBase) / scale;
                        if (replayFrame) {
                            const frame = replayFrame;
                            // Ring rules:
                            //  1. zone about to close / closing (current zone) → no outline; the storm tint marks its edge
                            //  2. next safe zone → solid (from its reveal; stays through the short wait after the
                            //     zone closes onto it, until the following reveal replaces it — like in game)
                            //  3. safe zone after that → dashed (shown from that same reveal)
                            // Rings are keyed by round, so a ring moving from 3 → 2 restyles in place (no gap).
                            const ringLayers = [
                                frame.afterNextRing ? { key: `round-${frame.afterNextRing.round}`, ring: frame.afterNextRing, dashed: true } : null,
                                frame.nextRing ? { key: `round-${frame.nextRing.round}`, ring: frame.nextRing, dashed: false } : null,
                            ].filter((v): v is NonNullable<typeof v> => v !== null);
                            const firstPoint = frame.trails[0]?.[0];
                            const lifeColor = (i: number) => PATH_COLORS[i % PATH_COLORS.length];
                            const baseWidth = 1.0 / scale;
                            return (
                                <g className="map-replay">
                                    {/* Storm (replay only): translucent orange outside the current zone. Map area only (0–100).
                                        One even-odd path (map square with the zone cut out) — an SVG mask here forced an
                                        offscreen mask pass on every replay frame. */}
                                    {frame.activeRing && (() => {
                                        const c = ringToCss(frame.activeRing);
                                        return (
                                            <path
                                                d={`M0 0H100V100H0Z M${c.cx - c.vr} ${c.cy}a${c.vr} ${c.vr} 0 1 0 ${c.vr * 2} 0a${c.vr} ${c.vr} 0 1 0 ${-c.vr * 2} 0Z`}
                                                fill="#ff7a1a" fillOpacity={0.28} fillRule="evenodd"
                                                clipPath={`url(#${mapClipId})`}
                                            />
                                        );
                                    })()}
                                    {/* Premium: rings as they were at time t — current zone (solid) + announced next (dashed). */}
                                    <g clipPath={`url(#${mapClipId})`}>
                                    {ringLayers.map(({ key, ring, dashed }) => {
                                        const c = ringToCss(ring);
                                        return (
                                            <g key={`replay-ring-${key}`}>
                                                <circle cx={c.cx} cy={c.cy} r={c.vr} fill="none" stroke="#000" strokeOpacity={0.35} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
                                                <circle
                                                    cx={c.cx} cy={c.cy} r={c.vr}
                                                    fill="none" stroke="#fff" strokeOpacity={dashed ? 0.7 : 0.9}
                                                    strokeWidth={dashed ? 1.1 : 1.5}
                                                    strokeDasharray={dashed ? '5 4' : undefined}
                                                    vectorEffect="non-scaling-stroke"
                                                />
                                            </g>
                                        );
                                    })}
                                    </g>

                                    {frame.trails.map((trail, i) => trail.length > 1 && (
                                        <g key={`replay-trail-${i}`}>
                                            <path d={trailToPath(trail)} fill="none" stroke="#000" strokeWidth={baseWidth * 2.5} strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.6" vectorEffect="non-scaling-stroke" />
                                            <path d={trailToPath(trail)} fill="none" stroke={lifeColor(i)} strokeWidth={baseWidth} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                                        </g>
                                    ))}

                                    {frame.jumps.map((jump, i) => {
                                        const from = toCss(jump.from.x, jump.from.y);
                                        const to = jump.to ? toCss(jump.to.x, jump.to.y) : null;
                                        return (
                                            <g key={`replay-jump-${i}`}>
                                                <circle cx={from.x} cy={from.y} r={dotSize} fill={lifeColor(i + 1)} stroke="#fff" strokeWidth={dotStroke} />
                                                {to && <circle cx={to.x} cy={to.y} r={dotSize} fill={lifeColor(i + 1)} stroke="#fff" strokeWidth={dotStroke} />}
                                            </g>
                                        );
                                    })}

                                    {firstPoint && (() => {
                                        const s = toCss(firstPoint.x, firstPoint.y);
                                        return <circle cx={s.x} cy={s.y} r={dotSize} fill="#2ecc71" stroke="#fff" strokeWidth={dotStroke} />;
                                    })()}

                                    {frame.marker && (() => {
                                        const m = toCss(frame.marker.x, frame.marker.y);
                                        const r = dotSize * 1.6;
                                        return frame.marker.dead ? (
                                            <g>
                                                <circle cx={m.x} cy={m.y} r={r} fill="#e74c3c" stroke="#fff" strokeWidth={dotStroke} />
                                                <path
                                                    d={`M ${m.x - r * 0.5} ${m.y - r * 0.5} L ${m.x + r * 0.5} ${m.y + r * 0.5} M ${m.x + r * 0.5} ${m.y - r * 0.5} L ${m.x - r * 0.5} ${m.y + r * 0.5}`}
                                                    stroke="#fff" strokeWidth={dotStroke * 1.2} strokeLinecap="round"
                                                />
                                            </g>
                                        ) : (
                                            // Live player dot: slightly smaller than the start/end markers (r = dotSize).
                                            <circle cx={m.x} cy={m.y} r={dotSize * 0.85} fill="#fff" stroke="#000" strokeOpacity={0.7} strokeWidth={dotStroke} />
                                        );
                                    })()}
                                </g>
                            );
                        }

                        return (
                    <>
                    {mapMode === 'static' && ringCircles.length > 0 && (
                        <g className="map-ring-overlay" clipPath={`url(#${mapClipId})`}>
                            {/* Static (Free): plain rings only — one uniform style, no color coding. */}
                            {ringCircles.map((ring) => (
                                <g key={`ring-${ring.kind}-${ring.round}`}>
                                    {/* thin dark halo so the line stays readable on bright map areas */}
                                    <circle
                                        cx={ring.cx} cy={ring.cy} r={ring.vr}
                                        fill="none" stroke="#000" strokeOpacity={0.35}
                                        strokeWidth={2.5}
                                        vectorEffect="non-scaling-stroke"
                                    />
                                    <circle
                                        cx={ring.cx} cy={ring.cy} r={ring.vr}
                                        fill="none" stroke="#fff" strokeOpacity={0.85}
                                        strokeWidth={1.25}
                                        vectorEffect="non-scaling-stroke"
                                    />
                                </g>
                            ))}
                        </g>
                    )}

                    {segments?.map((segment, index) => {
                        const color = PATH_COLORS[index % PATH_COLORS.length];
                        const baseWidth = 1.0 / scale;
                        const outlineWidth = baseWidth * 2.5; 

                        return (
                            <g key={`path-group-${index}`}>
                                <path d={segment} fill="none" stroke="#000" strokeWidth={outlineWidth} strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.6" vectorEffect="non-scaling-stroke" />
                                <path d={segment} fill="none" stroke={color} strokeWidth={baseWidth} strokeLinecap="round" strokeLinejoin="round" strokeOpacity="1" vectorEffect="non-scaling-stroke" />
                            </g>
                        );
                    })}

                    {jumpMarkers?.map((marker, i) => (
                        <MapDot
                            key={`marker-${i}`}
                            cx={marker.x}
                            cy={marker.y}
                            fill={PATH_COLORS[marker.colorIndex % PATH_COLORS.length]}
                            dotSize={dotSize}
                            dotStroke={dotStroke}
                            isHovered={hoveredJumpPair === marker.pairIndex}
                            onEnter={() => enterJumpPair(marker.pairIndex)}
                            onLeave={() => leaveJumpPair(marker.pairIndex)}
                        />
                    ))}

                    {displayPath.length > 0 && (() => {
                        const start = displayPath[0];
                        const end = displayPath[displayPath.length - 1];
                        const sCss = getCssPos(start.x, start.y, match.map, matchTimeMs);
                        const eCss = getCssPos(end.x, end.y, match.map, matchTimeMs);

                        return (
                            <>
                                <MapDot
                                    cx={sCss.x}
                                    cy={sCss.y}
                                    fill="#2ecc71"
                                    dotSize={dotSize}
                                    dotStroke={dotStroke}
                                    isHovered={hoveredEndpoint === 'start'}
                                    onEnter={() => setHoveredEndpoint('start')}
                                    onLeave={() => setHoveredEndpoint((prev) => (prev === 'start' ? null : prev))}
                                />
                                <MapDot
                                    cx={eCss.x}
                                    cy={eCss.y}
                                    fill="#e74c3c"
                                    dotSize={dotSize}
                                    dotStroke={dotStroke}
                                    isHovered={hoveredEndpoint === 'end'}
                                    onEnter={() => setHoveredEndpoint('end')}
                                    onLeave={() => setHoveredEndpoint((prev) => (prev === 'end' ? null : prev))}
                                />
                            </>
                        );
                    })()}
                    </>
                        );
                    })()}
                </svg>
            </div>

            <div style={{ position: 'absolute', top: '15px', left: '15px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <button onClick={() => handleZoom('in')} className="apex-btn zoom-btn" title="Zoom In">+</button>
                <button onClick={() => handleZoom('out')} className="apex-btn zoom-btn" title="Zoom Out">-</button>
            </div>

            <div style={{ position: 'absolute', bottom: '10px', left: '10px', color: 'rgba(255,255,255,0.7)', fontSize: '10px', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px', pointerEvents: 'none' }}>
                x{scale.toFixed(1)}
            </div>

            {isMapLoading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'rgba(255,255,255,0.75)', fontSize: '11px', background: 'var(--color-bg-deep)', pointerEvents: 'none', zIndex: 50 }}>
                    <FaSync className="spin-animation" size={16} />
                    {t('map.loading', { defaultValue: 'Loading map…' })}
                </div>
            )}

            {/* Free: one replay a day — offered in the replay bar's spot. */}
            {!replayAllowed && replayData && !isMapLoading && (
                <div
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                        position: 'absolute',
                        bottom: isFullscreen ? '20px' : '8px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '6px 8px 6px 6px',
                        background: 'rgba(0,0,0,0.72)',
                        border: seekNudge ? '1px solid var(--color-rank-first)' : '1px solid rgba(255,255,255,0.12)',
                        boxShadow: seekNudge ? '0 0 0 3px color-mix(in srgb, var(--color-rank-first) 35%, transparent)' : 'none',
                        transition: 'box-shadow 0.2s, border-color 0.2s',
                        borderRadius: '8px',
                        color: 'rgba(255,255,255,0.9)',
                        fontSize: '11px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        zIndex: 100,
                        maxWidth: 'calc(100% - 16px)',
                    }}
                >
                    {freeReplayState === 'available' ? (
                        <>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!consumeFreeReplay(matchKey)) return;
                                    setMapModePick('replay');
                                    if (pendingSeekRef.current != null) {
                                        const off = offsetFor(pendingSeekRef.current);
                                        pendingSeekRef.current = null;
                                        replayOffsetRef.current = off;
                                        setReplayOffset(off);
                                    }
                                    setIsPlaying(true);
                                }}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 10px', border: 'none', borderRadius: 6, background: 'var(--color-rank-first)', color: '#1a1408', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}
                            >
                                <FaPlay size={9} /> {t('map.replayFreeCta', { defaultValue: 'Watch replay' })}
                            </button>
                            <span style={{ color: 'rgba(255,255,255,0.75)' }}>
                                {t('map.replayFreeLeft', { defaultValue: '1 free replay left today' })}
                            </span>
                        </>
                    ) : (
                        <>
                            <span style={{ paddingLeft: 4, color: 'rgba(255,255,255,0.75)' }}>
                                {t('map.replayFreeUsed', { defaultValue: 'Today’s free replay is used — more tomorrow' })}
                            </span>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); openPremiumDialog('replay'); }}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 10px', border: '1px solid var(--color-rank-first)', borderRadius: 6, background: 'transparent', color: 'var(--color-rank-first)', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
                            >
                                <FaCrown size={10} /> {t('map.replayUnlimited', { defaultValue: 'Unlimited with Premium' })}
                            </button>
                        </>
                    )}
                </div>
            )}

            {replay && isReplayMode && (
                <div
                    className="map-replay-controls"
                    // Keep pan-drag (container mousedown) from hijacking the controls.
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                        position: 'absolute',
                        bottom: isFullscreen ? '20px' : '8px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: isFullscreen ? 'min(560px, calc(100% - 140px))' : 'min(440px, calc(100% - 110px))',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 8px',
                        background: 'rgba(0,0,0,0.6)',
                        borderRadius: '6px',
                        zIndex: 100,
                    }}
                >
                    <button
                        onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                        className="apex-btn zoom-btn"
                        title={isPlaying ? 'Pause' : 'Play'}
                        style={{ width: 26, height: 26, flex: '0 0 auto' }}
                    >
                        {isPlaying ? <FaPause size={10} /> : <FaPlay size={10} />}
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); cycleSpeed(); }}
                        className="apex-btn zoom-btn"
                        title="Playback speed"
                        style={{ width: 26, height: 26, flex: '0 0 auto', fontSize: '10px', fontVariantNumeric: 'tabular-nums' }}
                    >
                        {REPLAY_SPEEDS[speedIdx]}x
                    </button>
                    <input
                        type="range"
                        aria-label="Replay position"
                        min={0}
                        max={replayDuration}
                        step={250}
                        value={clampedOffset}
                        onChange={(e) => seekReplay(Number(e.target.value))}
                        style={{ flex: '1 1 auto', minWidth: 0, accentColor: '#fff', cursor: 'pointer' }}
                    />
                    <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '10px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flex: '0 0 auto' }}>
                        {formatReplayClock(replayClockLead + clampedOffset)} / {formatReplayClock(replayClockLead + replayDuration)}
                    </span>
                </div>
            )}
        </div>
    );
};

export default MapVisualizer;