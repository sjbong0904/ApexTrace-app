import { useEffect, useState } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import { adminGet, adminMutate } from '../lib/api';

type Weapon = Record<string, unknown> & { id: string };

export default function WeaponsPage() {
    const [rows, setRows] = useState<Weapon[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<Weapon | null>(null);
    const [draft, setDraft] = useState('');
    const [importText, setImportText] = useState('');
    const [pending, setPending] = useState<Record<string, unknown> | null>(null);
    const [pendingTitle, setPendingTitle] = useState('');
    const [busy, setBusy] = useState(false);

    const load = async () => {
        setError(null);
        try {
            const res = await adminGet<{ data: Weapon[] }>('/api/admin/weapons', { include_inactive: '1' });
            setRows(res.data);
        } catch (e) {
            setError((e as Error).message);
        }
    };

    useEffect(() => { void load(); }, []);

    const openEdit = (row: Weapon) => {
        setSelected(row);
        setDraft(JSON.stringify(row, null, 2));
    };

    const requestPatch = () => {
        if (!selected) return;
        try {
            const parsed = JSON.parse(draft) as Weapon;
            const { id, ...patch } = parsed;
            setPendingTitle('무기 수정 최종 확인');
            setPending({ id: selected.id, patch });
        } catch {
            setError('Invalid JSON');
        }
    };

    const exportJson = () => {
        const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `weapons-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const requestImport = () => {
        try {
            const parsed = JSON.parse(importText);
            const weapons = Array.isArray(parsed) ? parsed : parsed.weapons;
            if (!Array.isArray(weapons)) throw new Error('Expected array or { weapons: [] }');
            setPendingTitle('무기 Import (replace_all) 최종 확인');
            setPending({ weapons, replace_all: true });
        } catch (e) {
            setError((e as Error).message);
        }
    };

    const confirmApply = async () => {
        if (!pending) return;
        setBusy(true);
        setError(null);
        try {
            if (pending.weapons) {
                await adminMutate('/api/admin/weapons', 'POST', pending);
            } else {
                await adminMutate('/api/admin/weapons', 'PATCH', pending);
            }
            setPending(null);
            setSelected(null);
            await load();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <h2>무기 DB</h2>
            <div className="panel">
                <div className="row">
                    <button type="button" className="secondary" onClick={load}>새로고침</button>
                    <button type="button" className="secondary" onClick={exportJson}>Export JSON</button>
                </div>
                <p className="muted">대규모 패치: Export → 로컬에서 수정 → Import. schema_version을 올리고 일괄 upsert합니다.</p>
                {error && <div className="error">{error}</div>}
            </div>

            <div className="panel" style={{ overflowX: 'auto' }}>
                <table>
                    <thead>
                        <tr>
                            <th>id</th>
                            <th>category</th>
                            <th>variant</th>
                            <th>active</th>
                            <th>schema</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.id}>
                                <td><code>{r.id}</code></td>
                                <td>{String(r.category ?? '')}</td>
                                <td>{String(r.variant ?? '')}</td>
                                <td>{String(r.is_active)}</td>
                                <td>{String(r.schema_version ?? 1)}</td>
                                <td><button type="button" className="secondary" onClick={() => openEdit(r)}>편집</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {selected && (
                <div className="panel">
                    <h3>편집: {selected.id}</h3>
                    <textarea value={draft} onChange={(e) => setDraft(e.target.value)} style={{ minHeight: 360 }} />
                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                        <button type="button" className="secondary" onClick={() => setSelected(null)}>닫기</button>
                        <button type="button" onClick={requestPatch}>적용</button>
                    </div>
                </div>
            )}

            <div className="panel">
                <h3>Import JSON</h3>
                <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder='[{"id":"r-301", ...}] 또는 {"weapons":[...]}'
                    style={{ minHeight: 200 }}
                />
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                    <button type="button" onClick={requestImport}>적용 (Import)</button>
                </div>
            </div>

            <ConfirmModal
                open={!!pending}
                title={pendingTitle}
                summary={pending}
                busy={busy}
                onCancel={() => setPending(null)}
                onConfirm={confirmApply}
            />
        </div>
    );
}
