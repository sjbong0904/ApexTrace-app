import { useTranslation } from 'react-i18next';
import { FaCheck, FaCrown, FaGamepad, FaRoute, FaTimes } from 'react-icons/fa';
import { useApexRunning } from '../hooks/useApexRunning';

export type DemoTask = 'open' | 'replay' | 'stats';

interface DemoBannerProps {
    done: Record<DemoTask, boolean>;
    onStartTour: () => void;
    onDismiss: () => void;
}

/**
 * Sits above the sample profile: says it is sample data, that it hands over to the real
 * account by itself, and gives three things to try (ticked as the user does them).
 */
const DemoBanner = ({ done, onStartTour, onDismiss }: DemoBannerProps) => {
    const { t } = useTranslation();
    const running = useApexRunning();

    const tasks: Array<{ id: DemoTask; label: string; pro?: boolean }> = [
        { id: 'open', label: t('demo.taskOpen', { defaultValue: 'Open a match' }) },
        { id: 'replay', label: t('demo.taskReplay', { defaultValue: 'Play the map replay' }), pro: true },
        { id: 'stats', label: t('demo.taskStats', { defaultValue: 'Check Statistics' }), pro: true },
    ];
    const allDone = tasks.every((task) => done[task.id]);

    return (
        <section
            id="demo-banner"
            aria-label={t('demo.label', { defaultValue: 'Sample profile' })}
            style={{
                display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                marginBottom: 16, padding: '12px 16px', borderRadius: 12,
                border: '1px solid color-mix(in srgb, var(--color-accent) 45%, var(--color-border))',
                background: 'color-mix(in srgb, var(--color-accent) 10%, var(--color-bg-card))',
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 260px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', color: 'var(--color-bg-main)', background: 'var(--color-accent)', borderRadius: 4, padding: '2px 7px' }}>
                        {t('demo.badge', { defaultValue: 'SAMPLE' })}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 900, color: 'var(--color-rank-first)' }}>
                        <FaCrown size={10} /> {t('demo.proUnlocked', { defaultValue: 'Premium preview' })}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text-primary)' }}>
                        {allDone
                            ? t('demo.titleDone', { defaultValue: "That's the tour. Your own games come next." })
                            : t('demo.title', { defaultValue: 'Explore a sample profile while you wait for your first match' })}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-dim)' }}>
                    <FaGamepad size={12} color={running ? 'var(--color-success)' : 'var(--color-text-muted)'} />
                    {running
                        ? t('demo.waitingAccount', { defaultValue: 'Apex detected — this switches to your account once it is recognized.' })
                        : t('demo.launchHint', { defaultValue: 'Launch Apex Legends and this switches to your own account automatically.' })}
                </div>
            </div>

            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 12 }}>
                {tasks.map((task) => {
                    const isDone = done[task.id];
                    return (
                        <li key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: isDone ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                            <span aria-hidden style={{
                                width: 18, height: 18, borderRadius: 999, boxSizing: 'border-box', flexShrink: 0,
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                background: isDone ? 'color-mix(in srgb, var(--color-success) 20%, transparent)' : 'transparent',
                                border: isDone ? 'none' : '2px solid var(--color-border-light)',
                            }}>
                                {isDone && <FaCheck size={9} />}
                            </span>
                            <span style={{ textDecoration: isDone ? 'line-through' : 'none', opacity: isDone ? 0.8 : 1 }}>{task.label}</span>
                            {task.pro && <span style={{ fontSize: 9, fontWeight: 900, color: 'var(--color-rank-first)' }}>PRO</span>}
                        </li>
                    );
                })}
            </ol>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button
                    type="button"
                    onClick={onStartTour}
                    className="apex-btn"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', border: 'none', borderRadius: 8, background: 'var(--color-accent)', color: 'var(--color-text-primary)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                >
                    <FaRoute size={11} /> {t('demo.startTour', { defaultValue: 'Guided tour' })}
                </button>
                <button
                    type="button"
                    onClick={onDismiss}
                    title={t('demo.dismiss', { defaultValue: 'Hide sample profile' })}
                    aria-label={t('demo.dismiss', { defaultValue: 'Hide sample profile' })}
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, border: '1px solid var(--color-border-light)', borderRadius: 8, background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}
                >
                    <FaTimes size={12} />
                </button>
            </div>
        </section>
    );
};

export default DemoBanner;
