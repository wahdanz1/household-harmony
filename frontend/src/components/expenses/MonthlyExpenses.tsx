import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, AlertCircle, Plus, Loader2, Check } from "lucide-react";
import { AddExpenseDialog } from "./AddExpenseDialog";
import { ExpenseItem } from "./ExpenseItem";
import { ExpenseSummaryBlocks } from "./ExpenseSummaryBlocks";
import { EditExpenseDialog } from "./EditExpenseDialog";
import { useExpenses } from "./hooks/useExpenses";
import { useState } from "react";

interface MonthlyExpensesProps {
  householdId: string;
  expenseCategories: any[];
  monthlyExpenses: any[];
  creditCardExpenses: any[];
  amounts: Record<string, string>;
  currency: string;
  subscriptionsTotal: number;
  insuranceTotal: number;
  members: any[];
  coParents: any[];
  autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  onAmountChange: (categoryId: string, value: string) => void;
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
  subscriptionsTotal,
  insuranceTotal,
  members,
  coParents,
  autoSaveStatus,
  onAmountChange,
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
  } = useExpenses(householdId, expenseCategories, onCategoriesUpdate);

  return (
    <div className="space-y-4">
      {/* Fixed/Recurring Expenses */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5 text-blue-500" />
                Fixed Expenses
              </CardTitle>
              <CardDescription className="mt-1.5">
                Predictable recurring costs like rent, utilities, and transportation.
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
              {/* Status Bar */}
              <div className="flex items-center justify-between text-xs pb-2 border-b border-border mb-2">
                <span className="text-muted-foreground">
                  <span className="hidden sm:inline">Click</span>
                  <span className="sm:hidden">Tap</span>
                  {" "}an item to edit details
                </span>
                <div className="flex items-center gap-2">
                  {autoSaveStatus === 'saving' && (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </span>
                  )}
                  {autoSaveStatus === 'saved' && (
                    <span className="flex items-center gap-1.5 text-green-600 animate-in fade-in slide-in-from-right-2 duration-300">
                      <Check className="h-3.5 w-3.5" />
                      <span className="inline-flex">
                        {'Saved'.split('').map((letter, i) => (
                          <span
                            key={i}
                            className="animate-in fade-in duration-150"
                            style={{ animationDelay: `${i * 50}ms` }}
                          >
                            {letter}
                          </span>
                        ))}
                      </span>
                    </span>
                  )}
                  {autoSaveStatus === 'error' && (
                    <span className="flex items-center gap-1.5 text-red-500">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Error
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {(() => {
                  // Combine categories and unmatched credit expenses for unified sorting
                  const combinedItems = [
                    ...expenseCategories.map(category => {
                      const amount = parseFloat(amounts[category.id] || category.default_amount.toString() || "0");
                      return { type: 'category', data: category, amount, id: category.id };
                    }),
                    ...creditCardExpenses.map(expense => {
                      // Check if matched
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

                      if (isMatched) return null;

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

                      // Status based on smart defaults - compare to default_amount
                      const currentAmount = amounts[category.id];
                      const suggestedAmount = category.default_amount.toString();
                      let status: 'saved' | 'modified' | 'none' = 'none';
                      if (currentAmount !== undefined) {
                        status = currentAmount === suggestedAmount ? 'saved' : 'modified';
                      }

                      return (
                        <ExpenseItem
                          key={category.id}
                          category={category}
                          amount={amounts[category.id] || category.default_amount.toString()}
                          currency={currency}
                          members={members}
                          creditExpenses={matchingCreditExpenses}
                          onAmountChange={onAmountChange}
                          onEdit={handleEditCategory}
                          onNavigateToCredit={onNavigateToCredit}
                          status={status}
                        />
                      );
                    } else {
                      const expense = item.data;
                      return (
                        <ExpenseItem
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
            </>
          )}
        </CardContent>
      </Card>

      <EditExpenseDialog
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
