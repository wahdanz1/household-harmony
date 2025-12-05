import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CreditCard, Plus, Edit, Trash2, CalendarIcon, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DataListItem } from "@/components/ui/data-list-item";
import { useTabCrud } from "@/components/expenses/hooks/useTabCrud";
import { SummaryStatsCard } from "@/components/expenses/SummaryStatsCard";
import { subscriptionCategories } from "@/constants/subscriptionCategories";
import { getCategoryIcon, getCategoryBadgeStyle } from "@/utils/categoryHelpers";

interface SubscriptionFormData {
  name: string;
  amount: string;
  billing_cycle: string;
  next_billing_date: Date;
  category: string;
  notes: string;
  is_active: boolean;
  billing_day?: number;
  billing_month?: number;
}

interface SubscriptionsTabProps {
  householdId: string;
  currency: string;
}

export const SubscriptionsTab = ({ householdId, currency }: SubscriptionsTabProps) => {
  const {
    items: subscriptions,
    loading,
    isOpen,
    setIsOpen,
    editingId,
    formData,
    setFormData,
    handleSave,
    handleEdit: handleEditBase,
    handleDelete,
    resetForm,
    activeItems: activeSubscriptions,
    inactiveItems: inactiveSubscriptions,
  } = useTabCrud<SubscriptionFormData>({
    tableName: "subscriptions",
    householdId,
    defaultFormData: {
      name: "",
      amount: "",
      billing_cycle: "monthly",
      next_billing_date: new Date(),
      category: "other",
      notes: "",
      is_active: true,
      billing_day: undefined,
      billing_month: undefined,
    },
    toastMessages: {
      add: "Subscription added",
      update: "Subscription updated",
      delete: "Subscription deleted",
      saveError: "Failed to save subscription",
      deleteError: "Failed to delete subscription",
    },
    transformDataBeforeSave: (data, userId, householdId) => ({
      household_id: householdId,
      name: data.name,
      amount: parseFloat(data.amount),
      billing_cycle: data.billing_cycle,
      next_billing_date: format(data.next_billing_date, "yyyy-MM-dd"),
      category: data.category,
      notes: data.notes,
      is_active: data.is_active,
      created_by: userId,
      billing_day: data.billing_cycle === "yearly" ? data.billing_day : null,
      billing_month: data.billing_cycle === "yearly" ? data.billing_month : null,
    }),
    transformDataOnEdit: (subscription) => ({
      name: subscription.name,
      amount: subscription.amount.toString(),
      billing_cycle: subscription.billing_cycle,
      next_billing_date: subscription.next_billing_date ? new Date(subscription.next_billing_date) : new Date(),
      category: subscription.category || "other",
      notes: subscription.notes || "",
      is_active: subscription.is_active,
      billing_day: subscription.billing_day,
      billing_month: subscription.billing_month,
    }),
  });

  const handleEdit = (subscription: any) => {
    handleEditBase(subscription);
  };

  const calculateMonthlyTotal = () => {
    return subscriptions
      .filter((s) => s.is_active)
      .reduce((total, sub) => {
        const amount = parseFloat(sub.amount.toString());
        if (sub.billing_cycle === "yearly") return total + amount / 12;
        if (sub.billing_cycle === "quarterly") return total + amount / 3;
        return total + amount;
      }, 0);
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  const monthlyTotal = calculateMonthlyTotal();

  return (
    <div className="space-y-6">
      <SummaryStatsCard
        title="Subscriptions Summary"
        description="Overview of your recurring subscription costs"
        stats={[
          {
            label: "Total Monthly",
            value: `${monthlyTotal.toFixed(0)} ${currency}`,
            className: "text-destructive",
          },
          {
            label: "Yearly Cost",
            value: `${(monthlyTotal * 12).toFixed(0)} ${currency}`,
          },
          {
            label: "Most Expensive",
            value: activeSubscriptions.length > 0
              ? `${Math.max(...activeSubscriptions.map(s => {
                const amount = parseFloat(s.amount.toString());
                if (s.billing_cycle === "yearly") return amount / 12;
                if (s.billing_cycle === "quarterly") return amount / 3;
                return amount;
              })).toFixed(0)} ${currency}`
              : `0 ${currency}`,
          },
          {
            label: "Active Subscriptions",
            value: activeSubscriptions.length,
          },
        ]}
      />

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
                          <div className="flex items-center gap-2">
                            <cat.icon className="h-4 w-4" />
                            {cat.label}
                          </div>
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

                {formData.billing_cycle === "yearly" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Billing Month</Label>
                      <Select
                        value={formData.billing_month?.toString()}
                        onValueChange={(v) => setFormData({ ...formData, billing_month: parseInt(v) })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                            <SelectItem key={month} value={month.toString()}>
                              {format(new Date(2024, month - 1, 1), "MMMM")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Billing Day</Label>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        value={formData.billing_day || ""}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 1 && val <= 31) {
                            setFormData({ ...formData, billing_day: val });
                          }
                        }}
                        placeholder="Day (1-31)"
                      />
                    </div>
                  </div>
                )}

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
              <DialogFooter className="flex-col gap-2">
                <Button onClick={handleSave} className="w-full">
                  {editingId ? "Update" : "Add"}
                </Button>
                {editingId && (
                  <div className="flex gap-2 w-full">
                    <Button variant="outline" onClick={() => setIsOpen(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        handleDelete(editingId);
                        setIsOpen(false);
                      }}
                      className="flex-1"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="space-y-2">
            {activeSubscriptions.map((subscription) => (
              <DataListItem
                key={subscription.id}
                onClick={() => handleEdit(subscription)}
              >
                {/* Mobile: Two-line layout */}
                <div className="sm:hidden space-y-3">
                  {/* Top row: Icon + Title */}
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(subscription.category, subscriptionCategories, MoreHorizontal)}
                    <p className="font-medium flex-1 truncate">{subscription.name}</p>
                  </div>
                  {/* Bottom row: Amount and edit button */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {subscription.amount} {currency} / {subscription.billing_cycle}
                    </p>
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(subscription);
                    }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Desktop: Single line layout */}
                <div className="hidden sm:flex items-center gap-2">
                  {getCategoryIcon(subscription.category, subscriptionCategories, MoreHorizontal)}
                  <p className="font-medium truncate">{subscription.name}</p>
                  {subscription.category && (() => {
                    const badgeStyle = getCategoryBadgeStyle(subscription.category, subscriptionCategories);
                    const cat = subscriptionCategories.find((c) => c.value === subscription.category);
                    return (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                        style={badgeStyle}
                      >
                        {cat?.label || subscription.category}
                      </span>
                    );
                  })()}
                  <div className="flex-1" /> {/* Spacer */}
                  <p className="text-sm text-muted-foreground whitespace-nowrap">
                    {subscription.amount} {currency} / {subscription.billing_cycle}
                  </p>
                  <Button variant="ghost" size="icon" onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(subscription);
                  }}>
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </DataListItem>
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
