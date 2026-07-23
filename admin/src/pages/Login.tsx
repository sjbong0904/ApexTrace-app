import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const { error: signError } = await supabase.auth.signInWithPassword({ email, password });
        if (signError) setError(signError.message);
        setBusy(false);
    };

    return (
        <div className="login-wrap">
            <div className="login-card">
                <h2>Apex Trace Admin</h2>
                <p className="muted">팀 계정으로 로그인하세요. admin_users 허용 목록에 등록된 이메일만 접근할 수 있습니다.</p>
                <form onSubmit={onSubmit}>
                    <label>
                        Email
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </label>
                    <label>
                        Password
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </label>
                    {error && <div className="error">{error}</div>}
                    <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
                </form>
            </div>
        </div>
    );
}
