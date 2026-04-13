# Household Harmony

**Swedish Household Budgeting Platform** with client-side encryption, tax calculations, and LLM-powered invoice parsing.

[![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20TypeScript%20%7C%20FastAPI%20%7C%20PostgreSQL-blue?style=flat-square)](https://github.com/wahdanz1/household-harmony)
[![License](https://img.shields.io/badge/License-PolyForm%20Noncommercial-green?style=flat-square)](LICENSE)

<br/>

## Overview

Household Harmony is a household budgeting application built for Swedish households. It supports multi-user collaboration, encrypted financial data, Swedish income tax calculations, and AI-powered credit card statement parsing.

**Note:** This application is in private beta. The codebase is public for portfolio and evaluation purposes, but the database schema and production infrastructure are not included.

### Core Features

**Financial Management**
- Multi-user household collaboration with role-based access (owner/member)
- Income and expense tracking with categorization
- Subscription and insurance management with billing cycle awareness
- Co-parent expense sharing and settlement tracking
- Monthly records for historical analysis
- Dashboard with summary metrics and charts

**Client-Side Encryption**
- Two-tier key system: DEK (Data Encryption Key) + KEK (Key Encryption Key)
- AES-256-GCM encryption via Web Crypto API in the browser
- DEK stored only in browser memory — never persisted to disk
- KEK derived from user password via PBKDF2 (100,000 iterations)
- Auto-lock after 30 minutes of inactivity with warning modal

**Swedish Tax Intelligence**
- 2025 Swedish income tax brackets (progressive, standard 30%, CSN variable, tax-exempt benefits)
- Annual tax prognosis showing expected owing/refund
- Financial month awareness (configurable 25th–24th pay cycles)

**LLM Invoice Parsing**
- PDF credit card statement extraction via pdfplumber
- AI categorization using Claude, Groq, or Gemini (user-provided API keys)
- Merchant category learning with confidence levels
- Rate-limited (5 uploads/min) with 5-minute result caching

**Demo Mode**
- Ephemeral demo accounts with pre-populated Swedish household data
- All demo data encrypted using the same DEK/KEK system as real users
- Rate-limited to 5 demo accounts per hour per IP
- Auto-expiring accounts with cleanup endpoint

<br/>

## Technical Architecture

### Frontend
- **React 18** with TypeScript
- **Vite** for development and production builds
- **Tailwind CSS** + **shadcn/ui** (Radix UI primitives) for accessible UI components
- **React Router v6** for client-side routing with lazy-loaded routes
- **React Context** for state management (auth, encryption, household)
- **TanStack React Query** for server state and data fetching
- **React Hook Form** + **Zod** for form handling and validation
- **Recharts** for dashboard visualizations

### Backend
- **FastAPI** (Python 3.11+) for async API
- **uv** for dependency management
- **Pydantic v2** for request/response validation
- **cryptography** library for backend encryption (demo data seeding, API key storage)
- **pdfplumber** for PDF text extraction
- Automatic OpenAPI documentation at `/docs`

### Database & Infrastructure
- **PostgreSQL** via Supabase with Row Level Security (RLS)
- **Supabase Auth** for JWT-based authentication
- **Vercel** for frontend hosting (SPA rewrites)
- **Railway** for backend hosting (NIXPacks builder)

<br/>

## Repository Structure

```
household-harmony/
├── frontend/                 # React + TypeScript application
│   ├── src/
│   │   ├── components/      # UI components (~112 components)
│   │   ├── pages/           # Route-level page components
│   │   ├── contexts/        # React Context providers
│   │   ├── services/        # Encryption, API client
│   │   ├── utils/           # Utility functions
│   │   └── types/           # TypeScript type definitions
│   └── public/              # Static assets
│
└── backend/                  # FastAPI application
    └── app/
        ├── routers/         # API endpoint definitions
        ├── services/        # Business logic (tax, encryption, LLM, demo)
        ├── models/          # Pydantic schemas
        └── config.py        # Settings and environment
```

Database migrations and schema are not included in this public repository.

<br/>

## Development Setup

**Note:** The full application cannot be run locally without the database schema and Supabase configuration, which are not public.

### Prerequisites
- Node.js 18+ and npm
- Python 3.11+
- [uv](https://github.com/astral-sh/uv) (Python package manager)
- Supabase project with configured schema (not included)

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Runs at `http://localhost:8080`

### Backend
```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```
API docs at `http://localhost:8000/docs`

### Environment Variables

**Frontend** (`frontend/.env.local`):
```env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
VITE_BACKEND_URL=http://localhost:8000
```

**Backend** (`backend/.env`):
```env
SUPABASE_URL=your-supabase-project-url
SUPABASE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret-key
ENVIRONMENT=development
ALLOWED_ORIGINS=http://localhost:8080
```

<br/>

## Key Technical Decisions

### Why client-side encryption?
Financial data is sensitive. By encrypting on the client with a key derived from the user's password, even the database administrator cannot read the data. The DEK/KEK architecture allows password changes without re-encrypting all data.

### Why FastAPI?
Automatic OpenAPI documentation, native async support for database operations, and Pydantic for type-safe request/response validation.

### Why Supabase?
PostgreSQL with built-in authentication, Row Level Security, and a generous free tier. Simplifies auth and database management without vendor lock-in on the data layer.

### Why Tailwind + shadcn/ui?
Utility-first CSS with accessible, unstyled component primitives (Radix UI). Easy to customize and theme with dark mode support.

<br/>

## License

**PolyForm Noncommercial License 1.0.0** — free for personal and noncommercial use. See [LICENSE](LICENSE) for full terms.

<br/>

## Contact

<div align="center">

<a href="https://github.com/wahdanz1">
  <img src="https://avatars.githubusercontent.com/u/97974748?v=4" width="80px" alt="Daniel Wahlgren" style="border-radius: 50%;"/>
</a>

### Daniel Wahlgren

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/dwahlgren/)
[![Discord](https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.com/users/wahdanz#5803)
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/wahdanz1)

*For access requests or technical inquiries, reach out via Discord.*

</div>

---

<div align="center">

*Built with React • TypeScript • FastAPI • PostgreSQL*

</div>
