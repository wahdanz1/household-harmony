import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingDown, AlertCircle, Plus } from "lucide-react";
import { AddExpenseDialog } from "./AddExpenseDialog";
import { RegularExpenseItem } from "./RegularExpenseItem";
import { ExpenseSummaryBlocks } from "./ExpenseSummaryBlocks";
import { RegularExpenseDialog } from "./RegularExpenseDialog";
import { useRegularExpenses } from "./hooks/useRegularExpenses";
import { format } from "date-fns";
import { useState } from "react";

interface MonthlyExpensesProps {
  householdId: string;
  expenseCategories: any[];
  monthlyExpenses: any[];
  creditCardExpenses: any[];
  amounts: Record<string, string>;
  currency: string;
  saving: boolean;
  subscriptionsTotal: number;
  insuranceTotal: number;
  members: any[];
  coParents: any[];
  onAmountsChange: (amounts: Record<string, string>) => void;
  onSave: () => void;
  onCategoriesUpdate: () => void;
  onNavigateToSubscriptions?: () => void;
  onNavigateToInsurance?: () => void;
}

export const MonthlyExpenses = ({
  householdId,
  expenseCategories,
  monthlyExpenses,
  creditCardExpenses,
  amounts,
  currency,
  saving,
  subscriptionsTotal,
  insuranceTotal,
  members,
  coParents,
  onAmountsChange,
  onSave,
  onCategoriesUpdate,
  onNavigateToSubscriptions,
  onNavigateToInsurance,
}: MonthlyExpensesProps) => {
  const [addExpenseDialogOpen, setAddExpenseDialogOpen] = useState(false);

  const {
    categoryDialogOpen,
    setCategoryDialogOpen,
    editingCategoryId,
    categoryFormData,
    setCategoryFormData,
    electricityGrid,
    setElectricityGrid,
    electricityMarket,
    setElectricityMarket,
    waterIncluded,
    setWaterIncluded,
    waterCost,
    setWaterCost,
    handleEditCategory,
    handleSaveCategory,
    handleDeleteCategory,
    initializeDefaults,
    resetCategoryForm,
  } = useRegularExpenses(householdId, expenseCategories, onCategoriesUpdate);

  // Sort all expenses by amount (highest to lowest)
  const sortedCategories = [...expenseCategories].sort((a, b) => {
    const amountA = parseFloat(amounts[a.id] || a.default_amount.toString() || "0");
    const amountB = parseFloat(amounts[b.id] || b.default_amount.toString() || "0");
    return amountB - amountA; // Descending order
  });

  return (
    <div className="space-y-4">
      {/* Unified Expense Categories & Entry */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-destructive" />
                Monthly Expenses
              </CardTitle>
              <CardDescription className="mt-1.5">
                Add expense categories with defaults, and adjust actual monthly expenses if needed. Click "Save Monthly Expenses" when done!
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="w-full sm:w-auto" onClick={() => setAddExpenseDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Expense
              </Button>

              {expenseCategories.length === 0 && (
                <Button variant="outline" size="sm" onClick={initializeDefaults}>
                  Load Defaults
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {expenseCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
              <p>No expense categories configured</p>
              <p className="text-sm">Add expense categories or load defaults to get started</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {sortedCategories.map((category) => {
                  const hasEntry = monthlyExpenses.some((m) => m.expense_category_id === category.id);
                  const isDifferent = amounts[category.id] !== category.default_amount.toString();

                  // Find matching credit card expenses for this category
                  // Match based on category name/type
                  const matchingCreditExpenses = creditCardExpenses.filter(expense => {
                    const creditCategory = expense.category.toLowerCase();
                    const categoryName = category.name.toLowerCase();
                    const categoryType = category.category?.toLowerCase() || '';

                    // Direct category type match
                    if (creditCategory === categoryType) return true;

                    // Name-based matching for common categories
                    if (creditCategory === 'groceries' && (categoryName.includes('food') || categoryName.includes('mat') || categoryName.includes('groceries') || categoryType === 'groceries')) return true;
                    if (creditCategory === 'fuel' && (categoryName.includes('gas') || categoryName.includes('fuel') || categoryName.includes('bensin') || categoryType === 'fuel')) return true;
                    if (creditCategory === 'travel' && (categoryName.includes('travel') || categoryName.includes('trip') || categoryName.includes('resa') || categoryType === 'travel')) return true;
                    if (creditCategory === 'shopping' && (categoryName.includes('shopping') || categoryName.includes('kläder') || categoryType === 'shopping')) return true;
                    if (creditCategory === 'dining_out' && (categoryName.includes('dining') || categoryName.includes('restaurant') || categoryType === 'dining')) return true;
                    if (creditCategory === 'entertainment' && (categoryName.includes('entertainment') || categoryName.includes('nöje') || categoryType === 'entertainment')) return true;
                    if (creditCategory === 'health' && (categoryName.includes('health') || categoryName.includes('hälsa') || categoryType === 'health')) return true;
                    if (creditCategory === 'car_repairs' && (categoryName.includes('car') || categoryName.includes('bil') || categoryType === 'car')) return true;

                    return false;
                  });

                  return (
                    <RegularExpenseItem
                      key={category.id}
                      category={category}
                      amount={amounts[category.id] || category.default_amount.toString()}
                      currency={currency}
                      members={members}
                      hasEntry={hasEntry}
                      isDifferent={isDifferent}
                      creditExpenses={matchingCreditExpenses}
                      onAmountChange={(categoryId, value) =>
                        onAmountsChange({ ...amounts, [categoryId]: value })
                      }
                      onEdit={handleEditCategory}
                    />
                  );
                })}

                {/* Show unmatched credit card expenses as separate items */}
                {creditCardExpenses.map((expense) => {
                  // Check if this expense was already matched to an existing category
                  const isMatched = sortedCategories.some(category => {
                    const creditCategory = expense.category.toLowerCase();
                    const categoryName = category.name.toLowerCase();
                    const categoryType = category.category?.toLowerCase() || '';

                    if (creditCategory === categoryType) return true;
                    if (creditCategory === 'groceries' && (categoryName.includes('food') || categoryName.includes('mat') || categoryName.includes('groceries') || categoryType === 'groceries')) return true;
                    if (creditCategory === 'fuel' && (categoryName.includes('gas') || categoryName.includes('fuel') || categoryName.includes('bensin') || categoryType === 'fuel')) return true;
                    if (creditCategory === 'travel' && (categoryName.includes('travel') || categoryName.includes('trip') || categoryName.includes('resa') || categoryType === 'travel')) return true;
                    if (creditCategory === 'shopping' && (categoryName.includes('shopping') || categoryName.includes('kläder') || categoryType === 'shopping')) return true;
                    if (creditCategory === 'dining_out' && (categoryName.includes('dining') || categoryName.includes('restaurant') || categoryType === 'dining')) return true;
                    if (creditCategory === 'entertainment' && (categoryName.includes('entertainment') || categoryName.includes('nöje') || categoryType === 'entertainment')) return true;
                    if (creditCategory === 'health' && (categoryName.includes('health') || categoryName.includes('hälsa') || categoryType === 'health')) return true;
                    if (creditCategory === 'car_repairs' && (categoryName.includes('car') || categoryName.includes('bil') || categoryType === 'car')) return true;

                    return false;
                  });

                  // Only show if not matched to existing category
                  if (isMatched) return null;

                  return (
                    <RegularExpenseItem
                      key={`credit-${expense.id}`}
                      category={{
                        id: `credit-${expense.category}`,
                        name: expense.description,
                        category: expense.category,
                        type: 'credit',
                        default_amount: 0,
                        created_by: expense.created_by,
                      }}
                      amount="0"
                      currency={currency}
                      members={members}
                      hasEntry={true}
                      onEdit={() => { }}
                    />
                  );
                })}

                <ExpenseSummaryBlocks
                  subscriptionsTotal={subscriptionsTotal}
                  insuranceTotal={insuranceTotal}
                  currency={currency}
                  hasSubscriptionsEntry={monthlyExpenses.some(e => e.subscription_id !== null)}
                  hasInsuranceEntry={monthlyExpenses.some(e => e.insurance_id !== null)}
                  onNavigateToSubscriptions={onNavigateToSubscriptions}
                  onNavigateToInsurance={onNavigateToInsurance}
                />
              </div>

              {monthlyExpenses.length > 0 && (
                <p className="text-xs text-center text-muted-foreground mb-2">
                  Monthly expenses saved {(() => {
                    try {
                      const mostRecent = monthlyExpenses.reduce((latest, current) => {
                        const latestDate = new Date(latest.updated_at || latest.created_at || 0);
                        const currentDate = new Date(current.updated_at || current.created_at || 0);
                        return currentDate > latestDate ? current : latest;
                      }, monthlyExpenses[0]);

                      const dateToUse = mostRecent.updated_at || mostRecent.created_at;
                      if (!dateToUse) return "";

                      return format(new Date(dateToUse), "MMM d, yyyy 'at' HH:mm");
                    } catch (e) {
                      console.error("Error formatting date:", e);
                      return "";
                    }
                  })()}
                </p>
              )}
              <Button
                onClick={onSave}
                disabled={saving}
                className={`w-full ${monthlyExpenses.length > 0 ? 'bg-green-900/40 hover:bg-green-900/60 text-green-100 border border-green-800/50' : ''}`}
              >
                {saving ? "Saving..." : monthlyExpenses.length > 0 ? "Update Monthly Expenses" : "Save Monthly Expenses"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <RegularExpenseDialog
        open={categoryDialogOpen}
        editingCategoryId={editingCategoryId}
        categoryFormData={categoryFormData}
        expenseCategories={expenseCategories}
        electricityGrid={electricityGrid}
        electricityMarket={electricityMarket}
        waterIncluded={waterIncluded}
        waterCost={waterCost}
        onOpenChange={setCategoryDialogOpen}
        onFormDataChange={setCategoryFormData}
        onElectricityGridChange={setElectricityGrid}
        onElectricityMarketChange={setElectricityMarket}
        onWaterIncludedChange={setWaterIncluded}
        onWaterCostChange={setWaterCost}
        onSave={handleSaveCategory}
        onDelete={handleDeleteCategory}
      />

      <AddExpenseDialog
        open={addExpenseDialogOpen}
        onOpenChange={setAddExpenseDialogOpen}
        householdId={householdId}
        hasCoParents={coParents.length > 0}
        onSuccess={onCategoriesUpdate}
      />
    </div>
  );
};
