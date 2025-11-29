# Refactoring Guide - Ready to Execute

## Why Refactor Now
Current token usage: ~97k/200k
Large files cause high token consumption in AI sessions.
Better to start fresh conversation after this guide is complete.

## Phase 1: MonthlyExpenses.tsx Refactoring

### Step 1: Create ExpenseCategoryItem Component
**File:** `src/components/expenses/ExpenseCategoryItem.tsx`

**Extract from MonthlyExpenses.tsx lines 442-575** (the expense item rendering)

**Props needed:**
```typescript
interface ExpenseCategoryItemProps {
  category: any;
  amount: string;
  currency: string;
  members: any[];
  hasEntry: boolean;
  isDifferent: boolean;
  onAmountChange: (categoryId: string, value: string) => void;
  onEdit: (category: any) => void;
}
```

**What to extract:**
- Mobile layout (lines 447-508)
- Desktop layout (lines 510-575)
- getDisplayAmount helper function
- Category icon rendering logic

---

### Step 2: Create ExpenseSummaryBlocks Component
**File:** `src/components/expenses/ExpenseSummaryBlocks.tsx`

**Extract from MonthlyExpenses.tsx lines 577-677** (Subscriptions/Insurance blocks)

**Props needed:**
```typescript
interface ExpenseSummaryBlocksProps {
  subscriptionsTotal: number;
  insuranceTotal: number;
  currency: string;
}
```

---

### Step 3: Create ExpenseCategoryDialog Component  
**File:** `src/components/expenses/ExpenseCategoryDialog.tsx`

**Extract from MonthlyExpenses.tsx lines 280-417** (category add/edit dialog)

**Props needed:**
```typescript
interface ExpenseCategoryDialogProps {
  open: boolean;
  editingCategoryId: string | null;
  categoryFormData: any;
  members: any[];
  onOpenChange: (open: boolean) => void;
  onFormDataChange: (data: any) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
}
```

**What to extract:**
- Dialog UI
- Special fields (Electricity Grid/Market, Rent Water)
- Form validation

---

### Step 4: Create useExpenseCategories Hook
**File:** `src/components/expenses/hooks/useExpenseCategories.ts`

**Extract from MonthlyExpenses.tsx:**
- `handleEditCategory` (lines 145-175)
- `handleSaveCategory` (lines 177-245)
- `handleDeleteCategory` (lines 247-260)
- `initializeDefaults` (lines 262-278)
- Category form state management

**Hook interface:**
```typescript
export const useExpenseCategories = (householdId: string, onUpdate: () => void) => {
  return {
    categoryDialogOpen,
    setCategoryDialogOpen,
    editingCategoryId,
    categoryFormData,
    setCategoryFormData,
    handleEditCategory,
    handleSaveCategory,
    handleDeleteCategory,
    initializeDefaults,
  };
};
```

---

### Step 5: Update MonthlyExpenses.tsx
**New structure (~150 lines):**
```typescript
import { ExpenseCategoryItem } from './ExpenseCategoryItem';
import { ExpenseSummaryBlocks } from './ExpenseSummaryBlocks';
import { ExpenseCategoryDialog } from './ExpenseCategoryDialog';
import { useExpenseCategories } from './hooks/useExpenseCategories';

export const MonthlyExpenses = (props) => {
  const {
    categoryDialogOpen,
    handleEditCategory,
    handleSaveCategory,
    // ... other hook returns
  } = useExpenseCategories(props.householdId, props.onCategoriesUpdate);

  return (
    <Card>
      <CardHeader>...</CardHeader>
      <CardContent>
        {sortedCategories.map(category => (
          <ExpenseCategoryItem
            key={category.id}
            category={category}
            amount={amounts[category.id]}
            onAmountChange={onAmountsChange}
            onEdit={handleEditCategory}
          />
        ))}
        
        <ExpenseSummaryBlocks
          subscriptionsTotal={subscriptionsTotal}
          insuranceTotal={insuranceTotal}
          currency={currency}
        />
        
        <Button onClick={onSave}>Save</Button>
      </CardContent>
      
      <ExpenseCategoryDialog
        open={categoryDialogOpen}
        onSave={handleSaveCategory}
        {...dialogProps}
      />
    </Card>
  );
};
```

---

## Phase 2: Income.tsx Refactoring

### Similar Pattern:
1. **IncomeSourceItem.tsx** - Extract lines 450-570 (income source rendering)
2. **IncomeSourceDialog.tsx** - Extract lines 320-437 (add/edit dialog)
3. **OneTimeIncomeCard.tsx** - Extract lines 582-736 (one-time income card)
4. **useIncomeSources.ts** - Extract CRUD operations
5. **Update Income.tsx** - Use new components (~150 lines)

---

## Phase 3: Shared Utilities

### formatting.ts
```typescript
export const formatCategory = (category: string) => {
  return category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

export const formatCurrency = (amount: number, currency: string) => {
  return `${amount.toFixed(0)} ${currency}`;
};
```

### calculations.ts
```typescript
export const calculateTotal = (amounts: Record<string, string>) => {
  return Object.values(amounts).reduce((sum, val) => sum + parseFloat(val || "0"), 0);
};

export const calculateAverage = (values: number[]) => {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
};
```

---

## Execution Order

1. ✅ Create directory structure
2. ✅ Extract ExpenseCategoryItem (test)
3. ✅ Extract ExpenseSummaryBlocks (test)
4. ✅ Extract ExpenseCategoryDialog (test)
5. ✅ Create useExpenseCategories hook (test)
6. ✅ Update MonthlyExpenses (test)
7. ✅ Commit Phase 1
8. ✅ Repeat for Income.tsx
9. ✅ Create shared utilities
10. ✅ Final testing & commit

---

## Testing Checklist

After each extraction:
- [ ] Component renders correctly
- [ ] All interactions work (edit, delete, save)
- [ ] Special fields work (Electricity, Rent)
- [ ] Mobile + desktop layouts work
- [ ] No console errors
- [ ] Data persists correctly

---

## Benefits After Refactoring

**Before:**
- MonthlyExpenses.tsx: 697 lines
- Income.tsx: 741 lines

**After:**
- ~15 files averaging 100 lines each
- Easier navigation
- Better code reuse
- **50-70% reduction in tokens per AI session**

---

## Start Fresh Conversation

After refactoring is complete:
1. Commit and push all changes
2. Start new conversation
3. Reference `future_improvements.md` for next tasks
4. Much lower token usage per session!
