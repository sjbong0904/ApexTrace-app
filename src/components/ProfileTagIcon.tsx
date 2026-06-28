import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { getWeaponSilhouetteScale, PROFILE_IMAGE_BASE } from '../utils/weaponTheme';

interface ProfileTagIconProps {
    imageId: string;
    imageType: 'legend' | 'weapon';
    color: string;
    fallback: ReactNode;
}

const parseHexLuminance = (color: string): number => {
    const hex = color.replace('#', '').trim();
    if (hex.length !== 6 && hex.length !== 3) return 0.5;
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    const r = parseInt(full.slice(0, 2), 16) / 255;
    const g = parseInt(full.slice(2, 4), 16) / 255;
    const b = parseInt(full.slice(4, 6), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const isLightTagColor = (color: string): boolean => {
    const normalized = color.trim().toLowerCase();
    return normalized === '#fff' || normalized === '#ffffff' || parseHexLuminance(normalized) > 0.72;
};

const WeaponTagIcon = ({ src, color, scale }: { src: string; color: string; scale: number }) => (
    <span
        aria-hidden
        style={{
            display: 'inline-block',
            width: 20,
            height: 14,
            flexShrink: 0,
            backgroundColor: color,
            WebkitMaskImage: `url("${src}")`,
            WebkitMaskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskImage: `url("${src}")`,
            maskSize: 'contain',
            maskRepeat: 'no-repeat',
            maskPosition: 'center',
            transform: scale !== 1 ? `scale(${scale})` : undefined,
            transformOrigin: 'center',
        }}
    />
);

const LegendTagIcon = ({ src, color }: { src: string; color: string }) => {
    const frameStyle: CSSProperties = {
        position: 'relative',
        display: 'inline-block',
        width: 18,
        height: 16,
        flexShrink: 0,
        overflow: 'hidden',
        borderRadius: '3px',
    };

    const portraitStyle: CSSProperties = {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: 'top center',
        display: 'block',
        filter: isLightTagColor(color)
            ? 'grayscale(1) contrast(1.35) brightness(1.2)'
            : 'grayscale(1) contrast(1.3) brightness(0.92)',
    };

    if (isLightTagColor(color)) {
        return (
            <span aria-hidden style={frameStyle}>
                <img src={src} alt="" style={portraitStyle} />
            </span>
        );
    }

    return (
        <span aria-hidden style={frameStyle}>
            <img src={src} alt="" style={portraitStyle} />
            <span
                style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: color,
                    mixBlendMode: 'color',
                    pointerEvents: 'none',
                }}
            />
        </span>
    );
};

const ProfileTagIcon = ({ imageId, imageType, color, fallback }: ProfileTagIconProps) => {
    const [failed, setFailed] = useState(false);
    const [ready, setReady] = useState(false);
    const src = `${PROFILE_IMAGE_BASE}/${imageId}.png`;
    const scale = imageType === 'weapon' ? getWeaponSilhouetteScale(imageId) : 1;
    const placeholderWidth = imageType === 'weapon' ? 20 : 18;
    const placeholderHeight = imageType === 'weapon' ? 14 : 16;

    useEffect(() => {
        let cancelled = false;
        setFailed(false);
        setReady(false);
        const img = new Image();
        img.onload = () => {
            if (!cancelled) setReady(true);
        };
        img.onerror = () => {
            if (!cancelled) setFailed(true);
        };
        img.src = src;
        return () => {
            cancelled = true;
        };
    }, [src]);

    if (failed) {
        return <>{fallback}</>;
    }

    if (!ready) {
        return <span style={{ display: 'inline-block', width: placeholderWidth, height: placeholderHeight, flexShrink: 0 }} />;
    }

    if (imageType === 'legend') {
        return <LegendTagIcon src={src} color={color} />;
    }

    return <WeaponTagIcon src={src} color={color} scale={scale} />;
};

export default ProfileTagIcon;
