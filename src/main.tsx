import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { i18nReady } from './i18n'

const root = document.getElementById('root')!

i18nReady
    .then(() => {
        createRoot(root).render(
            <StrictMode>
                <App />
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
