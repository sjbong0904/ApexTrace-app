# Apex Trace Admin

Separate Vercel web app for team admins.

## Setup

1. Create Supabase Auth users for teammates (Email/Password).
2. Insert allowlisted emails:

```sql
insert into public.admin_users (email) values ('you@example.com');
```

3. Ensure `trace-proxy-server` has env:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY` (service role)
4. Admin env (optional overrides):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_PROXY_URL` (default `https://trace-proxy-server.vercel.app`)

## Local

```bash
cd admin
npm install
npm run dev
```

## Deploy

Deploy the `admin/` folder as its own Vercel project (Root Directory = `admin`).

Production URL (current): https://admin-dun-three.vercel.app

Proxy admin API (catch-all): `https://trace-proxy-server.vercel.app/api/admin/{profiles|matches|weapons|seasons|languages}`
