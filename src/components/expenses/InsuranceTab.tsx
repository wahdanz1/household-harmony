import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Shield, Plus, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Insurance {
  id: string;
  name: string;
  provider: string | null;
  type: string;
  total_amount: number;
  payment_frequency: string;
  invoice_month: number | null;
  notes: string | null;
  is_active: boolean;
  is_shared: boolean;
  co_parent_id: string | null;
  share_percentage: number;
}

interface InsuranceTabProps {
  householdId: string;
  currency: string;
}

const insuranceTypes = [
  { value: "home", label: "Home Insurance", color: "#3B82F6" },
  { value: "car", label: "Car Insurance", color: "#EF4444" },
  { value: "health", label: "Health Insurance", color: "#10B981" },
  { value: "life", label: "Life Insurance", color: "#8B5CF6" },
  { value: "pet", label: "Pet Insurance", color: "#F59E0B" },
  { value: "travel", label: "Travel Insurance", color: "#06B6D4" },
  { value: "liability", label: "Liability Insurance", color: "#EC4899" },
  { value: "other", label: "Other", color: "#64748B" },
];

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const InsuranceTab = ({ householdId, currency }: InsuranceTabProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [coParents, setCoParents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    provider: "",
    type: "home",
    total_amount: "",
    payment_frequency: "yearly",
    invoice_month: "" as string | "",
    notes: "",
    is_active: true,
    is_shared: false,
    co_parent_id: "",
    share_percentage: "50",
  });

  const fetchInsurances = async () => {
    const [{ data: insurancesData }, { data: coParentsData }] = await Promise.all([
      supabase.from("insurances").select("*").eq("household_id", householdId).order("name"),
      supabase.from("co_parents").select("*").eq("household_id", householdId),
    ]);

    setInsurances(insurancesData || []);
    setCoParents(coParentsData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchInsurances();
  }, [householdId]);

  const resetForm = () => {
    setFormData({
      name: "",
      provider: "",
      type: "home",
      total_amount: "",
      payment_frequency: "yearly",
      invoice_month: "",
      notes: "",
      is_active: true,
      is_shared: false,
      co_parent_id: "",
      share_percentage: "50",
    });
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!user) return;

    const data = {
      household_id: householdId,
      name: formData.name,
      provider: formData.provider || null,
      type: formData.type,
      total_amount: parseFloat(formData.total_amount),
      payment_frequency: formData.payment_frequency,
      invoice_month: formData.invoice_month && formData.invoice_month !== "0" ? parseInt(formData.invoice_month) : null,
      notes: formData.notes || null,
      is_active: formData.is_active,
      is_shared: formData.is_shared,
      co_parent_id: formData.is_shared ? formData.co_parent_id : null,
      share_percentage: formData.is_shared ? parseFloat(formData.share_percentage) : 50,
      created_by: user.id,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("insurances").update(data).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("insurances").insert(data));
    }

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save insurance",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: editingId ? "Insurance updated" : "Insurance added",
      });
      setIsOpen(false);
      resetForm();
      fetchInsurances();
    }
  };

  const handleEdit = (insurance: Insurance) => {
    // TEMPORARY: Extract month from old date strings
    let monthValue = "";
    if (insurance.invoice_month) {
      const dateStr = insurance.invoice_month.toString();
      if (dateStr.includes("-")) {
        // Old format: "2024-12-15" -> extract month
        const date = new Date(dateStr);
        monthValue = (date.getMonth() + 1).toString(); // Convert to "12"
      } else {
        // New format: already a number
        monthValue = dateStr;
      }
    }

    setFormData({
      name: insurance.name,
      provider: insurance.provider || "",
      type: insurance.type,
      total_amount: insurance.total_amount.toString(),
      payment_frequency: insurance.payment_frequency,
      invoice_month: monthValue,  // ✅ Now converts old dates to month numbers
      notes: insurance.notes || "",
      is_active: insurance.is_active,
      is_shared: insurance.is_shared,
      co_parent_id: insurance.co_parent_id || "",
      share_percentage: insurance.share_percentage.toString(),
    });
    setEditingId(insurance.id);
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("insurances").delete().eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete insurance",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Insurance deleted",
      });
      fetchInsurances();
    }
  };

  const calculateMonthlySavings = () => {
    return insurances
      .filter((i) => i.is_active)
      .reduce((total, ins) => {
        let monthlyAmount = 0;
        if (ins.payment_frequency === "yearly") monthlyAmount = ins.total_amount / 12;
        else if (ins.payment_frequency === "semi_annually") monthlyAmount = ins.total_amount / 6;
        else if (ins.payment_frequency === "quarterly") monthlyAmount = ins.total_amount / 3;
        else monthlyAmount = ins.total_amount;

        if (ins.is_shared) {
          monthlyAmount = monthlyAmount * (ins.share_percentage / 100);
        }
        return total + monthlyAmount;
      }, 0);
  };

  const calculateTotalAnnual = () => {
    return insurances
      .filter((i) => i.is_active)
      .reduce((total, ins) => {
        if (ins.payment_frequency === "yearly") return total + ins.total_amount;
        if (ins.payment_frequency === "semi_annually") return total + ins.total_amount * 2;
        if (ins.payment_frequency === "quarterly") return total + ins.total_amount * 4;
        return total + ins.total_amount * 12;
      }, 0);
  };

  const activeInsurances = insurances.filter((i) => i.is_active);
  const inactiveInsurances = insurances.filter((i) => !i.is_active);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Insurance Summary</CardTitle>
          <CardDescription>Save monthly to cover annual insurance payments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-2">
            {/* Monthly Cost */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Monthly Cost</p>
              <div className="text-2xl font-bold text-warning">
                {calculateMonthlySavings().toFixed(0)} {currency}
              </div>
            </div>

            {/* Yearly Cost */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Yearly Cost</p>
              <div className="text-2xl font-bold">
                {calculateTotalAnnual().toFixed(0)} {currency}
              </div>
            </div>

            {/* Average Monthly */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Average Monthly</p>
              <div className="text-2xl font-bold">
                {activeInsurances.length > 0 ? (
                  <>
                    {(calculateMonthlySavings() / activeInsurances.length).toFixed(0)} {currency}
                  </>
                ) : "0 " + currency}
              </div>
            </div>

            {/* Active Count */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Active Policies</p>
              <div className="text-2xl font-bold">
                {activeInsurances.length}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Active Insurances
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
                Add Insurance
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit" : "Add"} Insurance</DialogTitle>
                <DialogDescription>Manage your insurance policies</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Home Insurance 2024"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {insuranceTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Provider (Optional)</Label>
                  <Input
                    value={formData.provider}
                    onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                    placeholder="Insurance Company Name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Total Amount</Label>
                  <Input
                    type="number"
                    value={formData.total_amount}
                    onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Payment Frequency</Label>
                  <Select value={formData.payment_frequency} onValueChange={(v) => setFormData({ ...formData, payment_frequency: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yearly">Yearly</SelectItem>
                      <SelectItem value="semi_annually">Semi-annually (6 months)</SelectItem>
                      <SelectItem value="quarterly">Quarterly (3 months)</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.payment_frequency === "yearly" && (
                  <div className="space-y-2">
                    <Label>Invoice Month (Optional)</Label>
                    <Select value={formData.invoice_month} onValueChange={(v) => setFormData({ ...formData, invoice_month: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select month when invoice arrives" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Not set</SelectItem>
                        {monthNames.map((month, index) => (
                          <SelectItem key={index + 1} value={(index + 1).toString()}>
                            {month}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Which month do you typically receive this invoice? Leave blank if unknown.
                    </p>
                  </div>
                )}

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

                {coParents.length > 0 && (
                  <div className="space-y-4 border-t border-border pt-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={formData.is_shared}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_shared: checked })}
                      />
                      <Label>Shared with co-parent (50/50)</Label>
                    </div>

                    {formData.is_shared && (
                      <>
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
                          <Label>Your Share (%)</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={formData.share_percentage}
                            onChange={(e) => setFormData({ ...formData, share_percentage: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground">
                            You pay {formData.share_percentage}%, they pay {100 - parseFloat(formData.share_percentage || "0")}%
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}
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
            {activeInsurances.map((insurance) => {
              const monthlyAmount =
                insurance.payment_frequency === "yearly" ? insurance.total_amount / 12 :
                  insurance.payment_frequency === "semi_annually" ? insurance.total_amount / 6 :
                    insurance.payment_frequency === "quarterly" ? insurance.total_amount / 3 :
                      insurance.total_amount;

              return (
                <div
                  key={insurance.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/40"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{insurance.name}</p>
                      {(() => {
                        const type = insuranceTypes.find((t) => t.value === insurance.type);
                        return (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: `${type?.color}20`,
                              color: type?.color
                            }}
                          >
                            {type?.label || insurance.type}
                          </span>
                        );
                      })()}
                      {insurance.is_shared && (
                        <Badge variant="secondary">{insurance.share_percentage}% shared</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {monthlyAmount.toFixed(0)} {currency}/month • {insurance.payment_frequency}
                      {insurance.provider && ` • ${insurance.provider}`}
                    </p>
                    {insurance.invoice_month && (
                      <p className="text-xs text-muted-foreground">
                        Invoice typically arrives: {monthNames[insurance.invoice_month - 1]}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(insurance)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {activeInsurances.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No active insurances yet. Add one above!</p>
            )}
          </div>
        </CardContent>
      </Card>

      {inactiveInsurances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Inactive Insurances</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {inactiveInsurances.map((insurance) => (
              <div
                key={insurance.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/40 opacity-60"
              >
                <div className="flex-1">
                  <p className="font-medium">{insurance.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {insurance.total_amount} {currency} / {insurance.payment_frequency.replace("_", " ")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(insurance)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(insurance.id)}>
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