import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, AlertCircle, Plus, Loader2, Check, PiggyBank, Wallet } from "lucide-react";
import { AddExpenseDialog } from "./AddExpenseDialog";
import { EditExpenseDialog } from "./EditExpenseDialog";
import { useExpenses } from "./hooks/useExpenses";
import { useState } from "react";
import { getCategoryById } from "@/constants/expenseCategories";

interface VariableExpensesProps {
    householdId: string;
    expenseCategories: any[];
    monthlyExpenses: any[];
    amounts: Record<string, string>;
    currency: string;
    hasCoParents: boolean;
    autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
    onAmountChange: (categoryId: string, value: string) => void;
    onCategoriesUpdate: () => void;
}

export const VariableExpenses = ({
    householdId,
    expenseCategories,
    monthlyExpenses,
    amounts,
    currency,
    hasCoParents,
    autoSaveStatus,
    onAmountChange,
    onCategoriesUpdate,
}: VariableExpensesProps) => {
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
    } = useExpenses(householdId, expenseCategories, onCategoriesUpdate);

    // Calculate totals for all variable expenses
    const totalBudget = expenseCategories.reduce((sum, cat) => {
        return sum + parseFloat(amounts[cat.id] || cat.default_amount || '0');
    }, 0);

    return (
        <div className="space-y-4">
            {/* Variable/Budget Expenses Card */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <ShoppingCart className="h-5 w-5 text-green-500" />
                                Variable Expenses
                            </CardTitle>
                            <CardDescription className="mt-1.5">
                                Budget-based expenses like groceries, entertainment, and personal care.
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" className="w-full sm:w-auto" onClick={() => setAddExpenseDialogOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Budget
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {expenseCategories.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <Wallet className="h-12 w-12 mb-4 opacity-50" />
                            <p>No budget categories configured</p>
                            <p className="text-sm">Add budget categories to start tracking variable expenses</p>
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

                            {/* Budget Items */}
                            <div className="space-y-2">
                                {expenseCategories.map((category) => {
                                    const currentAmount = amounts[category.id];
                                    const defaultAmount = category.default_amount?.toString() || '0';
                                    const cat = getCategoryById(category.category);
                                    const Icon = cat?.icon;

                                    // Status: green = matches default, lime = modified
                                    const isModified = currentAmount !== undefined && currentAmount !== defaultAmount;

                                    return (
                                        <div
                                            key={category.id}
                                            className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer"
                                            onClick={() => handleEditCategory(category)}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                {Icon && <Icon className="h-4 w-4 shrink-0" style={{ color: cat?.color }} />}
                                                <span className="font-medium truncate">{category.name}</span>
                                                <span
                                                    className="text-xs px-2 py-0.5 rounded-full shrink-0"
                                                    style={{
                                                        backgroundColor: cat?.color ? `${cat.color}20` : undefined,
                                                        color: cat?.color
                                                    }}
                                                >
                                                    Budget
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    value={amounts[category.id] || defaultAmount}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        onAmountChange(category.id, e.target.value);
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className={`w-24 sm:w-28 text-right text-lg font-semibold bg-transparent border-0 border-b-2 rounded-none px-2 py-1 focus:outline-none focus:ring-0 ${isModified ? 'border-lime-400' : 'border-green-500'
                                                        }`}
                                                />
                                                <span className="text-sm text-muted-foreground whitespace-nowrap">{currency}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Monthly Budget Total */}
                            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 mt-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <PiggyBank className="h-5 w-5 text-green-500" />
                                        <p className="font-semibold">Monthly Budget Total</p>
                                    </div>
                                    <p className="text-2xl font-bold text-green-600">{totalBudget.toFixed(0)} {currency}</p>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Dialogs */}
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
                hasCoParents={hasCoParents}
                onSuccess={onCategoriesUpdate}
            />
        </div>
    );
};
