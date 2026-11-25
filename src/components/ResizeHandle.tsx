import React from 'react';

type ResizeHandlesProps = {
    /** Keep right-edge handles clear of the ads rail (px from window right). */
    insetRight?: number;
};

const ResizeHandles = ({ insetRight = 0 }: ResizeHandlesProps) => {
    const onDrag = (edge: string) => {
        overwolf.windows.getCurrentWindow((result) => {
            if (result.success) {
                overwolf.windows.dragResize(result.window.id, edge as overwolf.windows.enums.WindowDragEdge);
            }
        });
    };

    // Below modals (10_000+) and banners; above normal content / ads rail (15).
    const handleStyle: React.CSSProperties = {
        position: 'absolute',
        zIndex: 40,
    };

    const thickness = '6px';
    const right = insetRight;

    return (
        <>
            <div
                style={{ ...handleStyle, top: 0, left: 0, right, height: thickness, cursor: 'n-resize' }}
                onMouseDown={() => onDrag('Top')}
            />
            <div
                style={{ ...handleStyle, bottom: 0, left: 0, right, height: thickness, cursor: 's-resize' }}
                onMouseDown={() => onDrag('Bottom')}
            />
            <div
                style={{ ...handleStyle, top: 0, left: 0, width: thickness, height: '100%', cursor: 'w-resize' }}
                onMouseDown={() => onDrag('Left')}
            />
            <div
                style={{ ...handleStyle, top: 0, right, width: thickness, height: '100%', cursor: 'e-resize' }}
                onMouseDown={() => onDrag('Right')}
            />

            <div
                style={{ ...handleStyle, top: 0, left: 0, width: '12px', height: '12px', cursor: 'nw-resize', zIndex: 41 }}
                onMouseDown={() => onDrag('TopLeft')}
            />
            <div
                style={{ ...handleStyle, top: 0, right, width: '12px', height: '12px', cursor: 'ne-resize', zIndex: 41 }}
                onMouseDown={() => onDrag('TopRight')}
            />
            <div
                style={{ ...handleStyle, bottom: 0, left: 0, width: '12px', height: '12px', cursor: 'sw-resize', zIndex: 41 }}
                onMouseDown={() => onDrag('BottomLeft')}
            />
            <div
                style={{ ...handleStyle, bottom: 0, right, width: '12px', height: '12px', cursor: 'se-resize', zIndex: 41 }}
                onMouseDown={() => onDrag('BottomRight')}
            />
        </>
    );
};

export default ResizeHandles;
