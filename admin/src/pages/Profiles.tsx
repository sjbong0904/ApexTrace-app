import { useState } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import { adminGet, adminMutate } from '../lib/api';

const ROLE_PRESETS = ['', 'dev', 'pro', 'tester', 'contributor'];

type Profile = Record<string, unknown> & { uid: string };

export default function ProfilesPage() {
    const [q, setQ] = useState('');
    const [role, setRole] = useState('');
    const [rows, setRows] = useState<Profile[]>([]);
    const [count, setCount] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<Profile | null>(null);
    const [draft, setDraft] = useState('');
    const [pending, setPending] = useState<Record<string, unknown> | null>(null);
    const [busy, setBusy] = useState(false);

    const search = async () => {
        setError(null);
        try {
            const res = await adminGet<{ data: Profile[]; count: number }>('/api/admin/profiles', {
                q: q || undefined,
                role: role || undefined,
                limit: 100,
            });
            setRows(res.data);
            setCount(res.count);
        } catch (e) {
            setError((e as Error).message);
        }
    };

    const openEdit = (row: Profile) => {
        setSelected(row);
        setDraft(JSON.stringify(row, null, 2));
    };

    const requestApply = () => {
        if (!selected) return;
        try {
            const parsed = JSON.parse(draft) as Profile;
            const { uid, updated_at: _u, ...patch } = parsed;
            setPending({ uid: selected.uid, patch });
        } catch {
            setError('Invalid JSON');
        }
    };

    const confirmApply = async () => {
        if (!pending) return;
        setBusy(true);
        setError(null);
        try {
            await adminMutate('/api/admin/profiles', 'PATCH', pending);
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
            <h2>유저 주소록</h2>
            <div className="panel">
                <div className="row">
                    <label>
                        검색 (name / uid)
                        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="닉네임 또는 UID" />
                    </label>
                    <label>
                        Role
                        <select value={role} onChange={(e) => setRole(e.target.value)}>
                            {ROLE_PRESETS.map((r) => (
                                <option key={r || 'all'} value={r}>{r || '(all)'}</option>
                            ))}
                        </select>
                    </label>
                    <button type="button" onClick={search}>검색</button>
                </div>
                <div className="muted">{count} results</div>
                {error && <div className="error">{error}</div>}
            </div>

            <div className="panel" style={{ overflowX: 'auto' }}>
                <table>
                    <thead>
                        <tr>
                            <th>name</th>
                            <th>uid</th>
                            <th>role</th>
                            <th>rank</th>
                            <th>level</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.uid}>
                                <td>{String(r.name ?? '')}</td>
                                <td><code>{r.uid}</code></td>
                                <td>{String(r.role ?? '')}</td>
                                <td>{String(r.rank_name ?? '')} ({String(r.rank_score ?? '')})</td>
                                <td>{String(r.level ?? '')}</td>
                                <td><button type="button" className="secondary" onClick={() => openEdit(r)}>편집</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {selected && (
                <div className="panel">
                    <h3>편집: {selected.uid}</h3>
                    <p className="muted">role 프리셋: {ROLE_PRESETS.filter(Boolean).join(', ')} (또는 커스텀 문자열)</p>
                    <textarea value={draft} onChange={(e) => setDraft(e.target.value)} style={{ minHeight: 320 }} />
                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                        <button type="button" className="secondary" onClick={() => setSelected(null)}>닫기</button>
                        <button type="button" onClick={requestApply}>적용</button>
                    </div>
                </div>
            )}

            <ConfirmModal
                open={!!pending}
                title="프로필 변경 최종 확인"
                summary={pending}
                busy={busy}
                onCancel={() => setPending(null)}
                onConfirm={confirmApply}
            />
        </div>
    );
}
