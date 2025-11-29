# Future Improvements & Bug Fixes

## ✅ Completed This Session

### Navigation & Quick Access
- [x] Add button to Subscriptions expense block → Subscriptions tab
- [x] Add button to Insurance Savings expense block → Insurance tab

### Form Enhancements
- [x] Fix "+ Add Expense" to show Subscription/Insurance/Shared forms (reuse components)
  - All 4 forms now working (Regular, Subscription, Insurance, Shared)
  - Cancel button navigates back to card selection

### Quick Wins
- [x] Remove "+ Add Category" button (only use "+ Add Expense")
- [x] Replace "auto" badge with info icon (ℹ️) + tooltip
- [x] Change "Monthly Savings" to "Monthly Cost" in Insurance tab
- [x] Rethink "Most Expensive" metric in Insurance tab (now "Average Monthly")

### Technical Debt
- [x] Code Refactoring Complete
  - MonthlyExpenses.tsx: 701 → 195 lines (72% reduction)
  - Income.tsx: 741 → 330 lines (55% reduction)
  - Created 12 new component/hook files

---

## 🎯 UX Improvements (Remaining)

### Navigation & Quick Access
- [ ] Add category symbols for Subscriptions + Insurance Savings in General tab

### Form Enhancements
> **💬 NEEDS DISCUSSION:** These form layout changes would require modifying existing forms. Should we prioritize these?

- [ ] Add "Provider" field to: Rent, Electricity, Internet, Phone Plan, Healthcare
- [ ] Update Regular Expense form layout (3 lines: Category/Type, Title/Provider, Amount/Special)
- [ ] Update Subscription form layout (4 lines, hide Next Billing Date)
- [ ] Update Insurance form layout (5 lines with co-parent toggle)

### Category Management
> **💬 NEEDS DISCUSSION:** This requires database changes and migration. Should we proceed?

**Remove from Regular Expenses:**
- Dining Out
- Entertainment  
- Shopping
- Car Repairs

**Add to Regular Expenses:**
- Trade Union (fackförening)

**Add Temporary Expense Type:**
- One-time expenses (Car Repair, etc.)
- Disappears next month
- Available in Credit Card categories

### Visual Improvements
- [ ] Add symbols to Subscription & Insurance subcategories
- [ ] Display subcategory symbols on Subscriptions/Insurance tabs

---

## 🐛 Bug Fixes (Remaining)

### Insurance Savings Calculation
> **💬 NEEDS INVESTIGATION:** Discrepancy between Insurance Savings block (1945 SEK) and Monthly Cost metric (1126 SEK)

**Possible causes:**
- Shared insurances not included in calculation
- Payment frequency (6/12 months) might affect calculation
- Need to investigate and fix

### Settlement Card Issues

**Issue 1: Confusing Net Calculation**
> **💬 NEEDS DISCUSSION:** UX/wording issue

Current: "Expenses you paid (their 50%): -150 SEK" + "Net to send: +150 SEK"
- Sounds like I send money, but I should receive it
- Need clearer wording/calculation display

**Issue 2: Shared Income Not Working**
> **💬 NEEDS FEATURE:** No toggle to mark Income Source as shared

- "Shared Income Received: +0 SEK"
- Insurance Claim income (split 50/50) not in calculation
- Need to add shared income functionality

**Issue 3: Shared Expenses Logic**
> **💬 NEEDS DISCUSSION:** Current Shared tab might not match desired behavior

Need ability to:
- Add expense marked as "Shared"
- Select who pays it (me or co-parent)
- Only pay 50% of default amount
- Example: 60 SEK expense she pays → I pay 30 SEK

**Proposed Solution:**
Add to Shared tab with type selection:
- "Recurring/Static" (monthly)
- "Temporary/One-time" (this month only)
- Show monthly total in General tab (like Subscriptions/Insurance)

**Example Calculation:**
```
Shared Income: 5390 SEK
Her half: 5390/2 = 2695 SEK

Shared recurring expense (she pays): 60 SEK
My portion: 60/2 = 30 SEK

One-time expense (I paid): 299 SEK
Her portion: 299/2 = 150 SEK

Net to send her:
2695 + 30 - 150 = 2575 SEK
```

---

## 📝 Notes
- Credit Card feature still pending (separate task)
- Email whitelist & Join button hiding complete
- Input styling complete (bottom border, right-align, no spinners)

---

## 🎯 Summary & Next Steps

### What We Accomplished Today:
1. ✅ Navigation buttons for Subscriptions/Insurance blocks
2. ✅ All 4 expense forms working in Add Expense dialog
3. ✅ All Quick Wins completed
4. ✅ Major refactoring complete (MonthlyExpenses & Income)

### Items Needing Discussion:
1. **Form Layout Changes** - Worth the effort to redesign existing forms?
2. **Category Management** - Database migration required, proceed?
3. **Insurance Calculation Bug** - Needs investigation
4. **Settlement Card** - Multiple UX and logic issues to address
5. **Shared Income** - Feature doesn't exist yet, should we add it?

### Quick Wins Still Available:
- Add category symbols for Subscriptions + Insurance in General tab
- Add symbols to subcategories on Subscriptions/Insurance tabs
