//ResizeHandle.tsx
import React from 'react';

const ResizeHandles = () => {
    const onDrag = (edge: string) => {
        overwolf.windows.getCurrentWindow((result) => {
            if (result.success) {
                overwolf.windows.dragResize(result.window.id, edge as any);
            }
        });
    };

    const handleStyle: React.CSSProperties = {
        position: 'absolute',
        zIndex: 99999,
    };

    const thickness = '6px'; // 잡을 수 있는 영역 두께

    return (
        <>
            {/* 1. 상하좌우 (Edges) */}
            {/* Top */}
            <div 
                style={{ ...handleStyle, top: 0, left: 0, width: '100%', height: thickness, cursor: 'n-resize' }} 
                onMouseDown={() => onDrag('Top')} 
            />
            {/* Bottom */}
            <div 
                style={{ ...handleStyle, bottom: 0, left: 0, width: '100%', height: thickness, cursor: 's-resize' }} 
                onMouseDown={() => onDrag('Bottom')} 
            />
            {/* Left */}
            <div 
                style={{ ...handleStyle, top: 0, left: 0, width: thickness, height: '100%', cursor: 'w-resize' }} 
                onMouseDown={() => onDrag('Left')} 
            />
            {/* Right */}
            <div 
                style={{ ...handleStyle, top: 0, right: 0, width: thickness, height: '100%', cursor: 'e-resize' }} 
                onMouseDown={() => onDrag('Right')} 
            />

            {/* 2. 모서리 (Corners) */}
            {/* Top-Left */}
            <div 
                style={{ ...handleStyle, top: 0, left: 0, width: '12px', height: '12px', cursor: 'nw-resize', zIndex: 100000 }} 
                onMouseDown={() => onDrag('TopLeft')} 
            />
            {/* Top-Right */}
            <div 
                style={{ ...handleStyle, top: 0, right: 0, width: '12px', height: '12px', cursor: 'ne-resize', zIndex: 100000 }} 
                onMouseDown={() => onDrag('TopRight')} 
            />
            {/* Bottom-Left */}
            <div 
                style={{ ...handleStyle, bottom: 0, left: 0, width: '12px', height: '12px', cursor: 'sw-resize', zIndex: 100000 }} 
                onMouseDown={() => onDrag('BottomLeft')} 
            />
            {/* Bottom-Right */}
            <div 
                style={{ ...handleStyle, bottom: 0, right: 0, width: '12px', height: '12px', cursor: 'se-resize', zIndex: 100000 }} 
                onMouseDown={() => onDrag('BottomRight')} 
            />
        </>
    );
};

export default ResizeHandles;