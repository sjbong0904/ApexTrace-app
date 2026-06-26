import React, { useLayoutEffect, useRef, useState } from 'react';
import { ResponsiveContainer } from 'recharts';

interface ChartContainerProps {
    height?: number | string;
    minHeight?: number;
    className?: string;
    style?: React.CSSProperties;
    onSizeChange?: (size: { width: number; height: number }) => void;
    onMouseDown?: React.MouseEventHandler<HTMLDivElement>;
    children: React.ReactNode;
}

/** Renders Recharts only after the wrapper has measurable dimensions (avoids width/height -1 warnings). */
const ChartContainer: React.FC<ChartContainerProps> = ({
    height = '100%',
    minHeight = 1,
    className,
    style,
    onSizeChange,
    onMouseDown,
    children,
}) => {
    const wrapRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const onSizeChangeRef = useRef(onSizeChange);
    onSizeChangeRef.current = onSizeChange;

    useLayoutEffect(() => {
        const el = wrapRef.current;
        if (!el) return;

        const update = () => {
            const rect = el.getBoundingClientRect();
            const next = {
                width: Math.max(1, Math.floor(rect.width)),
                height: Math.max(minHeight, Math.floor(rect.height)),
            };
            setSize(next);
            onSizeChangeRef.current?.(next);
        };

        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, [minHeight]);

    const ready = size.width > 0 && size.height > 0;

    return (
        <div
            ref={wrapRef}
            className={className}
            onMouseDown={onMouseDown}
            style={{
                width: '100%',
                height,
                minHeight,
                minWidth: 1,
                position: 'relative',
                ...style,
            }}
        >
            {ready && (
                <ResponsiveContainer width={size.width} height={size.height}>
                    {children}
                </ResponsiveContainer>
            )}
        </div>
    );
};

export default ChartContainer;
