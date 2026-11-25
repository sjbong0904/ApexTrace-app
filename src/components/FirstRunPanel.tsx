import { useTranslation } from 'react-i18next';
import { FaCheck, FaPlay, FaQuestionCircle } from 'react-icons/fa';
import { useApexRunning } from '../hooks/useApexRunning';
import previewMap from '../assets/worlds-edge-decor.webp';

const IMG = '/images';

type StepState = 'done' | 'active' | 'pending';

/**
 * Own account, zero matches: show the setup progress and what a match will look like,
 * instead of an empty box. Keeps first-install users around until the first record lands.
 */
const FirstRunPanel = ({ onStartTutorial, onTryDemo }: { onStartTutorial: () => void; onTryDemo?: () => void }) => {
    const { t } = useTranslation();
    const running = useApexRunning();

    const steps: Array<{ label: string; state: StepState }> = [
        { label: t('firstRun.stepInstalled', { defaultValue: 'App installed' }), state: 'done' },
        {
            label: running
                ? t('firstRun.stepGameOn', { defaultValue: 'Apex detected' })
                : t('firstRun.stepGameOff', { defaultValue: 'Launch Apex Legends' }),
            state: running ? 'done' : 'active',
        },
        { label: t('firstRun.stepFirstMatch', { defaultValue: 'Waiting for your first match' }), state: running ? 'active' : 'pending' },
    ];

    const dot = (state: StepState) => (
        <span style={{
            width: 22, height: 22, borderRadius: 999, flexShrink: 0, boxSizing: 'border-box',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: state === 'done' ? 'color-mix(in srgb, var(--color-success) 20%, transparent)' : 'transparent',
            border: state === 'active' ? '2px solid var(--color-accent)' : state === 'pending' ? '2px solid var(--color-border-light)' : 'none',
            color: 'var(--color-success)',
        }}>
            {state === 'done' && <FaCheck size={10} />}
        </span>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section
                aria-label={t('firstRun.progressLabel', { defaultValue: 'Setup progress' })}
                style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '16px 20px' }}
            >
                <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: '1 1 420px', fontSize: 13 }}>
                    {steps.map((step, i) => (
                        <li key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: step.state === 'done' ? 'var(--color-success)' : step.state === 'active' ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                            {dot(step.state)}
                            {step.label}
                            {i < steps.length - 1 && <span aria-hidden style={{ width: 24, height: 2, marginLeft: 4, background: step.state === 'done' ? 'var(--color-success)' : 'var(--color-border-light)' }} />}
                        </li>
                    ))}
                </ol>
                {onTryDemo && (
                    <button
                        type="button"
                        onClick={onTryDemo}
                        className="apex-btn"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', border: 'none', borderRadius: 8, background: 'var(--color-accent)', color: 'var(--color-text-primary)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                    >
                        <FaPlay size={10} /> {t('demo.tryAgain', { defaultValue: 'Explore a sample profile' })}
                    </button>
                )}
                <button
                    type="button"
                    onClick={onStartTutorial}
                    className="apex-btn"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', border: '1px solid var(--color-border-light)', borderRadius: 8, background: 'transparent', color: 'var(--color-text-dim)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                    <FaQuestionCircle size={12} /> {t('controls.tutorial')}
                </button>
            </section>

            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text-secondary)' }}>
                    {t('firstRun.previewTitle', { defaultValue: 'After your first match, it looks like this' })}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{t('firstRun.sampleNote', { defaultValue: 'Sample match' })}</div>
            </div>

            <div aria-hidden style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', minHeight: 240, border: '1px dashed var(--color-border-light)', borderRadius: 12, overflow: 'hidden' }}>
                <span style={{ position: 'absolute', top: 10, right: 10, zIndex: 2, fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', color: 'var(--color-bg-main)', background: 'var(--color-text-dim)', borderRadius: 4, padding: '2px 7px' }}>SAMPLE</span>
                <div style={{ position: 'relative', backgroundImage: `url(${previewMap})`, backgroundSize: 'cover', backgroundPosition: '50% 45%', filter: 'brightness(0.6) grayscale(0.3)' }} />
                <div style={{ background: 'var(--color-bg-card)', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <img src={`${IMG}/bangalore.png`} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', background: 'var(--color-bg-sub-header)' }} />
                        <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--color-rank-first)' }}>#1</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                        {[['match.damage', '1,980'], ['match.kills', '6'], ['match.assists', '4']].map(([key, value]) => (
                            <div key={key}>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{t(key)}</div>
                                <div style={{ fontSize: 17, fontWeight: 900 }}>{value}</div>
                            </div>
                        ))}
                    </div>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--color-text-dim)' }}>
                        <li>· {t('firstRun.featureMap', { defaultValue: 'Where and to whom you went down, on the map' })}</li>
                        <li>· {t('firstRun.featureLog', { defaultValue: 'Combat log and loadout changes' })}</li>
                        <li>· {t('firstRun.featureShare', { defaultValue: 'A one-image share card' })}</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default FirstRunPanel;
