import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { getWeaponImageUrl, getWeaponSilhouetteScale } from '../utils/weaponTheme';

interface ProfileTagIconProps {
    imageId: string;
    imageType: 'legend' | 'weapon';
    color: string;
    fallback: ReactNode;
}

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

const LegendTagIcon = ({ src }: { src: string }) => {
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
    };

    return (
        <span aria-hidden style={frameStyle}>
            <img src={src} alt="" style={portraitStyle} />
        </span>
    );
};

const ProfileTagIcon = ({ imageId, imageType, color, fallback }: ProfileTagIconProps) => {
    const [failed, setFailed] = useState(false);
    const [ready, setReady] = useState(false);
    const src = imageType === 'weapon'
        ? getWeaponImageUrl(imageId)
        : `https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/${imageId}.png`;
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
        return <LegendTagIcon src={src} />;
    }

    return <WeaponTagIcon src={src} color={color} scale={scale} />;
};

export default ProfileTagIcon;
