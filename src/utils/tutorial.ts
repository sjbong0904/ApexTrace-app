import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import i18n from '../i18n';

const TITLE_BAR_PX = 35;
const WINDOW_CONTROLS_RESERVE_PX = 145;

function beginWindowDrag() {
    if (typeof overwolf === 'undefined') return;
    overwolf.windows.getCurrentWindow((result) => {
        if (result.success && result.window) {
            overwolf.windows.dragMove(result.window.id);
        }
    });
}

function isChromeControl(target: EventTarget | null) {
    const el = target as HTMLElement | null;
    return Boolean(
        el?.closest?.('button, input, textarea, select, a, [contenteditable="true"], [data-no-window-drag]'),
    );
}

function isTitleDragZone(event: MouseEvent) {
    return event.clientY <= TITLE_BAR_PX && event.clientX < window.innerWidth - WINDOW_CONTROLS_RESERVE_PX;
}

/**
 * driver.js paints a full-viewport overlay (z-index ~10000) above the app chrome.
 * Capture-phase handlers + a fixed strip keep title-bar drag working without
 * treating that mousedown as “click overlay → destroy tour” (STORE-QA #4).
 */
const runTour = (steps: DriveStep[]) => {
    const swallowTitleDrag = (event: MouseEvent) => {
        if (event.button !== 0 || !isTitleDragZone(event) || isChromeControl(event.target)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.type === 'mousedown' || event.type === 'pointerdown') {
            beginWindowDrag();
        }
    };

    document.addEventListener('pointerdown', swallowTitleDrag, true);
    document.addEventListener('mousedown', swallowTitleDrag, true);
    document.addEventListener('click', swallowTitleDrag, true);

    const strip = document.createElement('div');
    strip.setAttribute('data-tutorial-drag-strip', '1');
    strip.setAttribute('aria-hidden', 'true');
    Object.assign(strip.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        right: `${WINDOW_CONTROLS_RESERVE_PX}px`,
        height: `${TITLE_BAR_PX}px`,
        zIndex: '100000002',
        cursor: 'grab',
    });
    strip.addEventListener('mousedown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        beginWindowDrag();
    });
    document.body.appendChild(strip);

    const titleBar = document.getElementById('apex-title-bar');
    titleBar?.setAttribute('data-tutorial-drag', '1');

    const cleanup = () => {
        document.removeEventListener('pointerdown', swallowTitleDrag, true);
        document.removeEventListener('mousedown', swallowTitleDrag, true);
        document.removeEventListener('click', swallowTitleDrag, true);
        strip.remove();
        titleBar?.removeAttribute('data-tutorial-drag');
    };

    const driverObj = driver({
        showProgress: true,
        animate: true,
        allowClose: true,
        overlayClickBehavior: 'close',
        onDestroyed: cleanup,
        steps,
    });

    driverObj.drive();
};

export const startTutorial = () => {
    runTour([
        {
            element: '#nav-dashboard',
            popover: {
                title: i18n.t('tutorial.dashboardTitle'),
                description: i18n.t('tutorial.dashboardDesc'),
                side: "right",
                align: 'start',
            },
        },
        {
            element: '#search-bar',
            popover: {
                title: i18n.t('tutorial.searchTitle'),
                description: i18n.t('tutorial.searchDesc'),
                side: 'bottom',
                align: 'center',
            },
        },
        {
            element: '#inline-profile',
            popover: {
                title: i18n.t('tutorial.profileTitle'),
                description: i18n.t('tutorial.profileDesc'),
                side: "bottom",
                align: 'start',
            },
        },
        {
            // Desktop: the Statistics switch in the Records header; web: the nav rail item.
            element: '#nav-statistics',
            popover: {
                title: i18n.t('tutorial.statisticsTitle'),
                description: i18n.t('tutorial.statisticsDesc'),
                side: "bottom",
                align: 'start',
            },
        },
        {
            element: '#nav-settings',
            popover: {
                title: i18n.t('tutorial.settingsTitle'),
                description: i18n.t('tutorial.settingsDesc'),
                side: "right",
                align: 'start',
            },
        },
    ]);
};

/** Demo profile tour: what each part of the Records screen will show once real matches land. */
export const startDemoTour = () => {
    const t = (key: string, defaultValue: string) => i18n.t(key, { defaultValue });
    const steps: DriveStep[] = [
        {
            element: '#demo-banner',
            popover: {
                title: t('demo.tour.introTitle', 'This is a sample profile'),
                description: t('demo.tour.introDesc', 'Real matches with made-up names, so you can see everything before your first game. Premium views are unlocked while you explore.'),
                side: 'bottom', align: 'start',
            },
        },
        {
            element: '#inline-profile',
            popover: {
                title: t('demo.tour.profileTitle', 'Profile and recent form'),
                description: t('demo.tour.profileDesc', 'Rank, level and your last 20 games at a glance. The placement trend shows how your session is going.'),
                side: 'bottom', align: 'start',
            },
        },
        {
            element: '[data-match-id]',
            popover: {
                title: t('demo.tour.matchTitle', 'Every match, recorded'),
                description: t('demo.tour.matchDesc', 'Click a match to open its map, combat log, loadout changes and squad stats. Try the replay on the map.'),
                side: 'top', align: 'start',
            },
        },
        {
            element: '#nav-statistics',
            popover: {
                title: t('demo.tour.statsTitle', 'Season statistics'),
                description: t('demo.tour.statsDesc', 'Maps, legends, weapons and teammates, built from all your recorded games.'),
                side: 'bottom', align: 'start',
            },
        },
        {
            element: '#search-bar',
            popover: {
                title: t('demo.tour.searchTitle', 'Look up anyone'),
                description: t('demo.tour.searchDesc', 'Search a player by name or UID to see their records.'),
                side: 'bottom', align: 'center',
            },
        },
        {
            element: '#demo-banner',
            popover: {
                title: t('demo.tour.doneTitle', 'Now play a match'),
                description: t('demo.tour.doneDesc', 'Launch Apex Legends. As soon as your account is detected, this screen switches to your own profile.'),
                side: 'bottom', align: 'start',
            },
        },
    ];
    runTour(steps.filter((s) => typeof s.element !== 'string' || document.querySelector(s.element)));
};
