# Future Improvements & Feature Requests

## Priority: Medium - Financial Month Migration

### Problem
When a user changes `financial_month_start` setting (e.g., from 27 to 25), existing `monthly_incomes` and `monthly_expenses` records retain their old `month_start` and `month_end` dates. This can cause:
- Data appearing in wrong financial months
- Confusion when viewing historical data
- Potential duplicate records if not handled carefully

### Solution (3 Phases)

#### Phase 1: Onboarding Financial Month Selector ✅ (Simple)
**Where**: During household creation flow
**What**:
- Show clear financial month start selector (default: 25)
- Explanation: "When does your financial month start? (Usually your payday)"
- Warning: "This affects when income/expenses are pre-filled each month"
- Once set, show note: "You can change this later in Settings, but existing data will need migration"

**Files to modify**:
- Household creation flow (wherever new households are created)
- Add validation: 1-28 only

#### Phase 2: Migration Function ⚠️ (Medium Complexity)
**Where**: `HouseholdInfoCard.tsx` handleSaveName function
**What**: When `financial_month_start` is updated, migrate all existing monthly records

**Implementation**:
```typescript
const migrateMonthlyRecords = async (
  householdId: string, 
  oldMonthStart: number, 
  newMonthStart: number
) => {
  // 1. Fetch all monthly_incomes and monthly_expenses for household
  const [incomes, expenses] = await Promise.all([
    supabase.from("monthly_incomes").select("*").eq("household_id", householdId),
    supabase.from("monthly_expenses").select("*").eq("household_id", householdId)
  ]);
  
  // 2. For each record:
  const migrateRecord = (record: any) => {
    // Parse the 'month' field (YYYY-MM-DD format)
    const monthDate = parseISO(record.month);
    
    // Recalculate month_start and month_end using newMonthStart
    const newMonthValue = getCurrentFinancialMonth(newMonthStart);
    const { start: newStart, end: newEnd } = getFinancialMonthRange(newMonthValue, newMonthStart);
    
    return {
      ...record,
      month: newMonthValue,
      month_start: format(newStart, "yyyy-MM-dd"),
      month_end: format(newEnd, "yyyy-MM-dd")
    };
  };
  
  // 3. Batch update
  const migratedIncomes = incomes.data?.map(migrateRecord) || [];
  const migratedExpenses = expenses.data?.map(migrateRecord) || [];
  
  await Promise.all([
    supabase.from("monthly_incomes").upsert(migratedIncomes),
    supabase.from("monthly_expenses").upsert(migratedExpenses)
  ]);
};
```

**Edge Cases to Handle**:
- What if current date falls in a different period after migration?
- Should we migrate ALL historical data or just current/future months?
- Handle potential duplicates (same source/category in overlapping periods)

#### Phase 3: User Warnings & Confirmation Dialog 🎯 (Best UX)
**Where**: Settings page, before saving financial_month_start change
**What**: Show confirmation dialog with impact assessment

**Dialog Content**:
```
⚠️ Change Financial Month Start?

Current: 27th → New: 25th

This will affect:
• 3 income sources with 12 monthly records
• 8 expense categories with 96 monthly records

All existing monthly data will be recalculated to match the new period boundaries.

Historical data will be preserved, but may appear in different financial months.

[Cancel] [Migrate & Update]
```

**Implementation**:
- Count affected records before showing dialog
- Show loading indicator during migration
- Show success/error toast after migration
- Automatically refresh all pages after migration

### Files to Modify
- `frontend/src/components/settings/HouseholdInfoCard.tsx` - Add migration logic
- `frontend/src/utils/dateUtils.ts` - Add migration helper functions
- `frontend/src/contexts/HouseholdContext.tsx` - Trigger refresh after migration
- Database schema - Ensure proper indexing for migration queries

### Testing Checklist
- [ ] Create household with month_start = 27
- [ ] Add multiple income sources and expenses
- [ ] Create monthly records for 2-3 months
- [ ] Change month_start to 25
- [ ] Verify all monthly records have correct new month_start/month_end
- [ ] Verify Dashboard shows correct data
- [ ] Verify Income/Expenses pages show correct data
- [ ] Test edge case: Change during month transition (e.g., on the 26th)

### Risks
- **Data Loss**: If migration fails mid-process, could corrupt monthly records
- **Performance**: Large households with 100+ monthly records might timeout
- **Timezone Issues**: Date calculations might behave differently across timezones

### Mitigation
1. **Transaction Support**: Wrap entire migration in Supabase transaction (if supported)
2. **Backup**: Create snapshot before migration
3. **Batch Processing**: Process records in chunks of 100
4. **Rollback**: Keep old values and provide "Undo" option for 1 hour

---

## Priority: High - BankID Integration

### Overview
Add Swedish BankID authentication as an alternative/primary login method.

### Requirements
- Research BankID API/SDK for web applications
- Determine if Supabase supports BankID auth providers
- May need custom auth flow with backend

