import { useEffect, useState } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import { adminGet, adminMutate } from '../lib/api';

type LangPack = {
    lang: string;
    display_name: string;
    version: number;
    is_active: boolean;
    is_default: boolean;
    strings: Record<string, unknown>;
};

export default function LanguagesPage() {
    const [packs, setPacks] = useState<LangPack[]>([]);
    const [lang, setLang] = useState('en');
    const [displayName, setDisplayName] = useState('English');
    const [draft, setDraft] = useState('{}');
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState<Record<string, unknown> | null>(null);
    const [busy, setBusy] = useState(false);

    const load = async () => {
        setError(null);
        try {
            const res = await adminGet<{ data: LangPack[] }>('/api/admin/languages');
            setPacks(res.data);
            const current = res.data.find((p) => p.lang === lang) || res.data[0];
            if (current) {
                setLang(current.lang);
                setDisplayName(current.display_name);
                setDraft(JSON.stringify(current.strings || {}, null, 2));
            }
        } catch (e) {
            setError((e as Error).message);
        }
    };

    useEffect(() => { void load(); }, []);

    const selectLang = (code: string) => {
        const pack = packs.find((p) => p.lang === code);
        setLang(code);
        if (pack) {
            setDisplayName(pack.display_name);
            setDraft(JSON.stringify(pack.strings || {}, null, 2));
        }
    };

    const requestPublish = () => {
        try {
            const strings = JSON.parse(draft);
            setPending({
                lang,
                display_name: displayName,
                strings,
                bump_version: true,
                is_active: true,
            });
        } catch {
            setError('Invalid JSON');
        }
    };

    const confirmApply = async () => {
        if (!pending) return;
        setBusy(true);
        setError(null);
        try {
            await adminMutate('/api/admin/languages', 'POST', pending);
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
            <h2>로케일</h2>
            {error && <div className="error panel">{error}</div>}
            <div className="panel">
                <div className="row">
                    <label>
                        Language
                        <select value={lang} onChange={(e) => selectLang(e.target.value)}>
                            {packs.map((p) => (
                                <option key={p.lang} value={p.lang}>
                                    {p.lang} (v{p.version})
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Display name
                        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                    </label>
                    <button type="button" className="secondary" onClick={load}>새로고침</button>
                    <button type="button" onClick={requestPublish}>Publish</button>
                </div>
            </div>
            <div className="panel">
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} style={{ minHeight: 480 }} />
            </div>
            <ConfirmModal
                open={!!pending}
                title="로케일 Publish 최종 확인"
                summary={{ lang: pending?.lang, display_name: pending?.display_name, bump_version: true }}
                busy={busy}
                onCancel={() => setPending(null)}
                onConfirm={confirmApply}
            />
        </div>
    );
}
