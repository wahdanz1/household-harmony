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

## Priority: High - LLM Transaction Categorization

### Overview
Allow users to upload bank transaction PDFs and use Gemini LLM to automatically categorize transactions into existing expense categories.

### Features
1. **PDF Upload**: Accept bank transaction exports (PDF format)
2. **PDF Parsing**: Extract transaction data (date, merchant, amount)
3. **LLM Categorization**: Use Gemini to match merchants to expense categories
4. **Learning Database**: Store merchant→category mappings in Supabase
5. **Future Auto-Match**: Skip LLM for known merchants

### Database Schema (New Table)
```sql
create table merchant_mappings (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid references households(id) on delete cascade,
  merchant_name text not null,
  normalized_name text not null, -- lowercase, trimmed
  expense_category_id uuid references regular_expenses(id),
  confidence_score float, -- LLM confidence (0-1)
  created_at timestamp with time zone default now(),
  created_by uuid references profiles(id),
  verified boolean default false, -- user confirmed mapping
  unique(household_id, normalized_name)
);
```

### Implementation Steps
1. PDF parser (use library like pdf.js or pdf-parse)
2. Transaction data extraction with regex patterns
3. Gemini API integration for categorization
4. UI for reviewing/confirming LLM suggestions
5. Merchant mapping storage and retrieval
6. Batch import flow

### Considerations
- Privacy: Bank PDFs contain sensitive data
- Cost: Gemini API calls cost money per transaction
- Accuracy: LLM might misclassify, need user review
- Multiple Banks: Different PDF formats, need flexible parser

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
