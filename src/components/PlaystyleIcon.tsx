import { useEffect, useState } from 'react';
import type { PlaystyleKey } from '../utils/playstyle';

type IconPaths = Record<PlaystyleKey, readonly string[]>;

/** Loaded once on first use, so the ~50 KB of path data stays out of the startup bundle. */
let pathsPromise: Promise<IconPaths> | null = null;
let loadedPaths: IconPaths | null = null;
const loadPaths = () => {
    pathsPromise ??= import('../assets/playstyleIcons').then((m) => {
        loadedPaths = m.PLAYSTYLE_ICON_PATHS;
        return loadedPaths;
    });
    return pathsPromise;
};

/** Decorative watermark for the playstyle card. Renders nothing until the icon data has loaded. */
const PlaystyleIcon = ({ playstyle, className }: { playstyle: PlaystyleKey; className?: string }) => {
    const [paths, setPaths] = useState<IconPaths | null>(loadedPaths);

    useEffect(() => {
        if (paths) return;
        let alive = true;
        loadPaths()
            .then((p) => { if (alive) setPaths(p); })
            .catch(() => { /* decorative only */ });
        return () => { alive = false; };
    }, [paths]);

    const d = paths?.[playstyle];
    if (!d) return null;
    return (
        <svg className={className} viewBox="0 0 512 512" fill="currentColor" aria-hidden="true" focusable="false">
            {d.map((p, i) => <path key={i} d={p} />)}
        </svg>
    );
};

export default PlaystyleIcon;
