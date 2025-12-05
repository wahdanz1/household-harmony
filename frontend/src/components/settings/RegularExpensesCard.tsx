import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, Plus, Trash2, Edit, Home, Zap, Wifi, Smartphone, Shield, Landmark, ShoppingCart, Fuel, UtensilsCrossed, Film, ShoppingBag, Heart, Sparkles } from "lucide-react";
import { useRegularExpenses } from "../expenses/hooks/useRegularExpenses";
import { RegularExpenseDialog } from "../expenses/RegularExpenseDialog";

interface ExpenseCategory {
  id: string;
  name: string;
  type: string;
  default_amount: number;
  icon: string | null;
  sort_order: number;
}

interface RegularExpensesCardProps {
  expenseCategories: ExpenseCategory[];
  householdId: string;
  currency: string;
  onUpdate: () => void;
}

const CATEGORY_ICONS: Record<string, any> = {
  "Rent": Home,
  "Electricity": Zap,
  "Internet": Wifi,
  "Phone": Smartphone,
  "Insurance": Shield,
  "Loan Payments": Landmark,
  "Groceries": ShoppingCart,
  "Fuel": Fuel,
  "Dining Out": UtensilsCrossed,
  "Entertainment": Film,
  "Shopping": ShoppingBag,
  "Healthcare": Heart,
  "Personal Care": Sparkles,
};

const DEFAULT_CATEGORIES = {
  static: [
    "Rent", "Electricity", "Internet", "Phone", "Insurance", "Loan Payments"
  ],
  dynamic: [
    "Groceries", "Fuel", "Dining Out", "Entertainment",
    "Shopping", "Healthcare", "Personal Care"
  ]
};

export const RegularExpensesCard = ({ expenseCategories, householdId, currency, onUpdate }: RegularExpensesCardProps) => {
  const getCategoryIcon = (name: string) => {
    const IconComponent = CATEGORY_ICONS[name];
    return IconComponent ? <IconComponent className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />;
  };

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
  } = useRegularExpenses(householdId, expenseCategories, onUpdate);

  const staticCategories = expenseCategories.filter(c => c.type === "static");
  const dynamicCategories = expenseCategories.filter(c => c.type === "dynamic");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-destructive" />
          Expense Categories
        </CardTitle>
        <CardDescription className="mt-1.5">Organize your household expenses</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => {
            resetCategoryForm();
            setCategoryDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>

          {expenseCategories.length === 0 && (
            <Button variant="outline" onClick={initializeDefaults}>
              Load Defaults
            </Button>
          )}
        </div>

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

        <div className="space-y-4">
          {staticCategories.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Static Expenses</h4>
              <div className="space-y-2">
                {staticCategories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/40"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(category.name)}
                        <p className="font-medium">{category.name}</p>
                        <Badge variant="secondary">Static</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {category.default_amount > 0 ? `${category.default_amount} ${currency}` : `No default set`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditCategory(category)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteCategory(category.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dynamicCategories.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Dynamic Expenses</h4>
              <div className="space-y-2">
                {dynamicCategories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/40"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(category.name)}
                        <p className="font-medium">{category.name}</p>
                        <Badge variant="outline">Dynamic</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {category.default_amount > 0 ? `Default: ${category.default_amount} ${currency} • Rolling average` : `Rolling average • No default yet`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditCategory(category)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteCategory(category.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {expenseCategories.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No expense categories yet. Add some or load defaults!
            </p>
          )}
        </div>
      </CardContent>
    </Card >
  );
};
