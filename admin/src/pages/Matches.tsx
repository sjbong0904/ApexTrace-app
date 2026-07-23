import { useState } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import { adminGet, adminMutate } from '../lib/api';

type MatchRow = Record<string, unknown> & { uid: string; match_id: string };

export default function MatchesPage() {
    const [uid, setUid] = useState('');
    const [matchId, setMatchId] = useState('');
    const [mode, setMode] = useState('');
    const [map, setMap] = useState('');
    const [rows, setRows] = useState<MatchRow[]>([]);
    const [count, setCount] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<MatchRow | null>(null);
    const [draft, setDraft] = useState('');
    const [pending, setPending] = useState<{ kind: 'patch' | 'delete'; body: Record<string, unknown> } | null>(null);
    const [busy, setBusy] = useState(false);

    const search = async () => {
        setError(null);
        try {
            const res = await adminGet<{ data: MatchRow[]; count: number }>('/api/admin/matches', {
                uid: uid || undefined,
                match_id: matchId || undefined,
                mode: mode || undefined,
                map: map || undefined,
                limit: 100,
            });
            setRows(res.data);
            setCount(res.count);
        } catch (e) {
            setError((e as Error).message);
        }
    };

    const openEdit = (row: MatchRow) => {
        setSelected(row);
        setDraft(JSON.stringify(row, null, 2));
    };

    const requestPatch = () => {
        if (!selected) return;
        try {
            const parsed = JSON.parse(draft) as MatchRow;
            const { uid: _u, match_id: _m, ...patch } = parsed;
            setPending({
                kind: 'patch',
                body: { uid: selected.uid, match_id: selected.match_id, patch },
            });
        } catch {
            setError('Invalid JSON');
        }
    };

    const requestDelete = (row: MatchRow) => {
        setPending({
            kind: 'delete',
            body: { uid: row.uid, match_id: row.match_id },
        });
    };

    const confirmApply = async () => {
        if (!pending) return;
        setBusy(true);
        setError(null);
        try {
            if (pending.kind === 'patch') {
                await adminMutate('/api/admin/matches', 'PATCH', pending.body);
            } else {
                await adminMutate('/api/admin/matches', 'POST', { ...pending.body, action: 'delete' });
            }
            setPending(null);
            setSelected(null);
            await search();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <h2>매치 히스토리</h2>
            <div className="panel">
                <div className="row">
                    <label>uid<input value={uid} onChange={(e) => setUid(e.target.value)} /></label>
                    <label>match_id<input value={matchId} onChange={(e) => setMatchId(e.target.value)} /></label>
                    <label>mode<input value={mode} onChange={(e) => setMode(e.target.value)} /></label>
                    <label>map<input value={map} onChange={(e) => setMap(e.target.value)} /></label>
                    <button type="button" onClick={search}>검색</button>
                </div>
                <div className="muted">{count} results</div>
                {error && <div className="error">{error}</div>}
            </div>

            <div className="panel" style={{ overflowX: 'auto' }}>
                <table>
                    <thead>
                        <tr>
                            <th>start</th>
                            <th>uid</th>
                            <th>match_id</th>
                            <th>mode</th>
                            <th>map</th>
                            <th>legend</th>
                            <th>k/a/d</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={`${r.uid}:${r.match_id}`}>
                                <td>{r.start_time ? new Date(Number(r.start_time)).toISOString() : ''}</td>
                                <td><code>{r.uid}</code></td>
                                <td><code>{r.match_id}</code></td>
                                <td>{String(r.mode ?? '')}</td>
                                <td>{String(r.map ?? '')}</td>
                                <td>{String(r.legend ?? '')}</td>
                                <td>{String(r.kills ?? 0)}/{String(r.assists ?? 0)}/{String(r.deaths ?? '-')}</td>
                                <td style={{ whiteSpace: 'nowrap' }}>
                                    <button type="button" className="secondary" onClick={() => openEdit(r)}>편집</button>{' '}
                                    <button type="button" className="danger" onClick={() => requestDelete(r)}>삭제</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {selected && (
                <div className="panel">
                    <h3>편집: {selected.match_id}</h3>
                    <textarea value={draft} onChange={(e) => setDraft(e.target.value)} style={{ minHeight: 360 }} />
                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                        <button type="button" className="secondary" onClick={() => setSelected(null)}>닫기</button>
                        <button type="button" onClick={requestPatch}>적용</button>
                    </div>
                </div>
            )}

            <ConfirmModal
                open={!!pending}
                title={pending?.kind === 'delete' ? '매치 삭제 최종 확인' : '매치 수정 최종 확인'}
                summary={pending}
                busy={busy}
                onCancel={() => setPending(null)}
                onConfirm={confirmApply}
            />
        </div>
    );
}
