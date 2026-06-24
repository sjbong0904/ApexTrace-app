import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { i18nReady } from './i18n'
import { ThemeProvider } from './theme'
import SimpleWebApp from './web/SimpleWebApp.tsx'

const root = document.getElementById('root')!

i18nReady
    .then(() => {
        const isOverwolfMode = typeof window !== 'undefined' && typeof (window as any).overwolf !== 'undefined';
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
        root.innerHTML =
            '<div style="padding:24px;color:#eee;font-family:sans-serif">' +
            'Failed to load translations. Please check your connection and try again.' +
            '</div>'
    })
