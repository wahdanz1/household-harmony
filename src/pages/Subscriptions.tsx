import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CreditCard, Plus, Edit, Trash2, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Subscription {
  id: string;
  name: string;
  amount: number;
  billing_cycle: string;
  next_billing_date: string | null;
  category: string | null;
  notes: string | null;
  is_active: boolean;
}

const Subscriptions = () => {
  const { user } = useAuth();
  const [household, setHousehold] = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    amount: "",
    billing_cycle: "monthly",
    next_billing_date: "",
    category: "",
    notes: "",
    is_active: true,
  });
  const { toast } = useToast();

  const fetchData = async () => {
    if (!user) return;

    const { data: householdData } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .single();

    if (!householdData) return;

    const [{ data: householdInfo }, { data: subscriptionsData }] = await Promise.all([
      supabase.from("households").select("*").eq("id", householdData.household_id).single(),
      supabase.from("subscriptions").select("*").eq("household_id", householdData.household_id).order("name"),
    ]);

    setHousehold(householdInfo);
    setSubscriptions(subscriptionsData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const resetForm = () => {
    setFormData({
      name: "",
      amount: "",
      billing_cycle: "monthly",
      next_billing_date: "",
      category: "",
      notes: "",
      is_active: true,
    });
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!household || !user) return;

    const data = {
      household_id: household.id,
      name: formData.name,
      amount: parseFloat(formData.amount),
      billing_cycle: formData.billing_cycle,
      next_billing_date: formData.next_billing_date || null,
      category: formData.category || null,
      notes: formData.notes || null,
      is_active: formData.is_active,
      created_by: user.id,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase
        .from("subscriptions")
        .update(data)
        .eq("id", editingId));
    } else {
      ({ error } = await supabase
        .from("subscriptions")
        .insert(data));
    }

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save subscription",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: editingId ? "Subscription updated" : "Subscription added",
      });
      setIsOpen(false);
      resetForm();
      fetchData();
    }
  };

  const handleEdit = (subscription: Subscription) => {
    setFormData({
      name: subscription.name,
      amount: subscription.amount.toString(),
      billing_cycle: subscription.billing_cycle,
      next_billing_date: subscription.next_billing_date || "",
      category: subscription.category || "",
      notes: subscription.notes || "",
      is_active: subscription.is_active,
    });
    setEditingId(subscription.id);
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("subscriptions").delete().eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete subscription",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Subscription deleted",
      });
      fetchData();
    }
  };

  const calculateMonthlyTotal = () => {
    return subscriptions
      .filter(s => s.is_active)
      .reduce((total, sub) => {
        let monthlyAmount = sub.amount;
        if (sub.billing_cycle === "yearly") monthlyAmount = sub.amount / 12;
        if (sub.billing_cycle === "quarterly") monthlyAmount = sub.amount / 3;
        return total + monthlyAmount;
      }, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!household) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">No household found</p>
      </div>
    );
  }

  const activeSubscriptions = subscriptions.filter(s => s.is_active);
  const inactiveSubscriptions = subscriptions.filter(s => !s.is_active);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
        <p className="text-muted-foreground mt-1">Manage recurring payments</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Total</CardTitle>
          <CardDescription>Total monthly subscription cost</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-primary">
            {calculateMonthlyTotal().toFixed(2)} {household.currency}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {activeSubscriptions.length} active subscription{activeSubscriptions.length !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Active Subscriptions
          </CardTitle>
          <CardDescription>Your recurring payments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Subscription
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit" : "Add"} Subscription</DialogTitle>
                <DialogDescription>
                  Track recurring payments and subscriptions
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g., Netflix, Spotify"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Amount *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Billing Cycle</Label>
                  <Select value={formData.billing_cycle} onValueChange={(v) => setFormData({...formData, billing_cycle: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Next Billing Date</Label>
                  <Input
                    type="date"
                    value={formData.next_billing_date}
                    onChange={(e) => setFormData({...formData, next_billing_date: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    placeholder="e.g., Streaming, Software, Membership"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Optional notes"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Active</Label>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
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

          {activeSubscriptions.length > 0 ? (
            <div className="space-y-2">
              {activeSubscriptions.map((subscription) => (
                <div
                  key={subscription.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-background/40"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{subscription.name}</p>
                      {subscription.category && (
                        <Badge variant="secondary">{subscription.category}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {subscription.amount} {household.currency}
                      </span>
                      <span>• {subscription.billing_cycle}</span>
                      {subscription.next_billing_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(subscription.next_billing_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(subscription)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(subscription.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No active subscriptions yet. Add one to get started!
            </p>
          )}
        </CardContent>
      </Card>

      {inactiveSubscriptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Inactive Subscriptions</CardTitle>
            <CardDescription>Cancelled or paused subscriptions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {inactiveSubscriptions.map((subscription) => (
                <div
                  key={subscription.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-background/20 opacity-60"
                >
                  <div className="flex-1">
                    <p className="font-medium">{subscription.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {subscription.amount} {household.currency} • {subscription.billing_cycle}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(subscription)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(subscription.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Subscriptions;