### Resources
- [BankID Technical Documentation](https://www.bankid.com/utvecklare/rp-info)
- Supabase Custom Auth Providers

---

## Priority: High - CSV Import Wizard

**Context:**
Build a new user onboarding wizard that parses Swedish bank CSV exports to automatically populate income sources and expenses. The system uses a smart categorization approach: first check a learned mapping table, then fallback to LLM for unknown transactions.

---

### **Backend Tasks:**

**1. Database Schema - Transaction Mappings Table**
```sql
CREATE TABLE transaction_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_name text NOT NULL,
  normalized_name text NOT NULL, -- lowercase, trimmed
  category expense_category,
  category_type text, -- 'income' or 'expense' or 'subscription'
  confidence integer DEFAULT 1, -- how many times confirmed
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_transaction_mappings_normalized 
ON transaction_mappings(normalized_name);
```

**2. Backend Endpoints - `/backend/app/routers/csv_import.py`**

Create new router with these endpoints:

**A. Parse CSV:**
```python
POST /api/csv/parse
- Accept multipart/form-data CSV upload
- Auto-detect: delimiter (comma/semicolon), encoding (UTF-8/ISO-8859-1)
- Handle Swedish decimal format (1.234,56 → 1234.56)
- Return parsed transactions:
{
  "transactions": [
    {
      "date": "2024-12-01",
      "description": "ICA Maxi Göteborg",
      "amount": -234.50,
      "type": "expense" // or "income" based on amount sign
    }
  ],
  "stats": {
    "total_transactions": 145,
    "income_count": 12,
    "expense_count": 133,
    "date_range": {"start": "2024-01-01", "end": "2024-12-01"}
  }
}
```

**B. Categorize Transactions:**
```python
POST /api/csv/categorize
Body: { "transactions": [...] }

Logic:
1. For each transaction:
   - Normalize merchant name (lowercase, trim)
   - Query transaction_mappings table
   - If match found with confidence > 2 → use that category
   - If no match OR confidence ≤ 2 → call Claude API for categorization
   
2. Claude prompt:
   "Categorize this Swedish transaction: '{description}' 
    Amount: {amount} SEK
    Available categories: groceries, rent, electricity, transport, etc.
    Respond ONLY with category name."

3. Return:
{
  "categorized": [
    {
      "description": "ICA Maxi",
      "amount": -234.50,
      "category": "groceries",
      "source": "database", // or "llm"
      "confidence": 5
    }
  ]
}
```

**C. Create Items from Transactions:**
```python
POST /api/csv/create-items
Body: {
  "household_id": "uuid",
  "categorized_transactions": [...],
  "user_confirmations": {...} // user-edited categories
}

Logic:
1. Group transactions by merchant/category
2. Identify recurring items (appears 3+ times)
3. Create:
   - income_sources for positive amounts
   - regular_expenses for recurring expenses
   - subscriptions for monthly recurring (same amount ±5%)
   
4. Calculate default_amount:
   - Static type: most common amount
   - Variable type: average of all amounts
   
5. Insert into transaction_mappings (upsert, increment confidence)
6. Return created items
```

**3. CSV Parsing Service - `/backend/app/services/csv_parser.py`**

```python
class CSVParser:
    def parse(self, file_content: bytes) -> dict:
        # Try encodings: utf-8, iso-8859-1, windows-1252
        # Try delimiters: comma, semicolon, tab
        # Handle Swedish decimals: decimal=',', thousands='.'
        # Parse dates (multiple formats: YYYY-MM-DD, DD/MM/YYYY, etc)
        # Filter out reserved transactions
        # Return normalized transaction list
```

---

### **Frontend Tasks:**

**4. Create Wizard Route - `/frontend/src/pages/Onboarding.tsx`**

**Multi-step wizard:**
- Step 1: Welcome + User Type Selection
- Step 2: CSV Upload
- Step 3: Transaction Review & Categorization
- Step 4: Confirmation & Creation
- Step 5: Success & Redirect

**5. Step 1: User Type Selection**

Three cards:
```tsx
<Card>Organized 📊</Card> → Go to CSV upload
<Card>No Time ⚡</Card> → Go to CSV upload  
<Card>Manual Entry 📝</Card> → Skip to Dashboard (show tutorial)
```

**6. Step 2: CSV Upload - Component `/frontend/src/components/onboarding/CSVUpload.tsx`**

Features:
- Drag & drop zone for CSV files
- "How to export CSV from your bank" collapsible instructions
- Bank selection dropdown (Swedbank, SEB, Nordea, Handelsbanken, Other)
- Show bank-specific export instructions based on selection
- Progress indicator during upload
- Error handling with retry options:
  * "Wrong encoding? Try ISO-8859-1"
  * "Wrong delimiter? Try semicolon"

**7. Step 3: Transaction Review - Component `/frontend/src/components/onboarding/TransactionReview.tsx`**

Display:
- Summary stats (total transactions, date range, income vs expenses)
- Grouped transactions table:
  * Group by merchant
  * Show frequency, total amount, suggested category
  * Allow user to edit category
  * Color coding: 🟢 Green = database match, 🔵 Blue = LLM categorized
  * "Mark as subscription" checkbox for recurring items

**8. Step 4: Confirmation - Component `/frontend/src/components/onboarding/ConfirmCreate.tsx`**

Preview what will be created:
```
Income Sources (3):
✓ CSN (Omställningsstudiestöd) - Variable - Avg: 22,404 SEK
✓ Uddevalla Kommun - Static - 22,338 SEK
✓ Child Care (Barnbidrag) - Static - 1,325 SEK

Regular Expenses (8):
✓ Rent - Static - 9,354 SEK
✓ Groceries (ICA Maxi) - Dynamic - Avg: 5,234 SEK
✓ Electricity - Dynamic - Avg: 456 SEK
...

Subscriptions (4):
✓ Spotify - 119 SEK/month
✓ Netflix - 179 SEK/month
...
```

Buttons: "Go Back" | "Create All Items"

**9. Helper Utils:**

Create `/frontend/src/utils/csvHelpers.ts`:
- `normalizeAmount(swedishFormat: string): number`
- `detectFileEncoding(file: File): Promise<string>`
- `groupTransactionsByMerchant(transactions: []): grouped[]`
- `identifyRecurring(transactions: []): recurring[]`

**10. API Client Updates:**

Add to `/frontend/src/lib/api.ts`:
```typescript
export const csvAPI = {
  parseCSV: (file: File) => POST /api/csv/parse,
  categorizeTransactions: (transactions) => POST /api/csv/categorize,
  createItems: (data) => POST /api/csv/create-items
};
```

---

### **UI/UX Requirements:**

**Error States:**
- Invalid file format → "Please upload a CSV file"
- Parse failure → Show error + retry with different settings
- Categorization failure → Allow manual category selection
- Empty file → "No transactions found in this file"

**Loading States:**
- Uploading → Progress bar
- Parsing → "Analyzing your transactions..."
- Categorizing → "AI is categorizing 145 transactions..." (with count)
- Creating → "Creating income sources and expenses..."

**Success States:**
- Parse complete → Show transaction count
- Categorization complete → Show matched vs LLM categorized ratio
- Items created → Show summary of what was created

**Bank Export Instructions (expandable):**

For each bank, provide:
1. Login to netbank
2. Go to "Transactions" or "Account Statement"
3. Select date range (last 12 months)
4. Export as CSV
5. Screenshot examples

---

### **Technical Constraints:**

- Use `pandas` for CSV parsing in backend
- Use Anthropic Claude API for categorization (via existing BYOA setup)
- Handle files up to 10MB
- Support Swedish characters (å, ä, ö)
- Mobile-responsive wizard UI
- Validate all user inputs before API calls

---

### **Testing Checklist:**

Backend:
- [ ] Parse CSV with comma delimiter
- [ ] Parse CSV with semicolon delimiter
- [ ] Handle Swedish encoding (å, ä, ö)
- [ ] Convert Swedish decimals correctly
- [ ] Categorize using database mapping
- [ ] Categorize using LLM fallback
- [ ] Create income sources correctly
- [ ] Create regular expenses correctly
- [ ] Identify subscriptions (recurring + same amount)
- [ ] Update transaction_mappings confidence

Frontend:
- [ ] Upload CSV file
- [ ] Show parse errors gracefully
- [ ] Display transaction review table
- [ ] Allow category editing
- [ ] Show confirmation preview
- [ ] Create all items on confirm
- [ ] Redirect to dashboard after success
- [ ] Mobile responsive on all steps

---

**Deliverables:**
1. Backend endpoints functional and tested
2. Frontend wizard complete with all steps
3. Error handling for edge cases
4. Bank export instructions for top 4 Swedish banks
5. Transaction mapping table seeded with common merchants

**Success Criteria:**
- User can upload CSV and see categorized transactions in < 30 seconds
- 85%+ first-try upload success rate
- All created items appear correctly in Income/Expenses pages
- Wizard is mobile-friendly

---

## Priority: Low - Expense History & Price Tracking

### Overview
Track price changes over time for subscriptions and insurance to show historical trends.

### Features
- When subscription/insurance price changes, create historical record
- Show price history chart in item details
- Alert user to price increases
- Calculate total cost increases over time

### Database Changes
Add `price_history` jsonb column to subscriptions and insurances tables, or create separate history table.

---

## Priority: Low - Rename "Regular Expenses" to "Fixed Expenses"

### Issue
Current naming: "Regular Expenses" is unclear
Better naming: "Fixed Expenses" or "Recurring Expenses"

### Changes Required
1. Database migration to rename table and columns
2. Update all references in frontend code
3. Update user-facing strings

### Files Affected
- All components in `frontend/src/components/expenses/`
- Database schema
- API calls

**Note**: This is a breaking change requiring database migration. Plan carefully.
