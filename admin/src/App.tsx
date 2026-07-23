import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import LoginPage from './pages/Login';
import ProfilesPage from './pages/Profiles';
import MatchesPage from './pages/Matches';
import WeaponsPage from './pages/Weapons';
import SeasonsPage from './pages/Seasons';
import LanguagesPage from './pages/Languages';

type Tab = 'profiles' | 'matches' | 'weapons' | 'seasons' | 'languages';

export default function App() {
    const [session, setSession] = useState<Session | null>(null);
    const [ready, setReady] = useState(false);
    const [tab, setTab] = useState<Tab>('profiles');

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            setReady(true);
        });
        const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
            setSession(next);
        });
        return () => sub.subscription.unsubscribe();
    }, []);

    if (!ready) return <div className="login-wrap muted">Loading…</div>;
    if (!session) return <LoginPage />;

    return (
        <div className="layout">
            <nav>
                <h1>Apex Trace Admin</h1>
                <button type="button" className={`nav-link ${tab === 'profiles' ? 'active' : ''}`} onClick={() => setTab('profiles')}>
                    유저 주소록
                </button>
                <button type="button" className={`nav-link ${tab === 'matches' ? 'active' : ''}`} onClick={() => setTab('matches')}>
                    매치 히스토리
                </button>
                <button type="button" className={`nav-link ${tab === 'weapons' ? 'active' : ''}`} onClick={() => setTab('weapons')}>
                    무기 DB
                </button>
                <button type="button" className={`nav-link ${tab === 'seasons' ? 'active' : ''}`} onClick={() => setTab('seasons')}>
                    시즌
                </button>
                <button type="button" className={`nav-link ${tab === 'languages' ? 'active' : ''}`} onClick={() => setTab('languages')}>
                    로케일
                </button>
                <div style={{ flex: 1 }} />
                <div className="muted" style={{ fontSize: 12, wordBreak: 'break-all' }}>{session.user.email}</div>
                <button type="button" className="secondary" onClick={() => supabase.auth.signOut()}>
                    Sign out
                </button>
            </nav>
            <main>
                {tab === 'profiles' && <ProfilesPage />}
                {tab === 'matches' && <MatchesPage />}
                {tab === 'weapons' && <WeaponsPage />}
                {tab === 'seasons' && <SeasonsPage />}
                {tab === 'languages' && <LanguagesPage />}
            </main>
        </div>
    );
}
