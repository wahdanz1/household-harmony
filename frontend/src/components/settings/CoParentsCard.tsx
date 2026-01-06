import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, Plus, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CoParent {
  id: string;
  name: string;
  notes: string | null;
}

interface CoParentsCardProps {
  householdId: string;
  onUpdate: () => void;
  compact?: boolean;
}

export const CoParentsCard = ({ householdId, onUpdate, compact = false }: CoParentsCardProps) => {
  const { toast } = useToast();
  const [coParents, setCoParents] = useState<CoParent[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    notes: "",
  });

  const fetchCoParents = async () => {
    const { data } = await supabase
      .from("co_parents")
      .select("*")
      .eq("household_id", householdId)
      .order("name");

    setCoParents(data || []);
  };

  useEffect(() => {
    fetchCoParents();
  }, [householdId]);

  const resetForm = () => {
    setFormData({ name: "", notes: "" });
    setEditingId(null);
  };

  const handleSave = async () => {
    const data = {
      household_id: householdId,
      name: formData.name,
      notes: formData.notes,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("co_parents").update(data).eq("id", editingId));
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
        description: editingId ? "Co-parent updated" : "Co-parent added",
      });
      setIsOpen(false);
      resetForm();
      fetchCoParents();
      onUpdate();
    }
  };

  const handleEdit = (coParent: CoParent) => {
    setFormData({
      name: coParent.name,
      notes: coParent.notes || "",
    });
    setEditingId(coParent.id);
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("co_parents").delete().eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete co-parent",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Co-parent deleted",
      });
      fetchCoParents();
      onUpdate();
    }
  };

  const content = (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) resetForm();
      }}>
        <DialogTrigger asChild>
          <Button className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Co-Parent
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit" : "Add"} Co-Parent</DialogTitle>
            <DialogDescription>
              Add someone you share expenses with (ex-partner, co-guardian, etc.)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Kids' Mom"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional context"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave}>{editingId ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {coParents.length > 0 ? (
        <div className="space-y-2">
          {coParents.map((coParent) => (
            <div
              key={coParent.id}
              className="list-row-compact"
            >
              <div>
                <p className="font-medium">{coParent.name}</p>
                {coParent.notes && (
                  <p className="text-sm text-muted-foreground">{coParent.notes}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => handleEdit(coParent)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(coParent.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-muted-foreground py-4">
          No co-parents added yet
        </p>
      )}
    </>
  );

  if (compact) {
    return <div className="space-y-4">{content}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Co-Parents
        </CardTitle>
        <CardDescription>
          Manage shared financial arrangements (e.g., shared custody expenses)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {content}
      </CardContent>
    </Card>
  );
};