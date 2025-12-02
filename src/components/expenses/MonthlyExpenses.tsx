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
  onNavigateToCredit?: () => void;
  subscriptionSeverity?: 'default' | 'warning' | 'danger';
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
  onNavigateToCredit,
  subscriptionSeverity,
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

                {(() => {
                  // Combine categories and unmatched credit expenses for unified sorting
                  const combinedItems = [
                    ...expenseCategories.map(category => {
                      const amount = parseFloat(amounts[category.id] || category.default_amount.toString() || "0");
                      return { type: 'category', data: category, amount, id: category.id };
                    }),
                    ...creditCardExpenses.map(expense => {
                      // Check if matched (logic from before)
                      const isMatched = expenseCategories.some((category: any) => {
                        const creditCategory = expense.category.toLowerCase();
                        const categoryName = category.name.toLowerCase();
                        const categoryType = category.category?.toLowerCase() || '';

                        if (creditCategory === categoryType) return true;
                        if (creditCategory === 'groceries' && (categoryName.includes('food') || categoryName.includes('mat') || categoryName.includes('groceries') || categoryType === 'groceries')) return true;
                        if (creditCategory === 'fuel' && (categoryName.includes('gas') || categoryName.includes('fuel') || categoryName.includes('bensin') || categoryType === 'fuel')) return true;
                        if (creditCategory === 'travel' && (categoryName.includes('travel') || categoryName.includes('trip') || categoryName.includes('resa') || categoryType === 'travel')) return true;
                        if (creditCategory === 'shopping' && (categoryName.includes('shopping') || categoryName.includes('kläder') || categoryType === 'shopping')) return true;
                        if ((creditCategory === 'dining' || creditCategory === 'dining_out') && (categoryName.includes('dining') || categoryName.includes('restaurant') || categoryType === 'dining' || categoryType === 'dining_out')) return true;
                        if (creditCategory === 'entertainment' && (categoryName.includes('entertainment') || categoryName.includes('nöje') || categoryType === 'entertainment')) return true;
                        if ((creditCategory === 'health' || creditCategory === 'healthcare') && (categoryName.includes('health') || categoryName.includes('hälsa') || categoryType === 'health' || categoryType === 'healthcare')) return true;
                        if (creditCategory === 'car_repairs' && (categoryName.includes('car') || categoryName.includes('bil') || categoryType === 'car')) return true;
                        return false;
                      });

                      if (isMatched) return null; // Skip matched ones, they are inside categories

                      return {
                        type: 'credit',
                        data: expense,
                        amount: expense.amount,
                        id: `credit-${expense.id}`
                      };
                    }).filter(Boolean)
                  ];

                  // Sort by amount descending
                  combinedItems.sort((a: any, b: any) => b.amount - a.amount);

                  return combinedItems.map((item: any) => {
                    if (item.type === 'category') {
                      const category = item.data;
                      const hasEntry = monthlyExpenses.some((m) => m.expense_category_id === category.id);
                      const isDifferent = amounts[category.id] !== category.default_amount.toString();

                      // Find matching credit card expenses
                      const matchingCreditExpenses = creditCardExpenses.filter(expense => {
                        const creditCategory = expense.category.toLowerCase();
                        const categoryName = category.name.toLowerCase();
                        const categoryType = category.category?.toLowerCase() || '';

                        if (creditCategory === categoryType) return true;
                        if (creditCategory === 'groceries' && (categoryName.includes('food') || categoryName.includes('mat') || categoryName.includes('groceries') || categoryType === 'groceries')) return true;
                        if (creditCategory === 'fuel' && (categoryName.includes('gas') || categoryName.includes('fuel') || categoryName.includes('bensin') || categoryType === 'fuel')) return true;
                        if (creditCategory === 'travel' && (categoryName.includes('travel') || categoryName.includes('trip') || categoryName.includes('resa') || categoryType === 'travel')) return true;
                        if (creditCategory === 'shopping' && (categoryName.includes('shopping') || categoryName.includes('kläder') || categoryType === 'shopping')) return true;
                        if ((creditCategory === 'dining' || creditCategory === 'dining_out') && (categoryName.includes('dining') || categoryName.includes('restaurant') || categoryType === 'dining' || categoryType === 'dining_out')) return true;
                        if (creditCategory === 'entertainment' && (categoryName.includes('entertainment') || categoryName.includes('nöje') || categoryType === 'entertainment')) return true;
                        if ((creditCategory === 'health' || creditCategory === 'healthcare') && (categoryName.includes('health') || categoryName.includes('hälsa') || categoryType === 'health' || categoryType === 'healthcare')) return true;
                        if (creditCategory === 'car_repairs' && (categoryName.includes('car') || categoryName.includes('bil') || categoryType === 'car')) return true;
                        return false;
                      });

                      // Calculate status
                      let status: 'saved' | 'modified' | 'none' = 'none';
                      if (hasEntry) {
                        status = isDifferent ? 'modified' : 'saved';
                      }

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
                          onNavigateToCredit={onNavigateToCredit}
                          status={status}
                        />
                      );
                    } else {
                      const expense = item.data;
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
                          creditExpenses={[expense]}
                          onEdit={() => {
                            if (onNavigateToCredit) {
                              onNavigateToCredit();
                            }
                          }}
                          onNavigateToCredit={onNavigateToCredit}
                          status="saved"
                        />
                      );
                    }
                  });
                })()}

                <ExpenseSummaryBlocks
                  subscriptionsTotal={subscriptionsTotal}
                  insuranceTotal={insuranceTotal}
                  currency={currency}
                  hasSubscriptionsEntry={monthlyExpenses.some(e => e.subscription_id !== null)}
                  hasInsuranceEntry={monthlyExpenses.some(e => e.insurance_id !== null)}
                  onNavigateToSubscriptions={onNavigateToSubscriptions}
                  onNavigateToInsurance={onNavigateToInsurance}
                  subscriptionSeverity={subscriptionSeverity}
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
