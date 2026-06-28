import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaCamera, FaPlus, FaTimes, FaUser, FaCrosshairs, FaGripVertical } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import {
    createDefaultTableState,
    findItemTierId,
    getItemsForMode,
    getTierLabelFontSize,
    getTierRowColor,
    loadTableState,
    loadLastMode,
    moveItemToTier,
    reorderTierRow,
    saveLastMode,
    saveTableState,
    TIER_FALLBACK_IMG,
    TIER_LABEL_MAX_LENGTH,
    TIER_COLOR_CYCLE,
    type TierTableItem,
    type TierTableMode,
    type TierTableState,
} from '../utils/tierTableData';
import TierTableScreenshotPreview from './TierTableScreenshotPreview';
import { TIER_CAPTURE_PAD_X } from './TierTableWatermarkOverlay';

const DRAG_MIME = 'application/x-apex-tier-item';
const ROW_DRAG_MIME = 'application/x-apex-tier-row';
const POOL_DROP_ID = '__pool__';

const LEGEND_TIER = { w: 50, h: 50 };
const WEAPON_TIER = { w: 68, h: 48 };
const POOL_ITEM = { w: 52, h: 52 };
const POOL_VISIBLE_ROWS = 3;
const POOL_ROW_GAP = 6;
const POOL_INNER_HEIGHT = POOL_ITEM.h * POOL_VISIBLE_ROWS + POOL_ROW_GAP * (POOL_VISIBLE_ROWS - 1);
const ROW_DROP_GAP_IDLE = 14;
const ROW_DROP_GAP_ACTIVE = 24;

