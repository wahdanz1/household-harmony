import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, Plus, Trash2, Edit, Home, Zap, Wifi, Smartphone, Shield, Landmark, ShoppingCart, Fuel, UtensilsCrossed, Film, ShoppingBag, Heart, Sparkles } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ExpenseCategory {
  id: string;
  name: string;
  type: string;
  default_amount: number;
  icon: string | null;
  sort_order: number;
}

interface ExpenseCategoriesCardProps {
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

export const ExpenseCategoriesCard = ({ expenseCategories, householdId, currency, onUpdate }: ExpenseCategoriesCardProps) => {
  const getCategoryIcon = (name: string) => {
    const IconComponent = CATEGORY_ICONS[name];
    return IconComponent ? <IconComponent className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />;
  };
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    type: "static" | "dynamic";
    default_amount: string;
  }>({
    name: "",
    type: "static",
    default_amount: "0",
  });
  const { toast } = useToast();

  const resetForm = () => {
    setFormData({
      name: "",
      type: "static",
      default_amount: "0",
    });
    setEditingId(null);
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
      onUpdate();
    }
  };

  const handleSave = async () => {
    const data = {
      household_id: householdId,
      name: formData.name,
      type: formData.type,
      default_amount: parseFloat(formData.default_amount),
      sort_order: expenseCategories.length,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase
        .from("expense_categories")
        .update(data)
        .eq("id", editingId));
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
        description: editingId ? "Category updated" : "Category added",
      });
      setIsOpen(false);
      resetForm();
      onUpdate();
    }
  };

  const handleEdit = (category: ExpenseCategory) => {
    setFormData({
      name: category.name,
      type: category.type as "static" | "dynamic",
      default_amount: category.default_amount.toString(),
    });
    setEditingId(category.id);
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
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
      onUpdate();
    }
  };

  const staticCategories = expenseCategories.filter(c => c.type === "static");
  const dynamicCategories = expenseCategories.filter(c => c.type === "dynamic");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-destructive" />
          Expense Categories
        </CardTitle>
        <CardDescription>Organize your household expenses</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="flex-1">
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit" : "Add"} Expense Category</DialogTitle>
                <DialogDescription>
                  Create a new expense category for tracking
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g., Rent, Groceries"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({...formData, type: v as typeof formData.type})}>
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
                    value={formData.default_amount}
                    onChange={(e) => setFormData({...formData, default_amount: e.target.value})}
                    placeholder="0"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSave}>
                  {editingId ? "Update" : "Add"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {expenseCategories.length === 0 && (
            <Button variant="outline" onClick={initializeDefaults}>
              Load Defaults
            </Button>
          )}
        </div>

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
                        onClick={() => handleEdit(category)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(category.id)}
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
                        onClick={() => handleEdit(category)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(category.id)}
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
    </Card>
  );
};
