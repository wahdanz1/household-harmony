import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CreditCard, Plus, Edit, Trash2, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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

interface SubscriptionsTabProps {
  householdId: string;
  currency: string;
}

const subscriptionCategories = [
  { value: "streaming", label: "Streaming", color: "#EC4899" },
  { value: "software", label: "Software & Apps", color: "#8B5CF6" },
  { value: "music", label: "Music", color: "#10B981" },
  { value: "gaming", label: "Gaming", color: "#F59E0B" },
  { value: "gym", label: "Gym & Fitness", color: "#EF4444" },
  { value: "news", label: "News & Media", color: "#3B82F6" },
  { value: "storage", label: "Cloud Storage", color: "#06B6D4" },
  { value: "education", label: "Education & Learning", color: "#A855F7" },
  { value: "other", label: "Other", color: "#64748B" },
];

export const SubscriptionsTab = ({ householdId, currency }: SubscriptionsTabProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    amount: "",
    billing_cycle: "monthly",
    next_billing_date: new Date(),
    category: "other",
    notes: "",
    is_active: true,
  });

  const fetchSubscriptions = async () => {
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("household_id", householdId)
      .order("name");

    setSubscriptions(data || []);
    setLoading(false);
  };

  useState(() => {
    fetchSubscriptions();
  });

  const resetForm = () => {
    setFormData({
      name: "",
      amount: "",
      billing_cycle: "monthly",
      next_billing_date: new Date(),
      category: "other",
      notes: "",
      is_active: true,
    });
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!user) return;

    const data = {
      household_id: householdId,
      name: formData.name,
      amount: parseFloat(formData.amount),
      billing_cycle: formData.billing_cycle,
      next_billing_date: format(formData.next_billing_date, "yyyy-MM-dd"),
      category: formData.category,
      notes: formData.notes,
      is_active: formData.is_active,
      created_by: user.id,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("subscriptions").update(data).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("subscriptions").insert(data));
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
      fetchSubscriptions();
    }
  };

  const handleEdit = (subscription: Subscription) => {
    setFormData({
      name: subscription.name,
      amount: subscription.amount.toString(),
      billing_cycle: subscription.billing_cycle,
      next_billing_date: subscription.next_billing_date ? new Date(subscription.next_billing_date) : new Date(),
      category: subscription.category || "other",
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
      fetchSubscriptions();
    }
  };

  const calculateMonthlyTotal = () => {
    return subscriptions
      .filter((s) => s.is_active)
      .reduce((total, sub) => {
        if (sub.billing_cycle === "yearly") return total + sub.amount / 12;
        if (sub.billing_cycle === "quarterly") return total + sub.amount / 3;
        return total + sub.amount;
      }, 0);
  };

  const activeSubscriptions = subscriptions.filter((s) => s.is_active);
  const inactiveSubscriptions = subscriptions.filter((s) => !s.is_active);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Subscriptions Summary</CardTitle>
          <CardDescription>Overview of your recurring subscription costs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Total Monthly */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Monthly</p>
              <div className="text-2xl font-bold text-destructive">
                {calculateMonthlyTotal().toFixed(0)} {currency}
              </div>
            </div>

            {/* Yearly Cost */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Yearly Cost</p>
              <div className="text-2xl font-bold">
                {(calculateMonthlyTotal() * 12).toFixed(0)} {currency}
              </div>
            </div>

            {/* Most Expensive */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Most Expensive</p>
              <div className="text-2xl font-bold">
                {activeSubscriptions.length > 0 ? (
                  <>
                    {Math.max(...activeSubscriptions.map(s => {
                      if (s.billing_cycle === "yearly") return s.amount / 12;
                      if (s.billing_cycle === "quarterly") return s.amount / 3;
                      return s.amount;
                    })).toFixed(0)} {currency}
                  </>
                ) : "0 " + currency}
              </div>
            </div>

            {/* Active Count */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Active Subscriptions</p>
              <div className="text-2xl font-bold">
                {activeSubscriptions.length}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Active Subscriptions
          </CardTitle>
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
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit" : "Add"} Subscription</DialogTitle>
                <DialogDescription>Manage your recurring subscription services</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Netflix, Spotify, etc."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {subscriptionCategories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Label>Billing Cycle</Label>
                  <Select value={formData.billing_cycle} onValueChange={(v) => setFormData({ ...formData, billing_cycle: v })}>
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
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(formData.next_billing_date, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.next_billing_date}
                        onSelect={(date) => date && setFormData({ ...formData, next_billing_date: date })}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Optional notes"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label>Active</Label>
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                {editingId && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      handleDelete(editingId);
                      setIsOpen(false);
                    }}
                    className="sm:mr-auto"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                )}
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>{editingId ? "Update" : "Add"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="space-y-2">
            {activeSubscriptions.map((subscription) => (
              <div
                key={subscription.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/40"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{subscription.name}</p>
                    {subscription.category && (() => {
                      const cat = subscriptionCategories.find((c) => c.value === subscription.category);
                      return (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: `${cat?.color}20`,
                            color: cat?.color
                          }}
                        >
                          {cat?.label || subscription.category}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {subscription.amount} {currency} / {subscription.billing_cycle}
                    {subscription.next_billing_date && ` • Next: ${format(new Date(subscription.next_billing_date), "MMM d, yyyy")}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(subscription)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {activeSubscriptions.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No active subscriptions yet. Add one above!</p>
            )}
          </div>
        </CardContent>
      </Card>

      {inactiveSubscriptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Inactive Subscriptions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {inactiveSubscriptions.map((subscription) => (
              <div
                key={subscription.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/40 opacity-60"
              >
                <div className="flex-1">
                  <p className="font-medium">{subscription.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {subscription.amount} {currency} / {subscription.billing_cycle}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(subscription)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(subscription.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
