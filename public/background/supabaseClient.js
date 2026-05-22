// src/background/supabaseClient.js
// 프록시 서버 사용으로 인해 클라이언트 라이브러리는 비활성화됨.
window._supabase = null;
console.log("ℹ️ Supabase Client disabled (Using Proxy Mode)");