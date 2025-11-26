import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TrendingDown, Check, AlertCircle, Plus, Edit, Trash2, Home, Zap, Wifi, Smartphone, Shield, Landmark, ShoppingCart, Fuel, UtensilsCrossed, Film, ShoppingBag, Heart, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface MonthlyExpensesProps {
  householdId: string;
  expenseCategories: any[];
  monthlyExpenses: any[];
  amounts: Record<string, string>;
  currency: string;
  saving: boolean;
  subscriptionsTotal: number;
  insuranceTotal: number;
  members: any[];
  onAmountsChange: (amounts: Record<string, string>) => void;
  onSave: () => void;
  onCategoriesUpdate: () => void;
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

export const MonthlyExpenses = ({
  householdId,
  expenseCategories,
  monthlyExpenses,
  amounts,
  currency,
  saving,
  subscriptionsTotal,
  insuranceTotal,
  members,
  onAmountsChange,
  onSave,
  onCategoriesUpdate,
}: MonthlyExpensesProps) => {
  const { toast } = useToast();
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryFormData, setCategoryFormData] = useState<{
    name: string;
    type: "static" | "dynamic";
    default_amount: string;
  }>({
    name: "",
    type: "static",
    default_amount: "0",
  });

  const resetCategoryForm = () => {
    setCategoryFormData({
      name: "",
      type: "static",
      default_amount: "0",
    });
    setEditingCategoryId(null);
  };

  const initializeDefaults = async () => {
    const categories = [
      ...DEFAULT_CATEGORIES.static.map((name, index) => ({
        household_id: householdId,
        name,
        type: "static" as const,
        default_amount: 0,
        sort_order: index,
      })),
      ...DEFAULT_CATEGORIES.dynamic.map((name, index) => ({
        household_id: householdId,
        name,
        type: "dynamic" as const,
        default_amount: 0,
        sort_order: DEFAULT_CATEGORIES.static.length + index,
      })),
    ];

    const { error } = await supabase
      .from("expense_categories")
      .insert(categories);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to initialize default categories",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Default expense categories added",
      });
      onCategoriesUpdate();
    }
  };

  const handleSaveCategory = async () => {
    const data = {
      household_id: householdId,
      name: categoryFormData.name,
      type: categoryFormData.type,
      default_amount: parseFloat(categoryFormData.default_amount),
      sort_order: expenseCategories.length,
    };

    let error;
    if (editingCategoryId) {
      ({ error } = await supabase
        .from("expense_categories")
        .update(data)
        .eq("id", editingCategoryId));
    } else {
      ({ error } = await supabase
        .from("expense_categories")
        .insert(data));
    }

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save expense category",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: editingCategoryId ? "Category updated" : "Category added",
      });
      setCategoryDialogOpen(false);
      resetCategoryForm();
      onCategoriesUpdate();
    }
  };

  const handleEditCategory = (category: any) => {
    setCategoryFormData({
      name: category.name,
      type: category.type,
      default_amount: category.default_amount.toString(),
    });
    setEditingCategoryId(category.id);
    setCategoryDialogOpen(true);
  };

  const handleDeleteCategory = async (id: string) => {
    const { error } = await supabase
      .from("expense_categories")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete expense category",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Category deleted",
      });
      onCategoriesUpdate();
    }
  };

  const getCategoryIcon = (name: string) => {
    const IconComponent = CATEGORY_ICONS[name];
    return IconComponent ? <IconComponent className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />;
  };

  const staticCategories = expenseCategories.filter((c) => c.type === "static");
  const dynamicCategories = expenseCategories.filter((c) => c.type === "dynamic");

  return (
    <div className="space-y-4">
      {/* Unified Expense Categories & Entry */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-destructive" />
                Expense Categories & Monthly Entry
              </CardTitle>
              <CardDescription>Manage categories and enter monthly expenses</CardDescription>
            </div>
            <div className="flex gap-2">
              <Dialog open={categoryDialogOpen} onOpenChange={(open) => {
                setCategoryDialogOpen(open);
                if (!open) resetCategoryForm();
              }}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Category
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingCategoryId ? "Edit" : "Add"} Expense Category</DialogTitle>
                    <DialogDescription>
                      Create a new expense category for tracking
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={categoryFormData.name}
                        onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                        placeholder="e.g., Rent, Groceries"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={categoryFormData.type} onValueChange={(v) => setCategoryFormData({ ...categoryFormData, type: v as typeof categoryFormData.type })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="static">Static (Fixed monthly)</SelectItem>
                          <SelectItem value="dynamic">Dynamic (Rolling average)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Default Amount</Label>
                      <Input
                        type="number"
                        value={categoryFormData.default_amount}
                        onChange={(e) => setCategoryFormData({ ...categoryFormData, default_amount: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleSaveCategory}>
                      {editingCategoryId ? "Update" : "Add"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

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
              {staticCategories.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Static Expenses</h4>
                  <div className="space-y-3">
                    {staticCategories.map((category) => {
                      const hasEntry = monthlyExpenses.some((m) => m.expense_category_id === category.id);
                      const isDifferent = amounts[category.id] !== category.default_amount.toString();

                      return (
                        <div
                          key={category.id}
                          className="flex items-center gap-4 p-4 rounded-lg border border-border bg-background/40"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {getCategoryIcon(category.name)}
                              <p className="font-medium truncate">{category.name}</p>
                              <Badge variant="secondary" className="shrink-0">Static</Badge>
                              {hasEntry && <Check className="h-4 w-4 text-success shrink-0" />}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {category.default_amount > 0 ? `Default: ${category.default_amount} ${currency}` : `No default set`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={amounts[category.id] || ""}
                              onChange={(e) =>
                                onAmountsChange({ ...amounts, [category.id]: e.target.value })
                              }
                              className={`w-40 text-lg font-semibold ${isDifferent ? "border-primary" : ""}`}
                              placeholder="0"
                            />
                            <span className="text-sm text-muted-foreground min-w-[3rem]">{currency}</span>
                          </div>
                          <div className="flex gap-1 shrink-0">
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
                      );
                    })}

                    {subscriptionsTotal > 0 && (
                      <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-muted/40">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-muted-foreground truncate">Subscriptions</p>
                            <Badge variant="secondary" className="shrink-0">auto</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={subscriptionsTotal.toFixed(0)}
                            disabled
                            className="w-40 text-lg font-semibold bg-muted/20"
                          />
                          <span className="text-sm text-muted-foreground min-w-[3rem]">{currency}</span>
                        </div>
                        <div className="w-[72px]"></div>
                      </div>
                    )}

                    {insuranceTotal > 0 && (
                      <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-muted/40">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-muted-foreground truncate">Insurance Savings</p>
                            <Badge variant="secondary" className="shrink-0">auto</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={insuranceTotal.toFixed(0)}
                            disabled
                            className="w-40 text-lg font-semibold bg-muted/20"
                          />
                          <span className="text-sm text-muted-foreground min-w-[3rem]">{currency}</span>
                        </div>
                        <div className="w-[72px]"></div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {dynamicCategories.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Dynamic Expenses</h4>
                  <div className="space-y-3">
                    {dynamicCategories.map((category) => {
                      const hasEntry = monthlyExpenses.some((m) => m.expense_category_id === category.id);
                      const isDifferent = amounts[category.id] !== category.default_amount.toString();

                      return (
                        <div
                          key={category.id}
                          className="flex items-center gap-4 p-4 rounded-lg border border-border bg-background/40"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {getCategoryIcon(category.name)}
                              <p className="font-medium truncate">{category.name}</p>
                              <Badge variant="outline" className="shrink-0">Dynamic</Badge>
                              {hasEntry && <Check className="h-4 w-4 text-success shrink-0" />}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {category.default_amount > 0 ? `Avg: ${category.default_amount} ${currency} • Rolling average` : `Rolling average • No default yet`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={amounts[category.id] || ""}
                              onChange={(e) =>
                                onAmountsChange({ ...amounts, [category.id]: e.target.value })
                              }
                              className={`w-40 text-lg font-semibold ${isDifferent ? "border-primary" : ""}`}
                              placeholder="0"
                            />
                            <span className="text-sm text-muted-foreground min-w-[3rem]">{currency}</span>
                          </div>
                          <div className="flex gap-1 shrink-0">
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
                      );
                    })}
                  </div>
                </div>
              )}

              <Button onClick={onSave} disabled={saving} className="w-full">
                {saving ? "Saving..." : "Save Monthly Expenses"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
