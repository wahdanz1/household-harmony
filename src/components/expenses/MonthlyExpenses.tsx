import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { TrendingDown, Check, AlertCircle, Plus, Edit, Trash2, Home, Zap, Wifi, Smartphone, Shield, Landmark, ShoppingCart, Fuel, UtensilsCrossed, Film, ShoppingBag, Heart, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AddExpenseDialog } from "./AddExpenseDialog";
import { EXPENSE_CATEGORIES, getCategoryById } from "@/constants/expenseCategories";
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
  coParents: any[];
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

export const MonthlyExpenses = ({ householdId, expenseCategories, monthlyExpenses, amounts, currency, saving, subscriptionsTotal, insuranceTotal, members, coParents, onAmountsChange, onSave, onCategoriesUpdate }: MonthlyExpensesProps) => {
  const { toast } = useToast();
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [addExpenseDialogOpen, setAddExpenseDialogOpen] = useState(false);
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

  // Special field states for Electricity
  const [electricityGrid, setElectricityGrid] = useState("");
  const [electricityMarket, setElectricityMarket] = useState("");

  // Special field states for Rent
  const [waterIncluded, setWaterIncluded] = useState(true);
  const [waterCost, setWaterCost] = useState("");

  const resetCategoryForm = () => {
    setCategoryFormData({
      name: "",
      type: "static",
      default_amount: "0",
    });
    setEditingCategoryId(null);
    setElectricityGrid("");
    setElectricityMarket("");
    setWaterIncluded(true);
    setWaterCost("");
  };

  // Helper to calculate display amount (includes water cost for Rent if not included)
  const getDisplayAmount = (category: any): string => {
    const baseAmount = parseFloat(amounts[category.id] || "0");

    // For Rent category, add water cost if not included
    if (category.category === "rent" && category.metadata) {
      const waterIncluded = category.metadata.water_included !== false;
      const waterCost = parseFloat(category.metadata.water_cost || "0");

      if (!waterIncluded && waterCost > 0) {
        return (baseAmount + waterCost).toString();
      }
    }

    return baseAmount.toString();
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
    // Find the category being edited to check for special fields
    const editingCategory = expenseCategories.find(c => c.id === editingCategoryId);

    // Build metadata object for Electricity and Rent
    let metadata = null;
    let calculatedDefaultAmount = parseFloat(categoryFormData.default_amount);

    if (editingCategory?.category === "electricity") {
      const grid = parseFloat(electricityGrid || "0");
      const market = parseFloat(electricityMarket || "0");

      metadata = {
        electricity_grid: grid,
        electricity_market: market,
      };

      // For Electricity, default_amount is the SUM of Grid + Market
      calculatedDefaultAmount = grid + market;
    } else if (editingCategory?.category === "rent") {
      metadata = {
        water_included: waterIncluded,
        water_cost: waterIncluded ? 0 : parseFloat(waterCost || "0"),
      };
    }

    const data: any = {
      household_id: householdId,
      name: categoryFormData.name,
      type: categoryFormData.type,
      default_amount: calculatedDefaultAmount,
      sort_order: expenseCategories.length,
    };

    // Add metadata if it exists
    if (metadata) {
      data.metadata = metadata;
    }

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
    const metadata = category.metadata || {};

    setCategoryFormData({
      name: category.name,
      type: category.type,
      default_amount: category.default_amount.toString(),
    });

    // Load Electricity metadata
    if (category.category === "electricity") {
      setElectricityGrid(metadata.electricity_grid?.toString() || "");
      setElectricityMarket(metadata.electricity_market?.toString() || "");
    }

    // Load Rent metadata
    if (category.category === "rent") {
      setWaterIncluded(metadata.water_included !== false);
      setWaterCost(metadata.water_cost?.toString() || "");
    }

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
              <CardDescription>Add expense categories with defaults, and adjust actual monthly expenses if needed. Click "Save Monthly Expenses" when done!</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="w-full sm:w-auto" onClick={() => setAddExpenseDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Expense
              </Button>
              <Dialog open={categoryDialogOpen} onOpenChange={(open) => {
                setCategoryDialogOpen(open);
                if (!open) resetCategoryForm();
              }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="w-full sm:w-auto">
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

                    {/* Electricity Special Fields */}
                    {editingCategoryId && expenseCategories.find(c => c.id === editingCategoryId)?.category === "electricity" && (
                      <>
                        <div className="space-y-2">
                          <Label>Grid Amount</Label>
                          <Input
                            type="number"
                            value={electricityGrid}
                            onChange={(e) => setElectricityGrid(e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Market Amount</Label>
                          <Input
                            type="number"
                            value={electricityMarket}
                            onChange={(e) => setElectricityMarket(e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Total: {(parseFloat(electricityGrid || "0") + parseFloat(electricityMarket || "0")).toFixed(0)}
                        </p>
                      </>
                    )}

                    {/* Rent Special Fields */}
                    {editingCategoryId && expenseCategories.find(c => c.id === editingCategoryId)?.category === "rent" && (
                      <>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={waterIncluded}
                            onCheckedChange={setWaterIncluded}
                          />
                          <Label>Water Included</Label>
                        </div>
                        {!waterIncluded && (
                          <div className="space-y-2">
                            <Label>Water Cost</Label>
                            <Input
                              type="number"
                              value={waterCost}
                              onChange={(e) => setWaterCost(e.target.value)}
                              placeholder="0"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    {editingCategoryId && (
                      <Button
                        variant="destructive"
                        onClick={() => {
                          handleDeleteCategory(editingCategoryId);
                          setCategoryDialogOpen(false);
                        }}
                        className="sm:mr-auto"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
                      Cancel
                    </Button>
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
              <div className="space-y-3">
                {sortedCategories.map((category) => {
                  const hasEntry = monthlyExpenses.some((m) => m.expense_category_id === category.id);
                  const isDifferent = amounts[category.id] !== category.default_amount.toString();

                  return (
                    <div
                      key={category.id}
                      className="p-3 sm:p-4 rounded-lg border border-border bg-background/40"
                    >
                      {/* Mobile: Compact layout */}
                      <div className="sm:hidden space-y-3">
                        {/* Top row: Icon + Title + Badge + Avatar */}
                        <div className="flex items-center gap-2">
                          {(() => {
                            const cat = getCategoryById(category.category || 'other');
                            const Icon = cat?.icon;
                            return Icon ? <Icon className="h-4 w-4" style={{ color: cat.color }} /> : null;
                          })()}
                          <p className="font-medium flex-1">{category.name}</p>
                          {(() => {
                            const cat = getCategoryById(category.category || 'other');
                            return (
                              <span
                                className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{
                                  backgroundColor: `${cat?.color}20`,
                                  color: cat?.color
                                }}
                              >
                                {cat?.label}
                              </span>
                            );
                          })()}
                          {(() => {
                            const creator = members.find(m => m.user_id === category.created_by);
                            const initials = creator?.profiles?.full_name
                              ?.split(' ')
                              .map(n => n[0])
                              .join('')
                              .toUpperCase() || '?';
                            return (
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={creator?.profiles?.avatar_url || undefined} />
                                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                              </Avatar>
                            );
                          })()}
                        </div>

                        {/* Bottom row: Amount input and edit button */}
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={getDisplayAmount(category)}
                            onChange={(e) =>
                              onAmountsChange({ ...amounts, [category.id]: e.target.value })
                            }
                            disabled={category.type === "static"}
                            className={`flex-1 text-base font-semibold ${isDifferent ? "border-primary" : ""} ${category.type === "static" ? "bg-background cursor-not-allowed" : ""}`}
                            placeholder="0"
                          />
                          <span className="text-sm text-muted-foreground whitespace-nowrap">{currency}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => handleEditCategory(category)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Desktop: Single line layout */}
                      <div className="hidden sm:flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {(() => {
                              const cat = getCategoryById(category.category || 'other');
                              const Icon = cat?.icon;
                              return Icon ? <Icon className="h-4 w-4" style={{ color: cat.color }} /> : null;
                            })()}
                            <p className="font-medium truncate">{category.name}</p>
                            {(() => {
                              const cat = getCategoryById(category.category || 'other');
                              return (
                                <span
                                  className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                                  style={{
                                    backgroundColor: `${cat?.color}20`,
                                    color: cat?.color
                                  }}
                                >
                                  {cat?.label}
                                </span>
                              );
                            })()}
                            {hasEntry && <Check className="h-4 w-4 text-success shrink-0" />}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={getDisplayAmount(category)}
                            onChange={(e) =>
                              onAmountsChange({ ...amounts, [category.id]: e.target.value })
                            }
                            disabled={category.type === "static"}
                            className={`w-32 text-lg font-semibold ${isDifferent ? "border-primary" : ""} ${category.type === "static" ? "bg-background cursor-not-allowed" : ""}`}
                            placeholder="0"
                          />
                          <span className="text-sm text-muted-foreground whitespace-nowrap">{currency}</span>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditCategory(category)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {(() => {
                            const creator = members.find(m => m.user_id === category.created_by);
                            const initials = creator?.profiles?.full_name
                              ?.split(' ')
                              .map(n => n[0])
                              .join('')
                              .toUpperCase() || '?';
                            return (
                              <Avatar className="h-9 w-9">
                                <AvatarImage src={creator?.profiles?.avatar_url || undefined} />
                                <AvatarFallback className="text-sm">{initials}</AvatarFallback>
                              </Avatar>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {subscriptionsTotal > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="p-3 sm:p-4 rounded-lg border border-border bg-muted/40 cursor-help">
                          {/* Mobile */}
                          <div className="sm:hidden space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-muted-foreground">Subscriptions</p>
                              <Badge variant="secondary" className="text-xs">auto</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={subscriptionsTotal.toFixed(0)}
                                disabled
                                className="flex-1 text-base font-semibold bg-muted/20"
                              />
                              <span className="text-sm text-muted-foreground whitespace-nowrap">{currency}</span>
                            </div>
                          </div>

                          {/* Desktop */}
                          <div className="hidden sm:flex items-center gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-muted-foreground truncate">Subscriptions</p>
                                <Badge variant="secondary" className="shrink-0 text-xs">auto</Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={subscriptionsTotal.toFixed(0)}
                                disabled
                                className="w-32 text-lg font-semibold bg-muted/20"
                              />
                              <span className="text-sm text-muted-foreground whitespace-nowrap">{currency}</span>
                            </div>
                            <div className="w-[72px]"></div>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>This amount is calculated from your active subscriptions</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {insuranceTotal > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="p-3 sm:p-4 rounded-lg border border-border bg-muted/40 cursor-help">
                          {/* Mobile */}
                          <div className="sm:hidden space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-muted-foreground">Insurance Savings</p>
                              <Badge variant="secondary" className="text-xs">auto</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={insuranceTotal.toFixed(0)}
                                disabled
                                className="flex-1 text-base font-semibold bg-muted/20"
                              />
                              <span className="text-sm text-muted-foreground whitespace-nowrap">{currency}</span>
                            </div>
                          </div>

                          {/* Desktop */}
                          <div className="hidden sm:flex items-center gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-muted-foreground truncate">Insurance Savings</p>
                                <Badge variant="secondary" className="shrink-0 text-xs">auto</Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={insuranceTotal.toFixed(0)}
                                disabled
                                className="w-32 text-lg font-semibold bg-muted/20"
                              />
                              <span className="text-sm text-muted-foreground whitespace-nowrap">{currency}</span>
                            </div>
                            <div className="w-[72px]"></div>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>This amount is calculated from your insurance policies</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              <Button onClick={onSave} disabled={saving} className="w-full">
                {saving ? "Saving..." : "Save Monthly Expenses"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <AddExpenseDialog
        open={addExpenseDialogOpen}
        onOpenChange={setAddExpenseDialogOpen}
        householdId={householdId}
        hasCoParents={coParents.length > 0}
        onSuccess={onCategoriesUpdate}
      />
    </div >
  );
};
