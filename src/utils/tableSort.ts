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

export const applyTableSort = <T, K extends string>(
    rows: readonly T[],
    sortState: TableSortState<K>,
    comparators: Record<K, (a: T, b: T) => number>,
): T[] => {
    if (!sortState.column) return [...rows];
    const compare = comparators[sortState.column];
    if (!compare) return [...rows];
    const factor = sortState.direction === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => compare(a, b) * factor);
};

export const compareStrings = (a: string, b: string) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' });

export const compareNumbers = (a: number, b: number) => a - b;

export const compareNumericStrings = (a: string, b: string) => parseFloat(a) - parseFloat(b);

/** Lower placement rank is better — invert so desc shows #1 first. */
export const compareAvgPlacement = (a: string, b: string) => compareNumericStrings(b, a);
