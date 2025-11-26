import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, Plus, Calculator, TrendingUp, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  priority: "high" | "medium" | "low";
  description: string | null;
  goal_type: "household" | "personal";
  owner_id: string | null;
  is_active: boolean;
  monthly_contribution: number;
  image_url: string | null;
}

const Savings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState("SEK");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Calculator state
  const [calcTarget, setCalcTarget] = useState("");
  const [calcMonthly, setCalcMonthly] = useState("");
  const [calcMonths, setCalcMonths] = useState("12");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    target_amount: "",
    current_amount: "0",
    monthly_contribution: "",
    priority: "medium" as "high" | "medium" | "low",
    description: "",
    goal_type: "household" as "household" | "personal",
    image_url: "",
  });

  useEffect(() => {
    fetchGoals();
    fetchHouseholdCurrency();
  }, [user]);

  const fetchHouseholdCurrency = async () => {
    if (!user) return;
    
    const { data: member } = await supabase
      .from("household_members")
      .select("household_id, households(currency)")
      .eq("user_id", user.id)
      .single();

    if (member?.households) {
      setCurrency((member.households as any).currency);
    }
  };

  const fetchGoals = async () => {
    if (!user) return;

    const { data: member } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .single();

    if (!member) return;

    const { data, error } = await supabase
      .from("savings_goals")
      .select("*")
      .eq("household_id", member.household_id)
      .eq("is_active", true)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error loading goals", description: error.message, variant: "destructive" });
    } else {
      setGoals((data as SavingsGoal[]) || []);
    }
    setLoading(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    setUploadingImage(true);

    const fileExt = file.name.split(".").pop();
    const filePath = `goals/${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError, data } = await supabase.storage
      .from("avatars")
      .upload(filePath, file);

    if (uploadError) {
      toast({ title: "Failed to upload image", description: uploadError.message, variant: "destructive" });
      setUploadingImage(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    setFormData({ ...formData, image_url: publicUrl });
    setUploadingImage(false);
    toast({ title: "Image uploaded successfully" });
  };

  const handleSaveGoal = async () => {
    if (!user) return;

    const { data: member } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .single();

    if (!member) return;

    const goalData = {
      household_id: member.household_id,
      name: formData.name,
      target_amount: parseFloat(formData.target_amount),
      current_amount: parseFloat(formData.current_amount),
      monthly_contribution: parseFloat(formData.monthly_contribution) || 0,
      priority: formData.priority,
      description: formData.description || null,
      goal_type: formData.goal_type,
      owner_id: formData.goal_type === "personal" ? user.id : null,
      image_url: formData.image_url || null,
      created_by: user.id,
    };

    if (editingGoal) {
      const { error } = await supabase
        .from("savings_goals")
        .update(goalData)
        .eq("id", editingGoal.id);

      if (error) {
        toast({ title: "Error updating goal", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Goal updated successfully" });
        fetchGoals();
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from("savings_goals")
        .insert(goalData);

      if (error) {
        toast({ title: "Error creating goal", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Goal created successfully" });
        fetchGoals();
        resetForm();
      }
    }
  };

  const handleDeleteGoal = async (id: string) => {
    const { error } = await supabase
      .from("savings_goals")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      toast({ title: "Error deleting goal", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Goal deleted" });
      fetchGoals();
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      target_amount: "",
      current_amount: "0",
      monthly_contribution: "",
      priority: "medium",
      description: "",
      goal_type: "household",
      image_url: "",
    });
    setEditingGoal(null);
    setIsAddDialogOpen(false);
  };

  const openEditDialog = (goal: SavingsGoal) => {
    setEditingGoal(goal);
    setFormData({
      name: goal.name,
      target_amount: goal.target_amount.toString(),
      current_amount: goal.current_amount.toString(),
      monthly_contribution: goal.monthly_contribution?.toString() || "",
      priority: goal.priority,
      description: goal.description || "",
      goal_type: goal.goal_type,
      image_url: goal.image_url || "",
    });
    setIsAddDialogOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const priorityColors = {
    high: "text-destructive",
    medium: "text-warning",
    low: "text-muted-foreground",
  };

  const priorityLabels = {
    high: "High Priority",
    medium: "Medium Priority",
    low: "Low Priority",
  };

  // Calculator functions
  const calculateFutureValue = () => {
    const monthly = parseFloat(calcMonthly);
    const months = parseInt(calcMonths);
    if (isNaN(monthly) || isNaN(months)) return 0;
    return monthly * months;
  };

  const calculateMonthlyNeeded = () => {
    const target = parseFloat(calcTarget);
    const months = parseInt(calcMonths);
    if (isNaN(target) || isNaN(months) || months === 0) return 0;
    return target / months;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Savings Goals</h1>
          <p className="text-muted-foreground mt-1">Track and achieve your household savings goals</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsAddDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Goal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingGoal ? "Edit Goal" : "Create New Goal"}</DialogTitle>
              <DialogDescription>
                {editingGoal ? "Update your savings goal details" : "Set up a new savings goal for your household"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Goal Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Emergency Fund, Vacation"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="target">Target Amount</Label>
                  <Input
                    id="target"
                    type="number"
                    value={formData.target_amount}
                    onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                    placeholder="50000"
                  />
                </div>
                <div>
                  <Label htmlFor="current">Current Amount</Label>
                  <Input
                    id="current"
                    type="number"
                    value={formData.current_amount}
                    onChange={(e) => setFormData({ ...formData, current_amount: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={formData.priority} onValueChange={(value: any) => setFormData({ ...formData, priority: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select value={formData.goal_type} onValueChange={(value: any) => setFormData({ ...formData, goal_type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="household">Household</SelectItem>
                      <SelectItem value="personal">Personal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="monthly_contribution">Monthly Contribution ({currency})</Label>
                <Input
                  id="monthly_contribution"
                  type="number"
                  value={formData.monthly_contribution}
                  onChange={(e) => setFormData({ ...formData, monthly_contribution: e.target.value })}
                  placeholder="1000"
                />
                {formData.monthly_contribution && formData.target_amount && formData.current_amount && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Estimated completion: {Math.ceil((parseFloat(formData.target_amount) - parseFloat(formData.current_amount)) / (parseFloat(formData.monthly_contribution) * 2))} months
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="image">Goal Image (Optional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="cursor-pointer"
                  />
                  {uploadingImage && <span className="text-sm text-muted-foreground">Uploading...</span>}
                </div>
                {formData.image_url && (
                  <img src={formData.image_url} alt="Goal preview" className="mt-2 h-20 w-20 object-cover rounded" />
                )}
              </div>
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Add notes about this goal..."
                  rows={3}
                />
              </div>
              <Button onClick={handleSaveGoal} className="w-full">
                {editingGoal ? "Update Goal" : "Create Goal"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="goals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="goals">
            <Target className="h-4 w-4 mr-2" />
            My Goals
          </TabsTrigger>
          <TabsTrigger value="calculator">
            <Calculator className="h-4 w-4 mr-2" />
            Calculator
          </TabsTrigger>
        </TabsList>

        <TabsContent value="goals" className="space-y-4">
          {goals.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Target className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No savings goals yet. Create your first goal to start tracking progress!
                </p>
              </CardContent>
            </Card>
          ) : (
            goals.map((goal) => {
              const progress = (goal.current_amount / goal.target_amount) * 100;
              const remaining = goal.target_amount - goal.current_amount;
              
              return (
                <Card key={goal.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        {goal.image_url && (
                          <img src={goal.image_url} alt={goal.name} className="h-16 w-16 object-cover rounded" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle>{goal.name}</CardTitle>
                            <span className={`text-xs font-medium uppercase ${priorityColors[goal.priority]}`}>
                              {goal.priority}
                            </span>
                            {goal.goal_type === "personal" && (
                              <span className="text-xs bg-muted px-2 py-1 rounded">Personal</span>
                            )}
                          </div>
                          {goal.description && (
                            <CardDescription className="mt-1">{goal.description}</CardDescription>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(goal)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteGoal(goal.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{progress.toFixed(1)}%</span>
                      </div>
                      <Progress value={progress} className="h-3" />
                      <div className="flex items-center justify-between text-sm">
                        <span>{formatCurrency(goal.current_amount)}</span>
                        <span className="text-muted-foreground">of {formatCurrency(goal.target_amount)}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                      <div>
                        <p className="text-sm text-muted-foreground">Remaining</p>
                        <p className="text-lg font-semibold">{formatCurrency(remaining)}</p>
                      </div>
                      {goal.monthly_contribution > 0 && (
                        <div>
                          <p className="text-sm text-muted-foreground">Est. Completion</p>
                          <p className="text-lg font-semibold">
                            {Math.ceil(remaining / (goal.monthly_contribution * 2))} months
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="calculator" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Future Value Calculator
                </CardTitle>
                <CardDescription>
                  See how much you'll save if you set aside a fixed amount each month
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="calc-monthly">Monthly Savings ({currency})</Label>
                  <Input
                    id="calc-monthly"
                    type="number"
                    value={calcMonthly}
                    onChange={(e) => setCalcMonthly(e.target.value)}
                    placeholder="5000"
                  />
                </div>
                <div>
                  <Label htmlFor="calc-months-1">Time Period</Label>
                  <Select value={calcMonths} onValueChange={setCalcMonths}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">6 months</SelectItem>
                      <SelectItem value="12">12 months</SelectItem>
                      <SelectItem value="24">24 months</SelectItem>
                      <SelectItem value="36">36 months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">You will have saved:</p>
                  <p className="text-3xl font-bold text-primary">{formatCurrency(calculateFutureValue())}</p>
                  <p className="text-xs text-muted-foreground mt-1">in {calcMonths} months</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  Target Calculator
                </CardTitle>
                <CardDescription>
                  Calculate how much to save monthly to reach your target
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="calc-target">Target Amount ({currency})</Label>
                  <Input
                    id="calc-target"
                    type="number"
                    value={calcTarget}
                    onChange={(e) => setCalcTarget(e.target.value)}
                    placeholder="50000"
                  />
                </div>
                <div>
                  <Label htmlFor="calc-months-2">Time Period</Label>
                  <Select value={calcMonths} onValueChange={setCalcMonths}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">6 months</SelectItem>
                      <SelectItem value="12">12 months</SelectItem>
                      <SelectItem value="24">24 months</SelectItem>
                      <SelectItem value="36">36 months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">Save per month:</p>
                  <p className="text-3xl font-bold text-primary">{formatCurrency(calculateMonthlyNeeded())}</p>
                  <p className="text-xs text-muted-foreground mt-1">for {calcMonths} months</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Savings;
