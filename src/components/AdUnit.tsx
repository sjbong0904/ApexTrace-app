// src/components/AdUnit.tsx
import React, { useEffect, useRef } from 'react';

declare global {
    interface Window {
        OwAd: any;
    }
}

interface AdUnitProps {
    width: number;
    height: number;
    className?: string;
    style?: React.CSSProperties;
}

const AdUnit: React.FC<AdUnitProps> = ({ width, height, className, style }) => {
    const adContainerRef = useRef<HTMLDivElement>(null);
    const adInstance = useRef<any>(null);

    useEffect(() => {
        if (!adContainerRef.current || typeof window.OwAd === 'undefined') return;

        adInstance.current = new window.OwAd(adContainerRef.current, {
            size: { width, height }
        });

        adInstance.current.addEventListener('ow_internal_renderer_successfully_loaded', () => {
            console.log("✅ Ad Loaded");
        });
        adInstance.current.addEventListener('ow_ad_error', (error: any) => {
            console.warn("⚠️ Ad Error:", error);
        });

        return () => {
            if (adInstance.current) {
                adInstance.current.removeAd();
                adInstance.current = null;
            }
        };
    }, [width, height]);

    return (
        <div 
            className={className} 
            style={{ 
                width: `${width}px`, 
                height: `${height}px`,
                position: 'relative',
                background: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                ...style
            }}
        >
            <div ref={adContainerRef} style={{ width: '100%', height: '100%' }} />
            
            <div style={{ position: 'absolute', color: '#444', fontSize: '12px', zIndex: 0 }}>
                
            </div>
        </div>
    );
};

export default AdUnit;