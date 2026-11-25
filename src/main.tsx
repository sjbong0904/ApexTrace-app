import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { i18nReady } from './i18n'
import { ThemeProvider } from './theme'
import SimpleWebApp from './web/SimpleWebApp.tsx'
import { startImageCache } from './utils/imageSource'
import { initBootShell, showBootError } from './bootShell'

const root = document.getElementById('root')!
// index.html's boot shell is on screen until React renders over it; make its title bar work now.
initBootShell()

Promise.all([i18nReady, startImageCache()])
    .then(() => {
        const isOverwolfMode = typeof window !== 'undefined' && typeof (window as { overwolf?: unknown }).overwolf !== 'undefined';
        createRoot(root).render(
            <StrictMode>
                <ThemeProvider>
                    {isOverwolfMode ? <App /> : <SimpleWebApp />}
                </ThemeProvider>
            </StrictMode>,
        )
    })
    .catch((err) => {
        console.error(err)
        // Usually first launch offline (no cached language pack): keep the boot shell, show retry.
        showBootError()
    })
