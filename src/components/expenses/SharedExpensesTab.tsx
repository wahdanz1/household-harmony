import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Plus, Trash2, Users, Edit } from "lucide-react";
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

interface CoParent {
  id: string;
  name: string;
  notes: string | null;
}

interface SharedExpensesTabProps {
  householdId: string;
  currency: string;
}

export const SharedExpensesTab = ({ householdId, currency }: SharedExpensesTabProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [coParents, setCoParents] = useState<CoParent[]>([]);
  const [expenses, setExpenses] = useState<SharedExpense[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    co_parent_id: "",
    notes: "",
    paid_by: "user" as "user" | "co_parent",
  });
  const [coParentDialogOpen, setCoParentDialogOpen] = useState(false);
  const [editingCoParentId, setEditingCoParentId] = useState<string | null>(null);
  const [coParentFormData, setCoParentFormData] = useState({
    name: "",
    notes: "",
  });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'expense' | 'coparent', id: string, name: string } | null>(null);

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

  const resetCoParentForm = () => {
    setCoParentFormData({ name: "", notes: "" });
    setEditingCoParentId(null);
  };

  const handleEditCoParent = (coParent: CoParent) => {
    setCoParentFormData({
      name: coParent.name,
      notes: coParent.notes || "",
    });
    setEditingCoParentId(coParent.id);
    setCoParentDialogOpen(true);
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

  const handleSaveCoParent = async () => {
    if (!user) return;

    const data = {
      household_id: householdId,
      name: coParentFormData.name,
      notes: coParentFormData.notes || null,
    };

    let error;
    if (editingCoParentId) {
      ({ error } = await supabase.from("co_parents").update(data).eq("id", editingCoParentId));
    } else {
      ({ error } = await supabase.from("co_parents").insert(data));
    }

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save co-parent",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: editingCoParentId ? "Co-parent updated" : "Co-parent added",
      });
      setCoParentDialogOpen(false);
      resetCoParentForm();
      fetchData();
    }
  };

  const confirmDelete = (type: 'expense' | 'coparent', id: string, name: string) => {
    setItemToDelete({ type, id, name });
    setDeleteConfirmOpen(true);
  };

  const handleConfirmedDelete = async () => {
    if (!itemToDelete) return;

    const table = itemToDelete.type === 'expense' ? 'shared_expenses' : 'co_parents';
    const { error } = await supabase.from(table).delete().eq("id", itemToDelete.id);

    if (error) {
      toast({
        title: "Error",
        description: `Failed to delete ${itemToDelete.type}`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `${itemToDelete.type === 'expense' ? 'Expense' : 'Co-parent'} deleted`,
      });
      fetchData();
    }

    setDeleteConfirmOpen(false);
    setItemToDelete(null);
  };

  const totalSharedExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0);

  const expensesByCoParent = expenses.reduce((acc, exp) => {
    if (!acc[exp.co_parent_id]) {
      acc[exp.co_parent_id] = [];
    }
    acc[exp.co_parent_id].push(exp);
    return acc;
  }, {} as Record<string, SharedExpense[]>);

  return (
    <div className="space-y-6">
      {/* Co-Parent Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Manage Co-Parents
              </CardTitle>
              <CardDescription>Add and manage people you share expenses with</CardDescription>
            </div>
            <Dialog open={coParentDialogOpen} onOpenChange={(open) => {
              setCoParentDialogOpen(open);
              if (!open) resetCoParentForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Co-Parent
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingCoParentId ? "Edit" : "Add"} Co-Parent</DialogTitle>
                  <DialogDescription>
                    Add someone you share expenses with (ex-partner, co-guardian, etc.)
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={coParentFormData.name}
                      onChange={(e) => setCoParentFormData({ ...coParentFormData, name: e.target.value })}
                      placeholder="e.g., Kids' Mom"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes (Optional)</Label>
                    <Textarea
                      value={coParentFormData.notes}
                      onChange={(e) => setCoParentFormData({ ...coParentFormData, notes: e.target.value })}
                      placeholder="Any additional context"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleSaveCoParent}>
                    {editingCoParentId ? "Update" : "Add"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {coParents.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No co-parents yet. Add one to get started!
            </p>
          ) : (
            <div className="space-y-2">
              {coParents.map((coParent) => (
                <div
                  key={coParent.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/40"
                >
                  <div>
                    <p className="font-medium">{coParent.name}</p>
                    {coParent.notes && (
                      <p className="text-sm text-muted-foreground">{coParent.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEditCoParent(coParent)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => confirmDelete('coparent', coParent.id, coParent.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {coParents.length === 0 ? null : (
        <>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => confirmDelete('expense', expense.id, expense.description)}
                        >
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
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{itemToDelete?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmedDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};