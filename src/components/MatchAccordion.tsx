import { useEffect, useRef, useState } from 'react';
import type { ReactNode, TransitionEvent } from 'react';

type Phase = 'closed' | 'opening' | 'open' | 'closing';

/** Slightly longer than the 0.4s `.match-accordion` transition, in case `transitionend` never fires. */
const TRANSITION_FALLBACK_MS = 550;

interface MatchAccordionProps {
    open: boolean;
    /** Called once the open animation has finished (not on first mount when already open). */
    onOpened?: (el: HTMLDivElement) => void;
    /**
     * `settled` is true only once the panel is fully open, so heavy content (the map image)
     * mounts after the height animation instead of during it.
     */
    children: (settled: boolean) => ReactNode;
}

/**
 * Match row detail panel. Collapsed rows mount nothing, and the body stays mounted only while
 * it is open or animating closed — the list no longer keeps every row's detail tree alive.
 */
const MatchAccordion = ({ open, onOpened, children }: MatchAccordionProps) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const [phase, setPhase] = useState<Phase>(open ? 'open' : 'closed');

    useEffect(() => {
        setPhase((prev) => {
            if (open) return prev === 'open' ? prev : 'opening';
            return prev === 'closed' ? prev : 'closing';
        });
    }, [open]);

    /** Finish the running animation (event handler / fallback timer only — never during render). */
    const settle = () => {
        if (phase === 'opening') {
            setPhase('open');
            if (rootRef.current) onOpened?.(rootRef.current);
        } else if (phase === 'closing') {
            setPhase('closed');
        }
    };

    useEffect(() => {
        if (phase !== 'opening' && phase !== 'closing') return;
        const id = window.setTimeout(settle, TRANSITION_FALLBACK_MS);
        return () => window.clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- re-arm per phase only
    }, [phase]);

    const handleTransitionEnd = (e: TransitionEvent<HTMLDivElement>) => {
        // Ignore transitions bubbling up from buttons / rows inside the panel.
        if (e.target !== e.currentTarget || e.propertyName !== 'grid-template-rows') return;
        settle();
    };

    return (
        <div
            ref={rootRef}
            className={`match-accordion ${open ? 'open' : ''}`}
            onTransitionEnd={handleTransitionEnd}
        >
            <div className="match-accordion-inner">
                {phase !== 'closed' && children(phase === 'open')}
            </div>
        </div>
    );
};

export default MatchAccordion;
