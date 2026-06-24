const CONFIG = {
    PROXY_BASE_URL: "https://trace-proxy-server.vercel.app/api"
};

window.CONFIG = CONFIG;
window.PROXY_BASE_URL = window.PROXY_BASE_URL || CONFIG.PROXY_BASE_URL;