const TierTableTab: React.FC = () => {
    const { t } = useTranslation();
    const [mode, setMode] = useState<TierTableMode | null>(() => loadLastMode());
    const [tableState, setTableState] = useState<TierTableState>(() => {
        const savedMode = loadLastMode();
        return savedMode ? loadTableState(savedMode) : createDefaultTableState();
    });
    const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
    const [itemDropTarget, setItemDropTarget] = useState<{ tierId: string; index: number } | null>(null);
    const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
    const [rowDropIndex, setRowDropIndex] = useState<number | null>(null);
    const [hoverRowId, setHoverRowId] = useState<string | null>(null);
    const [isPoolPanning, setIsPoolPanning] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const [screenshotPreviewOpen, setScreenshotPreviewOpen] = useState(false);
    const [screenshotCaptureWidth, setScreenshotCaptureWidth] = useState<number | null>(null);
    const captureRef = useRef<HTMLDivElement>(null);
    const poolScrollRef = useRef<HTMLDivElement>(null);
    const draggingItemIdRef = useRef<string | null>(null);
    const draggingRowIdRef = useRef<string | null>(null);
    const poolPanRef = useRef<{ active: boolean; startY: number; startScrollTop: number }>({
        active: false,
        startY: 0,
        startScrollTop: 0,
    });

    const items = useMemo(() => (mode ? getItemsForMode(mode) : []), [mode]);
    const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

    useEffect(() => {
        if (!mode) return;
        setTableState(loadTableState(mode));
    }, [mode]);

    useEffect(() => {
        if (!mode) return;
        saveTableState(mode, tableState);
    }, [mode, tableState]);

    useEffect(() => {
        if (mode) saveLastMode(mode);
    }, [mode]);

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!poolPanRef.current.active || !poolScrollRef.current) return;
            const delta = e.clientY - poolPanRef.current.startY;
            poolScrollRef.current.scrollTop = poolPanRef.current.startScrollTop - delta;
        };
        const onMouseUp = () => {
            poolPanRef.current.active = false;
            setIsPoolPanning(false);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, []);

    const selectMode = (nextMode: TierTableMode) => {
        setMode(nextMode);
    };

    const updateTierLabel = (tierId: string, label: string) => {
        setTableState((prev) => ({
            ...prev,
            tiers: prev.tiers.map((tier) => (tier.id === tierId ? { ...tier, label } : tier)),
        }));
    };

    const addTierRow = () => {
        setTableState((prev) => {
            const id = `tier-custom-${Date.now()}`;
            const color = TIER_COLOR_CYCLE[prev.tiers.length % TIER_COLOR_CYCLE.length];
            return {
                ...prev,
                tiers: [...prev.tiers, { id, label: t('tierTable.newTier', { defaultValue: 'New' }), color }],
                assignments: { ...prev.assignments, [id]: [] },
            };
        });
    };

    const removeTierRow = (tierId: string) => {
        setTableState((prev) => {
            if (prev.tiers.length <= 1) return prev;
            const { [tierId]: _removed, ...restAssignments } = prev.assignments;
            return {
                tiers: prev.tiers.filter((tier) => tier.id !== tierId),
                assignments: restAssignments,
            };
        });
    };

    const handleDrop = (targetTierId: string | null, itemId: string, insertIndex?: number) => {
        if (targetTierId === POOL_DROP_ID || !targetTierId) {
            setTableState((prev) => moveItemToTier(prev, itemId, null));
        } else {
            setTableState((prev) => moveItemToTier(prev, itemId, targetTierId, insertIndex));
        }
        draggingItemIdRef.current = null;
        setDraggingItemId(null);
        setItemDropTarget(null);
    };

    const getDragTypes = (event: React.DragEvent): string[] =>
        Array.from(event.dataTransfer?.types ?? []);

    const isItemDragEvent = (event: React.DragEvent): boolean => {
        if (draggingItemIdRef.current) return true;
        const types = getDragTypes(event);
        return types.includes(DRAG_MIME) || types.includes('text/plain');
    };

    const isRowDragEvent = (event: React.DragEvent): boolean => {
        if (draggingRowIdRef.current) return true;
        return getDragTypes(event).includes(ROW_DRAG_MIME);
    };

    const resolveItemInsertIndex = (clientX: number, container: HTMLElement): number => {
        const children = container.querySelectorAll('[data-tier-item="true"]');
        if (children.length === 0) return 0;

        for (let i = 0; i < children.length; i += 1) {
            const rect = (children[i] as HTMLElement).getBoundingClientRect();
            const mid = rect.left + rect.width / 2;
            if (clientX < mid) return i;
        }
        return children.length;
    };

    const updateItemDropTarget = (event: React.DragEvent, tierId: string, container: HTMLElement) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        const index = resolveItemInsertIndex(event.clientX, container);
        setItemDropTarget({ tierId, index });
    };

    const onTierItemsDragOver = (event: React.DragEvent, tierId: string) => {
        if (!isItemDragEvent(event)) return;
        updateItemDropTarget(event, tierId, event.currentTarget as HTMLElement);
    };

    const onTierItemsDrop = (event: React.DragEvent, tierId: string) => {
        event.preventDefault();
        event.stopPropagation();
        const itemId = parseDragItemId(event);
        if (!itemId) return;
        const index = resolveItemInsertIndex(event.clientX, event.currentTarget as HTMLElement);
        handleDrop(tierId, itemId, index);
    };

    const parseDragItemId = (event: React.DragEvent): string | null => {
        const raw = event.dataTransfer.getData(DRAG_MIME);
        if (raw) {
            try {
                const parsed = JSON.parse(raw) as { itemId?: string };
                if (parsed.itemId) return parsed.itemId;
            } catch {
                // fall through
            }
        }
        const plain = event.dataTransfer.getData('text/plain');
        return plain || draggingItemIdRef.current;
    };

    const onDragStart = (event: React.DragEvent, itemId: string) => {
        draggingItemIdRef.current = itemId;
        event.dataTransfer.setData(DRAG_MIME, JSON.stringify({ itemId }));
        event.dataTransfer.setData('text/plain', itemId);
        event.dataTransfer.effectAllowed = 'move';
        setDraggingItemId(itemId);
        setItemDropTarget(null);
    };

    const onItemDragEnd = () => {
        draggingItemIdRef.current = null;
        setDraggingItemId(null);
        setItemDropTarget(null);
    };

    const onDragOver = (event: React.DragEvent) => {
        if (!isItemDragEvent(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    };

    const autoScrollPool = (clientY: number) => {
        const el = poolScrollRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const edge = 24;
        const speed = 12;
        if (clientY < rect.top + edge) el.scrollTop -= speed;
        else if (clientY > rect.bottom - edge) el.scrollTop += speed;
    };

    const onPoolDragOver = (event: React.DragEvent) => {
        onDragOver(event);
        autoScrollPool(event.clientY);
    };

    const onPoolPanStart = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.button !== 0 || !poolScrollRef.current) return;
        if (draggingItemIdRef.current) return;
        if ((event.target as HTMLElement).closest('[data-pool-item="true"]')) return;
        poolPanRef.current = {
            active: true,
            startY: event.clientY,
            startScrollTop: poolScrollRef.current.scrollTop,
        };
        setIsPoolPanning(true);
        event.preventDefault();
    };

    const onRowDragStart = (event: React.DragEvent, tierId: string) => {
        draggingRowIdRef.current = tierId;
        event.dataTransfer.setData(ROW_DRAG_MIME, JSON.stringify({ tierId }));
        event.dataTransfer.setData('text/plain', tierId);
        event.dataTransfer.effectAllowed = 'move';
        setDraggingRowId(tierId);
        setRowDropIndex(null);
    };

    const onRowDragOver = (event: React.DragEvent, index: number) => {
        if (!isRowDragEvent(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setRowDropIndex(index);
    };

    const resolveRowInsertIndex = (clientY: number, rowEl: HTMLElement, index: number): number => {
        const rect = rowEl.getBoundingClientRect();
        const relativeY = clientY - rect.top;
        return relativeY < rect.height / 2 ? index : index + 1;
    };

    const onRowSurfaceDragOver = (event: React.DragEvent, index: number, tierId: string) => {
        if (isRowDragEvent(event)) {
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = 'move';
            const insertIndex = resolveRowInsertIndex(event.clientY, event.currentTarget as HTMLElement, index);
            setRowDropIndex(insertIndex);
            return;
        }
        if (!isItemDragEvent(event)) return;
        const itemsEl = (event.currentTarget as HTMLElement).querySelector('[data-tier-items="true"]');
        if (!(itemsEl instanceof HTMLElement)) return;
        updateItemDropTarget(event, tierId, itemsEl);
    };

    const onRowSurfaceDrop = (event: React.DragEvent, index: number, tierId: string) => {
        if (isRowDragEvent(event)) {
            event.preventDefault();
            event.stopPropagation();
            const insertIndex = resolveRowInsertIndex(event.clientY, event.currentTarget as HTMLElement, index);
            onRowDrop(event, insertIndex);
            return;
        }
        if (!isItemDragEvent(event)) return;
        const itemsEl = (event.currentTarget as HTMLElement).querySelector('[data-tier-items="true"]');
        if (!(itemsEl instanceof HTMLElement)) return;
        event.preventDefault();
        event.stopPropagation();
        const itemId = parseDragItemId(event);
        if (!itemId) return;
        const insertIndex = resolveItemInsertIndex(event.clientX, itemsEl);
        handleDrop(tierId, itemId, insertIndex);
    };

    const onRowDrop = (event: React.DragEvent, targetIndex: number) => {
        event.preventDefault();
        const raw = event.dataTransfer.getData(ROW_DRAG_MIME);
        let tierId: string | null = null;
        if (raw) {
            try {
                const parsed = JSON.parse(raw) as { tierId?: string };
                tierId = parsed.tierId ?? null;
            } catch {
                // fall through
            }
        }
        if (!tierId) {
            tierId = event.dataTransfer.getData('text/plain') || draggingRowIdRef.current;
        }
        if (!tierId) return;
        setTableState((prev) => reorderTierRow(prev, tierId!, targetIndex));
        draggingRowIdRef.current = null;
        setDraggingRowId(null);
        setRowDropIndex(null);
    };

    const onRowDragEnd = () => {
        draggingRowIdRef.current = null;
        setDraggingRowId(null);
        setRowDropIndex(null);
    };

    const onDropZone = (event: React.DragEvent, targetTierId: string | null) => {
        event.preventDefault();
        const itemId = parseDragItemId(event);
        if (itemId) handleDrop(targetTierId, itemId);
    };

    const resetTable = () => {
        if (!mode) return;
        setTableState(createDefaultTableState());
    };

    const captureScreenshot = useCallback(() => {
        if (!captureRef.current || isCapturing || !mode) return;
        const el = captureRef.current;
        const style = getComputedStyle(el);
        const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        const tableWidth = el.clientWidth - padX;
        setScreenshotCaptureWidth(Math.max(320, tableWidth + TIER_CAPTURE_PAD_X * 2));
        setIsCapturing(true);
        setScreenshotPreviewOpen(true);
    }, [isCapturing, mode]);

    const closeScreenshotPreview = useCallback(() => {
        setScreenshotPreviewOpen(false);
        setIsCapturing(false);
    }, []);

    const tierSize = mode === 'legend' ? LEGEND_TIER : WEAPON_TIER;
    const poolItemSize = POOL_ITEM;

    const renderPoolItem = (item: TierTableItem) => {
        const placedTierId = findItemTierId(tableState, item.id);
        const isPlaced = !!placedTierId;

        return (
            <div
                key={item.id}
                data-pool-item="true"
                draggable
                onDragStart={(e) => onDragStart(e, item.id)}
                onDragEnd={onItemDragEnd}
                title={item.label}
                style={{
                    width: poolItemSize.w,
                    height: poolItemSize.h,
                    borderRadius: mode === 'legend' ? '50%' : 8,
                    border: `2px solid ${isPlaced ? 'var(--color-accent)' : 'var(--color-border-light)'}`,
                    background: 'var(--color-bg-card)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'grab',
                    opacity: isPlaced ? 0.45 : draggingItemId === item.id ? 0.6 : 1,
                    transition: 'transform 0.15s, opacity 0.15s',
                    overflow: 'hidden',
                    flexShrink: 0,
                }}
            >
                <img
                    src={item.image}
                    alt={item.label}
                    crossOrigin="anonymous"
                    draggable={false}
                    style={{
                        maxWidth: mode === 'legend' ? '100%' : '90%',
                        maxHeight: mode === 'legend' ? '100%' : '85%',
                        objectFit: mode === 'legend' ? 'cover' : 'contain',
                        transform: mode === 'legend' ? 'scale(1.08)' : undefined,
                        pointerEvents: 'none',
                    }}
                    onError={(e) => { e.currentTarget.src = TIER_FALLBACK_IMG; }}
                />
            </div>
        );
    };

    const renderTierItem = (item: TierTableItem, tierId: string) => (
        <div
            key={`${tierId}-${item.id}`}
            data-tier-item="true"
            draggable
            onDragStart={(e) => onDragStart(e, item.id)}
            onDragEnd={onItemDragEnd}
            title={item.label}
            style={{
                position: 'relative',
                width: tierSize.w,
                height: tierSize.h,
                borderRadius: mode === 'legend' ? '50%' : 6,
                border: '1px solid var(--color-border-light)',
                background: 'var(--color-bg-sub-header)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'grab',
                overflow: 'hidden',
                flexShrink: 0,
            }}
        >
            <button
                type="button"
                onClick={() => handleDrop(POOL_DROP_ID, item.id)}
                style={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'rgba(0,0,0,0.65)',
                    color: '#fff',
                    fontSize: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2,
                    padding: 0,
                }}
                aria-label={t('tierTable.removeItem', { defaultValue: 'Remove' })}
            >
                <FaTimes />
            </button>
            <img
                src={item.image}
                alt={item.label}
                crossOrigin="anonymous"
                draggable={false}
                style={{
                    maxWidth: mode === 'legend' ? '100%' : '92%',
                    maxHeight: mode === 'legend' ? '100%' : '88%',
                    objectFit: mode === 'legend' ? 'cover' : 'contain',
                    transform: mode === 'legend' ? 'scale(1.06)' : undefined,
                    pointerEvents: 'none',
                }}
                onError={(e) => { e.currentTarget.src = TIER_FALLBACK_IMG; }}
            />
        </div>
    );

    if (!mode) {
        return (
            <div style={{
                width: '100%',
                height: '100%',
                background: 'var(--color-bg-panel)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                boxSizing: 'border-box',
            }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 24,
                    padding: '24px 40px',
                    maxWidth: 560,
                    textAlign: 'center',
                    transform: 'translateY(-7vh)',
                }}>
                <h2 style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 22 }}>
                    {t('tierTable.chooseType', { defaultValue: 'Create a tier table' })}
                </h2>
                <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 14, textAlign: 'center', maxWidth: 420 }}>
                    {t('tierTable.chooseTypeDesc', { defaultValue: 'Pick legend or weapon tier list, then drag icons into tiers.' })}
                </p>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                        type="button"
                        onClick={() => selectMode('legend')}
                        style={{
                            width: 220,
                            padding: '28px 20px',
                            borderRadius: 12,
                            border: '1px solid var(--color-border-light)',
                            background: 'var(--color-bg-card)',
                            color: 'var(--color-text-secondary)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 12,
                            transition: 'border-color 0.2s, transform 0.2s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-light)'; e.currentTarget.style.transform = 'none'; }}
                    >
                        <FaUser size={32} color="var(--color-accent)" />
                        <span style={{ fontWeight: 700, fontSize: 16 }}>{t('tierTable.legendTier', { defaultValue: 'Legend Tier Table' })}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => selectMode('weapon')}
                        style={{
                            width: 220,
                            padding: '28px 20px',
                            borderRadius: 12,
                            border: '1px solid var(--color-border-light)',
                            background: 'var(--color-bg-card)',
                            color: 'var(--color-text-secondary)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 12,
                            transition: 'border-color 0.2s, transform 0.2s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#00cec9'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-light)'; e.currentTarget.style.transform = 'none'; }}
                    >
                        <FaCrosshairs size={32} color="#00cec9" />
                        <span style={{ fontWeight: 700, fontSize: 16 }}>{t('tierTable.weaponTier', { defaultValue: 'Weapon Tier Table' })}</span>
                    </button>
                </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ width: '100%', height: '100%', background: 'var(--color-bg-panel)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {mode && (
                <TierTableScreenshotPreview
                    open={screenshotPreviewOpen}
                    mode={mode}
                    tableState={tableState}
                    itemMap={itemMap}
                    captureWidth={screenshotCaptureWidth ?? undefined}
                    onClose={closeScreenshotPreview}
                    onCaptureComplete={() => setIsCapturing(false)}
                />
            )}
            <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        type="button"
                        onClick={() => selectMode('legend')}
                        style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: `1px solid ${mode === 'legend' ? 'var(--color-accent)' : 'var(--color-border-light)'}`,
                            background: mode === 'legend' ? 'rgba(214, 69, 55, 0.15)' : 'transparent',
                            color: 'var(--color-text-secondary)',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: 13,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        <FaUser size={12} /> {t('tierTable.legendTier', { defaultValue: 'Legend Tier Table' })}
                    </button>
                    <button
                        type="button"
                        onClick={() => selectMode('weapon')}
                        style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: `1px solid ${mode === 'weapon' ? '#00cec9' : 'var(--color-border-light)'}`,
                            background: mode === 'weapon' ? 'rgba(0, 206, 201, 0.12)' : 'transparent',
                            color: 'var(--color-text-secondary)',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: 13,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        <FaCrosshairs size={12} /> {t('tierTable.weaponTier', { defaultValue: 'Weapon Tier Table' })}
                    </button>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                        type="button"
                        onClick={resetTable}
                        style={{
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: '1px solid var(--color-border-light)',
                            background: 'transparent',
                            color: 'var(--color-text-muted)',
                            cursor: 'pointer',
                            fontSize: 12,
                        }}
                    >
                        {t('tierTable.reset', { defaultValue: 'Reset' })}
                    </button>
                    <button
                        type="button"
                        onClick={captureScreenshot}
                        disabled={isCapturing}
                        style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: '1px solid var(--color-accent)',
                            background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)',
                            color: 'var(--color-text-primary)',
                            cursor: isCapturing ? 'wait' : 'pointer',
                            fontWeight: 600,
                            fontSize: 13,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            opacity: isCapturing ? 0.7 : 1,
                        }}
                    >
                        <FaCamera size={14} />
                        {t('tierTable.screenshot', { defaultValue: 'Screenshot' })}
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                    <div
                        ref={captureRef}
                        style={{
                            flex: 1,
                            overflowY: 'auto',
                            minHeight: 0,
                            padding: '12px 20px 8px',
                        }}
                    >
                    {tableState.tiers.map((tier, index) => {
                        const tierColor = getTierRowColor(tier, index);
                        const tierItemIds = tableState.assignments[tier.id] ?? [];
                        const tierItems = tierItemIds
                            .map((id) => itemMap.get(id))
                            .filter((item): item is TierTableItem => !!item);
                        const isRowDragging = draggingRowId === tier.id;

                        return (
                            <React.Fragment key={tier.id}>
                                <div
                                    onDragOver={(e) => onRowDragOver(e, index)}
                                    onDrop={(e) => onRowDrop(e, index)}
                                    style={{
                                        height: rowDropIndex === index ? ROW_DROP_GAP_ACTIVE : ROW_DROP_GAP_IDLE,
                                        marginBottom: rowDropIndex === index ? 4 : 0,
                                        borderRadius: 4,
                                        background: rowDropIndex === index ? 'var(--color-accent)' : 'transparent',
                                        transition: 'height 0.12s, margin 0.12s, background 0.12s',
                                    }}
                                />
                                <div
                                    onMouseEnter={() => setHoverRowId(tier.id)}
                                    onMouseLeave={() => setHoverRowId(null)}
                                    onDragOver={(e) => onRowSurfaceDragOver(e, index, tier.id)}
                                    onDrop={(e) => onRowSurfaceDrop(e, index, tier.id)}
                                    style={{
                                        position: 'relative',
                                        display: 'grid',
                                        gridTemplateColumns: '108px 1fr',
                                        minHeight: 58,
                                        marginBottom: 0,
                                        borderRadius: 8,
                                        overflow: 'hidden',
                                        border: '1px solid var(--color-border)',
                                        opacity: isRowDragging ? 0.45 : 1,
                                    }}
                                >
                                    {tableState.tiers.length > 1 && hoverRowId === tier.id && (
                                        <button
                                            type="button"
                                            onClick={() => removeTierRow(tier.id)}
                                            aria-label={t('tierTable.removeTier', { defaultValue: 'Remove' })}
                                            style={{
                                                position: 'absolute',
                                                top: 4,
                                                left: 4,
                                                zIndex: 6,
                                                width: 18,
                                                height: 18,
                                                borderRadius: '50%',
                                                border: '1px solid var(--color-border-light)',
                                                background: 'rgba(0,0,0,0.75)',
                                                color: '#fff',
                                                fontSize: 9,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                padding: 0,
                                                boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                                            }}
                                        >
                                            <FaTimes />
                                        </button>
                                    )}
                                    <div style={{
                                        background: tierColor,
                                        position: 'relative',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minHeight: 58,
                                        padding: '8px 6px',
                                        borderRadius: '8px 0 0 8px',
                                        overflow: 'hidden',
                                    }}>
                                        <div
                                            draggable
                                            onDragStart={(e) => onRowDragStart(e, tier.id)}
                                            onDragEnd={onRowDragEnd}
                                            title={t('tierTable.dragRow', { defaultValue: 'Drag to reorder' })}
                                            style={{
                                                position: 'absolute',
                                                top: 4,
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'grab',
                                                color: 'rgba(255,255,255,0.7)',
                                            }}
                                        >
                                            <FaGripVertical size={10} />
                                        </div>
                                        <input
                                            value={tier.label}
                                            onChange={(e) => updateTierLabel(tier.id, e.target.value)}
                                            maxLength={TIER_LABEL_MAX_LENGTH}
                                            style={{
                                                width: '100%',
                                                boxSizing: 'border-box',
                                                background: 'rgba(0,0,0,0.25)',
                                                border: '1px solid rgba(255,255,255,0.25)',
                                                borderRadius: 4,
                                                color: '#fff',
                                                fontWeight: 800,
                                                fontSize: getTierLabelFontSize(tier.label),
                                                lineHeight: 1.2,
                                                textAlign: 'center',
                                                padding: '6px 4px',
                                                outline: 'none',
                                            }}
                                        />
                                    </div>
                                    <div
                                        data-tier-items="true"
                                        onDragOver={(e) => onTierItemsDragOver(e, tier.id)}
                                        onDrop={(e) => onTierItemsDrop(e, tier.id)}
                                        style={{
                                            background: 'var(--color-bg-card)',
                                            padding: '8px 10px',
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            alignItems: 'center',
                                            gap: 6,
                                            minHeight: 58,
                                            borderRadius: '0 8px 8px 0',
                                            outline: draggingItemId ? '2px dashed var(--color-accent-hover)' : undefined,
                                            outlineOffset: -2,
                                        }}
                                    >
                                        {tierItems.length === 0 && !draggingItemId && (
                                            <span style={{ color: 'var(--color-text-faint)', fontSize: 12, fontStyle: 'italic' }}>
                                                {t('tierTable.dropHere', { defaultValue: 'Drag items here' })}
                                            </span>
                                        )}
                                        {tierItems.map((item, itemIndex) => (
                                            <React.Fragment key={`${tier.id}-${item.id}-slot`}>
                                                {itemDropTarget?.tierId === tier.id && itemDropTarget.index === itemIndex && (
                                                    <div
                                                        style={{
                                                            width: 4,
                                                            height: tierSize.h,
                                                            borderRadius: 2,
                                                            background: 'var(--color-accent)',
                                                            flexShrink: 0,
                                                        }}
                                                    />
                                                )}
                                                {renderTierItem(item, tier.id)}
                                            </React.Fragment>
                                        ))}
                                        {itemDropTarget?.tierId === tier.id && itemDropTarget.index === tierItems.length && (
                                            <div
                                                style={{
                                                    width: 4,
                                                    height: tierSize.h,
                                                    borderRadius: 2,
                                                    background: 'var(--color-accent)',
                                                    flexShrink: 0,
                                                }}
                                            />
                                        )}
                                    </div>
                                </div>
                            </React.Fragment>
                        );
                    })}

                    <div
                        onDragOver={(e) => onRowDragOver(e, tableState.tiers.length)}
                        onDrop={(e) => onRowDrop(e, tableState.tiers.length)}
                        style={{
                            height: rowDropIndex === tableState.tiers.length ? ROW_DROP_GAP_ACTIVE : ROW_DROP_GAP_IDLE,
                            marginTop: rowDropIndex === tableState.tiers.length ? 4 : 2,
                            marginBottom: 6,
                            borderRadius: 4,
                            background: rowDropIndex === tableState.tiers.length ? 'var(--color-accent)' : 'transparent',
                            transition: 'height 0.12s, margin 0.12s, background 0.12s',
                        }}
                    />

                    </div>

                    <div style={{ flexShrink: 0, padding: '0 24px 8px' }}>
                    <button
                        type="button"
                        onClick={addTierRow}
                        style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: 8,
                            border: '1px dashed var(--color-border-light)',
                            background: 'transparent',
                            color: 'var(--color-text-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            fontSize: 13,
                        }}
                    >
                        <FaPlus size={11} /> {t('tierTable.addTier', { defaultValue: 'Add tier row' })}
                    </button>
                    </div>
                </div>

                <div
                    onDragOver={onPoolDragOver}
                    onDrop={(e) => onDropZone(e, POOL_DROP_ID)}
                    style={{
                        flexShrink: 0,
                        borderTop: '1px solid var(--color-border)',
                        background: 'var(--color-bg-sub-header)',
                        padding: '8px 20px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        position: 'relative',
                        zIndex: 2,
                    }}
                >
                    <div style={{
                        fontSize: 10,
                        color: 'var(--color-text-muted)',
                        marginBottom: 6,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: 0.4,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}>
                        {mode === 'legend'
                            ? t('tierTable.legendPool', { defaultValue: 'Legends' })
                            : t('tierTable.weaponPool', { defaultValue: 'Weapons' })}
                        <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: 6, color: 'var(--color-text-faint)' }}>
                            {t('tierTable.poolHint', { defaultValue: 'Drag into tiers above · Drop here to unassign' })}
                        </span>
                    </div>
                    <div
                        ref={poolScrollRef}
                        onMouseDown={onPoolPanStart}
                        onDragOver={onPoolDragOver}
                        style={{
                            height: POOL_INNER_HEIGHT,
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: POOL_ROW_GAP,
                            alignContent: 'flex-start',
                            cursor: isPoolPanning ? 'grabbing' : 'default',
                            userSelect: 'none',
                        }}
                    >
                        {items.map(renderPoolItem)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TierTableTab;
