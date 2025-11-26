import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Plus, Trash2, Edit } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface IncomeSource {
  id: string;
  category: string;
  name: string;
  type: string;
  default_amount: number;
  is_active: boolean;
  owner_id: string;
  profiles: {
    full_name: string;
  };
}

interface IncomeSourcesCardProps {
  incomeSources: IncomeSource[];
  householdId: string;
  members: any[];
  currency: string;
  onUpdate: () => void;
}

export const IncomeSourcesCard = ({ incomeSources, householdId, members, currency, onUpdate }: IncomeSourcesCardProps) => {
  const formatCategory = (category: string) => {
    return category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    category: "salary" | "business_income" | "government_benefits" | "investment_income" | "gift" | "other";
    name: string;
    type: "static" | "variable";
    default_amount: string;
    owner_id: string;
  }>({
    category: "salary",
    name: "",
    type: "static",
    default_amount: "0",
    owner_id: members[0]?.user_id || "",
  });
  const { toast } = useToast();

  const resetForm = () => {
    setFormData({
      category: "salary",
      name: "",
      type: "static",
      default_amount: "0",
      owner_id: members[0]?.user_id || "",
    });
    setEditingId(null);
  };

  const handleSave = async () => {
    const data = {
      household_id: householdId,
      category: formData.category,
      name: formData.name,
      type: formData.type,
      default_amount: parseFloat(formData.default_amount),
      owner_id: formData.owner_id,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase
        .from("income_sources")
        .update(data)
        .eq("id", editingId));
    } else {
      ({ error } = await supabase
        .from("income_sources")
        .insert(data));
    }

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save income source",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: editingId ? "Income source updated" : "Income source added",
      });
      setIsOpen(false);
      resetForm();
      onUpdate();
    }
  };

  const handleEdit = (source: IncomeSource) => {
    setFormData({
      category: source.category as "salary" | "business_income" | "government_benefits" | "investment_income" | "gift" | "other",
      name: source.name,
      type: source.type as "static" | "variable",
      default_amount: source.default_amount.toString(),
      owner_id: source.owner_id,
    });
    setEditingId(source.id);
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("income_sources")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete income source",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Income source deleted",
      });
      onUpdate();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-success" />
          Income Sources
        </CardTitle>
        <CardDescription>Define your household's income sources</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Income Source
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit" : "Add"} Income Source</DialogTitle>
              <DialogDescription>
                Configure a recurring income source for your household
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v as typeof formData.category})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="salary">Salary</SelectItem>
                    <SelectItem value="business_income">Business Income</SelectItem>
                    <SelectItem value="government_benefits">Government Benefits</SelectItem>
                    <SelectItem value="investment_income">Investment Income</SelectItem>
                    <SelectItem value="gift">Gift</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., Dad's Salary"
                />
              </div>

              <div className="space-y-2">
                <Label>Owner</Label>
                <Select value={formData.owner_id} onValueChange={(v) => setFormData({...formData, owner_id: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.profiles.full_name || member.profiles.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({...formData, type: v as typeof formData.type})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="static">Static (Fixed amount)</SelectItem>
                    <SelectItem value="variable">Variable (Changes monthly)</SelectItem>
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

        <div className="space-y-2">
          {incomeSources.map((source) => (
            <div
              key={source.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/40"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{source.name}</p>
                  <Badge variant="outline">{formatCategory(source.category)}</Badge>
                  <Badge variant={source.type === "static" ? "secondary" : "outline"}>
                    {source.type}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {source.profiles.full_name} • {source.default_amount} {currency}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEdit(source)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(source.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {incomeSources.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No income sources yet. Add your first one above!
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
