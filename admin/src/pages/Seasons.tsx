import { useEffect, useState } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import { adminGet, adminMutate } from '../lib/api';

type Season = {
    id: number;
    name: string;
    start_time: number;
    end_time: number | null;
    version?: number;
};

export default function SeasonsPage() {
    const [rows, setRows] = useState<Season[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [draft, setDraft] = useState<Season>({
        id: 0,
        name: '',
        start_time: Date.now(),
        end_time: null,
        version: 1,
    });
    const [pending, setPending] = useState<Record<string, unknown> | null>(null);
    const [pendingTitle, setPendingTitle] = useState('');
    const [busy, setBusy] = useState(false);

    const load = async () => {
        setError(null);
        try {
            const res = await adminGet<{ data: Season[] }>('/api/admin/seasons');
            setRows(res.data);
        } catch (e) {
            setError((e as Error).message);
        }
    };

    useEffect(() => { void load(); }, []);

    const requestSave = () => {
        setPendingTitle(rows.some((r) => r.id === draft.id) ? '시즌 수정 최종 확인' : '시즌 생성 최종 확인');
        setPending({ season: draft });
    };

    const requestDelete = (id: number) => {
        setPendingTitle('시즌 삭제 최종 확인');
        setPending({ id, _delete: true });
    };

    const confirmApply = async () => {
        if (!pending) return;
        setBusy(true);
        setError(null);
        try {
            if (pending._delete) {
                await adminMutate('/api/admin/seasons', 'POST', { id: pending.id, action: 'delete' });
            } else {
                await adminMutate('/api/admin/seasons', 'POST', { season: pending.season });
            }
            setPending(null);
            await load();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <h2>시즌</h2>
            {error && <div className="error panel">{error}</div>}
            <div className="panel">
                <div className="row">
                    <label>id<input type="number" value={draft.id} onChange={(e) => setDraft({ ...draft, id: Number(e.target.value) })} /></label>
                    <label>name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
                    <label>start_time (ms)<input type="number" value={draft.start_time} onChange={(e) => setDraft({ ...draft, start_time: Number(e.target.value) })} /></label>
                    <label>end_time (ms, empty=null)
                        <input
                            value={draft.end_time ?? ''}
                            onChange={(e) => setDraft({
                                ...draft,
                                end_time: e.target.value === '' ? null : Number(e.target.value),
                            })}
                        />
                    </label>
                    <button type="button" onClick={requestSave}>적용</button>
                </div>
            </div>

            <div className="panel">
                <table>
                    <thead>
                        <tr>
                            <th>id</th>
                            <th>name</th>
                            <th>start</th>
                            <th>end</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.id}>
                                <td>{r.id}</td>
                                <td>{r.name}</td>
                                <td>{new Date(r.start_time).toISOString()}</td>
                                <td>{r.end_time == null ? '—' : new Date(r.end_time).toISOString()}</td>
                                <td style={{ whiteSpace: 'nowrap' }}>
                                    <button type="button" className="secondary" onClick={() => setDraft(r)}>불러오기</button>{' '}
                                    <button type="button" className="danger" onClick={() => requestDelete(r.id)}>삭제</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
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
