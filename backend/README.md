# Household Harmony Backend API

FastAPI backend for Household Harmony budgeting app with Swedish tax intelligence and smart defaults.

## Features

- **Swedish Tax Calculator**: Supports 4 tax types (no_tax, standard_30, progressive, csn_variable)
- **Smart Defaults**: Auto-suggests income/expense amounts based on historical data
- **PostgreSQL Functions**: Leverages database-level calculations for performance

## Setup

1. **Install dependencies:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

3. **Run locally:**
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

4. **Access API docs:**
   - Swagger UI: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

## API Endpoints

### Health
- `GET /health` - Health check

### Tax Calculator
- `POST /api/tax/calculate` - Calculate monthly tax
- `POST /api/tax/prognosis` - Calculate annual tax prognosis

### Smart Defaults
- `GET /api/defaults/income/{household_id}` - Get income suggestions
- `GET /api/defaults/expenses/{household_id}` - Get expense suggestions

## Deployment (Railway)

1. Connect your GitHub repo to Railway
2. Set environment variables in Railway dashboard
3. Railway will auto-deploy on push to main/staging

## Testing

```bash
pytest tests/ -v
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
├── tests/                   # Unit tests
├── requirements.txt
└── .env.example
```
