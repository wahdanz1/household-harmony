# Household Harmony - Monorepo

**Swedish Household Budgeting App** with Tax Intelligence & Smart Defaults

## 📁 Structure

```
household-harmony/
├── frontend/          # React + Vite frontend → Deploy to Vercel
├── backend/           # FastAPI backend → Deploy to Railway
└── supabase/         # Database migrations (shared)
```

## 🚀 Quick Start

### Frontend Development
```bash
cd frontend
npm install
npm run dev          # http://localhost:8080
```

### Backend Development
```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

## 📦 Deployment

### Vercel (Frontend)
- **Root Directory:** `frontend`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Framework:** Vite
- **Deploy:** Connect GitHub repo, Vercel auto-detects config

### Railway (Backend)
- **Root Directory:** `backend`
- **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Builder:** NIXPACKS
- **Deploy:** Connect GitHub repo, Railway uses `railway.json`

## 🔐 Environment Variables

### Frontend (`.env.local`)
```env
VITE_SUPABASE_URL=https://pksyokumflsyvjcmtjmv.supabase.co
VITE_SUPABASE_ANON_KEY=your-key
VITE_SUPABASE_PROJECT_ID=pksyokumflsyvjcmtjmv
VITE_BACKEND_URL=https://your-backend.railway.app
```

### Backend (`.env`)
```env
SUPABASE_URL=https://pksyokumflsyvjcmtjmv.supabase.co
SUPABASE_KEY=your-key
JWT_SECRET=your-secret
ENVIRONMENT=production
ALLOWED_ORIGINS=https://household-harmony.vercel.app
```

## 🛠️ Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** FastAPI, Python 3.11+, uv
- **Database:** Supabase (PostgreSQL)
