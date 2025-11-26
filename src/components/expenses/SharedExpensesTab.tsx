import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Plus, Trash2 } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface SharedExpense {
  id: string;
  description: string;
  amount: number;
  notes: string | null;
  co_parent_id: string;
  created_at: string;
  paid_by: "user" | "co_parent";
}

interface SharedExpensesTabProps {
  householdId: string;
  currency: string;
}

export const SharedExpensesTab = ({ householdId, currency }: SharedExpensesTabProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [coParents, setCoParents] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<SharedExpense[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    co_parent_id: "",
    notes: "",
    paid_by: "user" as "user" | "co_parent",
  });

  const currentMonth = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const fetchData = async () => {
    const [{ data: coParentsData }, { data: expensesData }] = await Promise.all([
      supabase.from("co_parents").select("*").eq("household_id", householdId),
      supabase
        .from("shared_expenses")
        .select("*, co_parents(name)")
        .eq("household_id", householdId)
        .eq("month", currentMonth)
        .order("created_at", { ascending: false }),
    ]);

    setCoParents(coParentsData || []);
    setExpenses(expensesData || []);
  };

  useEffect(() => {
    fetchData();
  }, [householdId]);

  const resetForm = () => {
    setFormData({
      description: "",
      amount: "",
      co_parent_id: coParents[0]?.id || "",
      notes: "",
      paid_by: "user",
    });
  };

  const handleSave = async () => {
    if (!user) return;

    const data = {
      household_id: householdId,
      co_parent_id: formData.co_parent_id,
      month: currentMonth,
      description: formData.description,
      amount: parseFloat(formData.amount),
      notes: formData.notes,
      paid_by: formData.paid_by,
      created_by: user.id,
    };

    const { error } = await supabase.from("shared_expenses").insert(data);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add shared expense",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Shared expense added",
      });
      setIsOpen(false);
      resetForm();
      fetchData();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("shared_expenses").delete().eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete expense",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Shared expense deleted",
      });
      fetchData();
    }
  };

  const totalSharedExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0);

  const expensesByCoParent = expenses.reduce((acc, exp) => {
    if (!acc[exp.co_parent_id]) {
      acc[exp.co_parent_id] = [];
    }
    acc[exp.co_parent_id].push(exp);
    return acc;
  }, {} as Record<string, SharedExpense[]>);

  if (coParents.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            No co-parents configured. Add a co-parent in Settings first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Shared Expenses Summary</CardTitle>
          <CardDescription>Track expenses you share with co-parents</CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <p className="text-sm text-muted-foreground">Total this month</p>
            <p className="text-3xl font-bold text-warning">
              {totalSharedExpenses.toFixed(0)} {currency}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Shared Expenses
          </CardTitle>
          <CardDescription>Items purchased that are shared with co-parents</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Shared Expense
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Shared Expense</DialogTitle>
                <DialogDescription>
                  Add an expense shared with a co-parent (e.g., kids' clothing, school supplies)
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Co-Parent</Label>
                  <Select value={formData.co_parent_id} onValueChange={(v) => setFormData({ ...formData, co_parent_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select co-parent" />
                    </SelectTrigger>
                    <SelectContent>
                      {coParents.map((cp) => (
                        <SelectItem key={cp.id} value={cp.id}>
                          {cp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="e.g., Rain clothing for school"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Paid by</Label>
                  <Select value={formData.paid_by} onValueChange={(v: "user" | "co_parent") => setFormData({ ...formData, paid_by: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">You</SelectItem>
                      <SelectItem value="co_parent">Co-parent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional details"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSave}>Add Expense</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {coParents.map((coParent) => {
            const coParentExpenses = expensesByCoParent[coParent.id] || [];
            if (coParentExpenses.length === 0) return null;

            const total = coParentExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0);

            return (
              <div key={coParent.id} className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">
                  {coParent.name} - {total.toFixed(0)} {currency}
                </h3>
                {coParentExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-start justify-between p-3 rounded-lg border border-border bg-background/40"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{expense.description}</p>
                        <Badge variant={expense.paid_by === "user" ? "destructive" : "default"}>
                          {expense.paid_by === "user" ? "You paid" : "They paid"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {expense.amount} {currency}
                        {expense.notes && ` • ${expense.notes}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(expense.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(expense.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            );
          })}

          {expenses.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No shared expenses this month. Add one above!
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};