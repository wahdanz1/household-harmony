# Household Harmony

**Swedish Household Budgeting Platform** with intelligent tax calculations and smart financial defaults.

[![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20TypeScript%20%7C%20FastAPI%20%7C%20PostgreSQL-blue?style=flat-square)](https://github.com/wahdanz1/household-harmony)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=flat-square)](LICENSE)

<br/>

## Overview

Household Harmony is a production-grade household budgeting application designed specifically for Swedish households. Built with modern full-stack architecture, it features intelligent tax calculations, smart financial defaults, and multi-user collaboration capabilities.

**Note:** This application is in private beta with controlled access. The codebase is public for portfolio and evaluation purposes, but the database schema and production infrastructure are not included in this repository.

### Core Features

**Financial Management**
- Multi-user household collaboration with role-based access
- Income and expense tracking with automatic categorization
- Subscription management with quarterly and annual billing awareness
- Insurance tracking with annualized cost calculations
- Co-parent expense sharing and settlement tracking

**Swedish Tax Intelligence**
- Built-in Swedish tax calculations and prognosis
- Automatic tax bracket adjustments
- Financial month awareness (25th-24th cycles)
- Municipal tax integration

**Smart Defaults System**
- Static vs. dynamic expense detection (variance analysis)
- 3-month rolling averages for variable costs
- Historical data-based suggestions
- Intelligent auto-fill for recurring expenses

**User Experience**
- Responsive design optimized for desktop and mobile
- Dark mode interface
- Real-time data synchronization
- Progressive web app capabilities

<br/>

## Technical Architecture

### Frontend
- **React 18** with TypeScript for type-safe development
- **Vite** for fast development and optimized production builds
- **Tailwind CSS** + **shadcn/ui** for consistent, accessible UI components
- **React Router** for client-side routing
- **Zustand** for lightweight state management

### Backend
- **FastAPI** (Python 3.11+) for high-performance async API
- **uv** for dependency management and virtual environments
- RESTful API design with automatic OpenAPI documentation
- JWT-based authentication with secure session handling

### Database & Infrastructure
- **PostgreSQL** (via Supabase) with Row Level Security (RLS)
- Real-time subscriptions for collaborative features
- Optimized indexes for financial queries
- Database functions for complex calculations

### Deployment
- **Vercel** for frontend hosting with edge optimization
- **Railway** for backend API with automatic scaling
- **GitHub Actions** for CI/CD pipeline
- Monorepo structure with isolated deployment configurations

---

## Repository Structure

```
household-harmony/
├── frontend/                 # React + TypeScript application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Route-level page components
│   │   ├── contexts/        # React Context providers
│   │   ├── utils/           # Utility functions and helpers
│   │   └── types/           # TypeScript type definitions
│   └── public/              # Static assets
│
└── backend/                  # FastAPI application
    ├── app/
    │   ├── routes/          # API endpoint definitions
    │   ├── services/        # Business logic layer
    │   ├── models/          # Data models and schemas
    │   └── utils/           # Backend utilities
    └── tests/               # Backend test suite
```

**Note:** This is a monorepo with separate deployment configurations for Vercel (frontend) and Railway (backend). Database migrations and schema are not included in this public repository.

<br/>

## Development Overview

This section provides an overview of the development setup. **Note that the full application cannot be run locally without the complete database schema and configuration, which are not public.**

### Prerequisites
- Node.js 18+ and npm
- Python 3.11+
- [uv](https://github.com/astral-sh/uv) (Python package manager)
- Supabase project with configured schema (not included)

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```
Application runs at `http://localhost:8080`

### Backend Development
```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```
API documentation available at `http://localhost:8000/docs`

### Environment Configuration

Environment variables are required but not sufficient for local setup without the database schema.

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

## Database Design

The application uses PostgreSQL with a comprehensive schema designed for household financial management:

**Core Entities:**
- User profiles and authentication
- Household management with multi-user support
- Income sources with type classification (static/variable)
- Expense tracking (regular, subscriptions, insurance)
- Monthly records for historical analysis
- Savings goals and progress tracking

**Key Features:**
- Row Level Security (RLS) for data isolation
- Database functions for smart defaults and calculations
- Optimized indexes for query performance
- Real-time subscriptions for collaborative features

*Database migrations and complete schema are available upon request for technical evaluation.*

<br/>

## Key Technical Decisions

### Why FastAPI?
- Automatic API documentation with OpenAPI/Swagger
- Native async/await support for database operations
- Type hints with Pydantic for request/response validation
- High performance comparable to Node.js and Go

### Why Supabase?
- PostgreSQL with built-in authentication and RLS
- Real-time subscriptions for collaborative features
- Automatic API generation from database schema
- Simplified deployment and scaling

### Why Tailwind + shadcn/ui?
- Utility-first CSS for rapid development
- No runtime JavaScript overhead
- Accessible components out of the box
- Easy customization and theming

### Why Monorepo?
- Shared TypeScript types between frontend and backend
- Atomic commits across full-stack features
- Single source of truth for version control
- Simplified CI/CD with GitHub Actions

<br/>

## Production Deployment

This application uses a monorepo structure with separate deployments:

### Frontend (Vercel)
- Root directory: `frontend`
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

### Backend (Railway)
- Root directory: `backend`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Python runtime with uv

Environment variables are configured in respective deployment platforms.

<br/>

## Development Roadmap

**Current Focus:**
- CSV import wizard for bulk data entry
- Planning page for multi-month financial forecasting
- Enhanced subscription warning system
- Dashboard metric improvements

**Planned Features:**
- Bill splitting algorithms for shared households
- Receipt scanning with OCR
- Bank integration (via Tink API)
- Budget vs. actual variance reporting
- Export functionality for record-keeping

<br/>

## Security & Privacy

- JWT-based authentication with secure session handling
- Row Level Security (RLS) for all database operations
- Password hashing with bcrypt
- CORS configuration for cross-origin security
- Environment-based secret management
- Regular dependency updates and security audits
- Controlled access with email whitelist

<br/>

## Code Quality

- TypeScript for type safety across frontend and backend
- ESLint and Prettier for code consistency
- Component-driven development with shadcn/ui
- RESTful API design principles
- Comprehensive error handling
- Database query optimization

<br/>

## License

**Copyright © 2024-2025 Daniel Wahlgren. All Rights Reserved.**

This software is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited without express written permission from the copyright holder.

This repository is publicly visible for evaluation and portfolio demonstration purposes only.

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

*For access requests, technical inquiries, or collaboration opportunities, reach out via Discord.*

</div>

---

<div align="center">

*Full-stack development • React • TypeScript • FastAPI • PostgreSQL*

</div>