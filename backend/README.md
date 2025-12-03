# Household Harmony Backend API

FastAPI backend for Household Harmony budgeting app with Swedish tax intelligence and smart defaults.

## Features

- **Swedish Tax Calculator**: Supports 4 tax types (no_tax, standard_30, progressive, csn_variable)
- **Smart Defaults**: Auto-suggests income/expense amounts based on historical data
- **PostgreSQL Functions**: Leverages database-level calculations for performance

## Setup with UV (Recommended)

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Sync dependencies:**
   ```bash
   uv sync
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials:
   # - SUPABASE_URL (from Supabase dashboard)
   # - SUPABASE_KEY (anon/public key)
   # - JWT_SECRET (from Supabase Auth settings)
   ```

4. **Run development server:**
   ```bash
   uv run uvicorn app.main:app --reload --port 8000
   ```

5. **Access API docs:**
   - Swagger UI: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

## Adding Dependencies

```bash
# Add a new package
uv add package-name

# Add a dev dependency
uv add --dev pytest-cov

# Sync after pulling changes
uv sync
```

## API Endpoints

### Health
- `GET /health` - Health check

### Tax Calculator
- `POST /api/tax/calculate` - Calculate monthly tax
  ```json
  {
    "gross_monthly": 30000,
    "tax_type": "progressive",
    "custom_rate": null
  }
  ```

- `POST /api/tax/prognosis` - Calculate annual tax prognosis
  ```json
  {
    "income_sources": [
      {
        "gross_monthly": 22404,
        "tax_type": "progressive",
        "tax_deducted": 7169
      }
    ]
  }
  ```

### Smart Defaults
- `GET /api/defaults/income/{household_id}` - Get income suggestions
- `GET /api/defaults/expenses/{household_id}` - Get expense suggestions

## Deployment (Railway)

1. **Connect GitHub repo** to Railway
2. **Set environment variables** in Railway dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `JWT_SECRET`
   - `ALLOWED_ORIGINS` (your frontend URL)
3. **Railway will auto-detect** `pyproject.toml` and deploy with `uv`
4. **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

## Testing

```bash
# Run all tests
uv run pytest

# Run with coverage
uv run pytest --cov=app tests/
```

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app
│   ├── config.py            # Environment settings
│   ├── database.py          # Supabase client
│   ├── services/            # Business logic
│   │   ├── tax_calculator.py
│   │   └── smart_defaults.py
│   └── routers/             # API routes
│       ├── health.py
│       ├── tax.py
│       └── smart_defaults.py
├── tests/                   # Unit tests (TODO)
├── pyproject.toml          # UV dependencies
├── uv.lock                 # Lock file (auto-generated)
└── .env.example            # Environment template
```

## Troubleshooting

**Port already in use:**
```bash
# Use a different port
uv run uvicorn app.main:app --reload --port 8001
```

**Import errors:**
```bash
# Re-sync dependencies
uv sync --reinstall
```

**CORS errors:**
- Add your frontend URL to `ALLOWED_ORIGINS` in `.env`
- Format: `http://localhost:8080,http://localhost:5173`
