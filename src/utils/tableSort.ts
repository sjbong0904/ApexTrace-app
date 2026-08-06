export type SortDirection = 'desc' | 'asc';

export type TableSortState<K extends string = string> = {
    column: K | null;
    direction: SortDirection;
};

export const createDefaultTableSort = <K extends string>(): TableSortState<K> => ({
    column: null,
    direction: 'desc',
});

export const toggleTableSort = <K extends string>(
    current: TableSortState<K>,
    column: K,
    firstClickDirection: SortDirection = 'desc',
): TableSortState<K> => {
    if (current.column !== column) {
        return { column, direction: firstClickDirection };
    }
    return { column, direction: current.direction === 'desc' ? 'asc' : 'desc' };
};

/** Legend / weapon name columns: first click follows tab or DB order (asc). */
export const toggleCatalogNameTableSort = <K extends string>(
    current: TableSortState<K>,
    column: K,
): TableSortState<K> => toggleTableSort(current, column, column === 'name' ? 'asc' : 'desc');

export type ApplyTableSortOptions<T, K extends string> = {
    /** Rows that return true stay at the bottom for that column (asc and desc). */
    isMissing?: Partial<Record<K, (row: T) => boolean>>;
};

export const applyTableSort = <T, K extends string>(
    rows: readonly T[],
    sortState: TableSortState<K>,
    comparators: Record<K, (a: T, b: T) => number>,
    options?: ApplyTableSortOptions<T, K>,
): T[] => {
    if (!sortState.column) return [...rows];
    const compare = comparators[sortState.column];
    if (!compare) return [...rows];
    const factor = sortState.direction === 'desc' ? -1 : 1;
    const isMissing = options?.isMissing?.[sortState.column];
    return [...rows].sort((a, b) => {
        if (isMissing) {
            const aMiss = isMissing(a);
            const bMiss = isMissing(b);
            if (aMiss !== bMiss) return aMiss ? 1 : -1;
        }
        return compare(a, b) * factor;
    });
};

export const compareStrings = (a: string, b: string) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' });

export const compareNumbers = (a: number, b: number) => a - b;

export const compareNumericStrings = (a: string, b: string) => {
    const na = parseFloat(a);
    const nb = parseFloat(b);
    const aOk = Number.isFinite(na);
    const bOk = Number.isFinite(nb);
    if (!aOk && !bOk) return 0;
    if (!aOk) return 1; // dashes / invalid sort last in asc (caller may flip)
    if (!bOk) return -1;
    return na - nb;
};

/** Lower placement rank is better — invert so desc shows #1 first. */
export const compareAvgPlacement = (a: string, b: string) => compareNumericStrings(b, a);
