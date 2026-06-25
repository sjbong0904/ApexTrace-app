import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    collectGepGroupedIssues,
    collectOtherGepIssues,
    fetchGepStatus,
    GEP_STATUS_REFRESH_MS,
    getGepGroupImpactKey,
    getGepGroupLabelKey,
    type GepGroupedIssue,
    type GepStatusResponse,
} from '../utils/gepStatus';

const getOverallStatusInfo = (state: number, t: (key: string, options?: { defaultValue?: string }) => string) => {
    switch (state) {
        case 1:
            return {
                color: '#2ecc71',
                shadow: '0 0 10px #2ecc71',
                title: t('gameStatus.overall.goodTitle', { defaultValue: 'Event Status: Normal' }),
                summary: t('gameStatus.overall.goodSummary', {
                    defaultValue: 'Game events ApexTrace uses are currently reported as healthy.',
                }),
            };
        case 2:
            return {
                color: '#f1c40f',
                shadow: '0 0 10px #f1c40f',
                title: t('gameStatus.overall.partialTitle', { defaultValue: 'Event Status: Partial Outage' }),
                summary: t('gameStatus.overall.partialSummary', {
                    defaultValue: 'Some game events are degraded. Match recording may be incomplete.',
                }),
            };
        case 3:
            return {
                color: '#e74c3c',
                shadow: '0 0 10px #e74c3c',
                title: t('gameStatus.overall.unavailableTitle', { defaultValue: 'Event Status: Unavailable' }),
                summary: t('gameStatus.overall.unavailableSummary', {
                    defaultValue: 'Many game events are down. Several match stats may not be recorded.',
                }),
            };
        default:
            return {
                color: '#95a5a6',
                shadow: 'none',
                title: t('gameStatus.overall.unknownTitle', { defaultValue: 'Event Status: Unknown' }),
                summary: t('gameStatus.overall.unknownSummary', {
                    defaultValue: 'Could not load the latest game event health report.',
                }),
            };
    }
};

const getIssueStatusLabel = (state: number, t: (key: string, options?: { defaultValue?: string }) => string) => {
    if (state >= 3) return t('gameStatus.severity.red', { defaultValue: 'Unavailable' });
    if (state >= 2) return t('gameStatus.severity.yellow', { defaultValue: 'Partial' });
    return t('gameStatus.severity.green', { defaultValue: 'Healthy' });
};

const GameStatusIndicator: React.FC = () => {
    const { t } = useTranslation();
    const rootRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [statusData, setStatusData] = useState<GepStatusResponse | null>(null);
    const [lastUpdated, setLastUpdated] = useState<number | null>(null);

    const refreshStatus = useCallback(async () => {
        setLoading(true);
        const data = await fetchGepStatus();
        setStatusData(data);
        setLastUpdated(Date.now());
        setLoading(false);
    }, []);

    useEffect(() => {
        refreshStatus();
        const interval = window.setInterval(refreshStatus, GEP_STATUS_REFRESH_MS);
        return () => window.clearInterval(interval);
    }, [refreshStatus]);

    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [open]);

    const overallState = statusData?.state ?? 0;
    const info = getOverallStatusInfo(overallState, t);
    const groupedIssues = useMemo(
        () => (statusData ? collectGepGroupedIssues(statusData) : []),
        [statusData],
    );
    const otherIssues = useMemo(
        () => (statusData ? collectOtherGepIssues(statusData) : []),
        [statusData],
    );

    const renderGroup = (group: GepGroupedIssue) => {
        const label = t(getGepGroupLabelKey(group.id), { defaultValue: group.id });
        const impact = t(getGepGroupImpactKey(group.id), { defaultValue: '' });
        const severityColor = group.state >= 3 ? 'var(--color-danger)' : 'var(--color-warning)';

        return (
            <div
                key={group.id}
                style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'var(--color-bg-sub-header)',
                    border: '1px solid var(--color-border-light)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        {label}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: severityColor, whiteSpace: 'nowrap' }}>
                        {getIssueStatusLabel(group.state, t)}
                    </span>
                </div>
                {impact && (
                    <div style={{ marginTop: '6px', fontSize: '11px', lineHeight: 1.45, color: 'var(--color-text-muted)' }}>
                        {impact}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div ref={rootRef} style={{ position: 'relative' }}>
            <button
                type="button"
                aria-label={info.title}
                aria-expanded={open}
                onClick={() => setOpen((prev) => !prev)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                }}
            >
                <span
                    style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: info.color,
                        boxShadow: info.shadow,
                        flexShrink: 0,
                        transition: 'all 0.3s ease',
                    }}
                />
            </button>

            {open && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 10px)',
                        right: 0,
                        width: '320px',
                        maxHeight: '420px',
                        overflowY: 'auto',
                        background: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '12px',
                        boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
                        zIndex: 2000,
                        padding: '14px',
                    }}
                >
                    <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <span
                                style={{
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    backgroundColor: info.color,
                                    boxShadow: info.shadow,
                                    flexShrink: 0,
                                }}
                            />
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                                {info.title}
                            </span>
                        </div>
                        <div style={{ fontSize: '11px', lineHeight: 1.5, color: 'var(--color-text-muted)' }}>
                            {loading
                                ? t('gameStatus.panel.loading', { defaultValue: 'Loading game event health report...' })
                                : info.summary}
                        </div>
                    </div>

                    {!loading && groupedIssues.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-dim)' }}>
                                {t('gameStatus.panel.affectedTitle', { defaultValue: 'Recording impact in ApexTrace' })}
                            </div>
                            {groupedIssues.map(renderGroup)}
                        </div>
                    )}

                    {!loading && groupedIssues.length === 0 && overallState <= 1 && (
                        <div
                            style={{
                                padding: '10px 12px',
                                borderRadius: '8px',
                                background: 'var(--color-bg-sub-header)',
                                fontSize: '11px',
                                color: 'var(--color-text-muted)',
                                marginBottom: '12px',
                            }}
                        >
                            {t('gameStatus.panel.allTrackedGood', {
                                defaultValue: 'All tracked game events are currently healthy.',
                            })}
                        </div>
                    )}

                    {!loading && otherIssues.length > 0 && (
                        <div style={{ marginBottom: '12px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-dim)', marginBottom: '6px' }}>
                                {t('gameStatus.panel.otherIssuesTitle', {
                                    count: otherIssues.length,
                                    defaultValue: `Other affected events (${otherIssues.length})`,
                                })}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                                {otherIssues.map((issue) => issue.keyName).join(', ')}
                            </div>
                        </div>
                    )}

                    {!loading && !statusData && (
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                            {t('gameStatus.panel.fetchFailed', {
                                defaultValue: 'Failed to fetch the game event status report.',
                            })}
                        </div>
                    )}

                    <div
                        style={{
                            borderTop: '1px solid var(--color-border-light)',
                            paddingTop: '10px',
                            fontSize: '10px',
                            color: 'var(--color-text-faint)',
                            lineHeight: 1.45,
                        }}
                    >
                        <div>{t('gameStatus.panel.source', { defaultValue: 'Source: Overwolf game-events-status API' })}</div>
                        {lastUpdated && (
                            <div style={{ marginTop: '4px' }}>
                                {t('gameStatus.panel.updatedAt', {
                                    time: new Date(lastUpdated).toLocaleTimeString(),
                                    defaultValue: `Updated at ${new Date(lastUpdated).toLocaleTimeString()}`,
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GameStatusIndicator;
