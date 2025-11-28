import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Check, AlertCircle, Plus, X, Edit, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth } from "date-fns";

const Income = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [household, setHousehold] = useState<any>(null);
  const [incomeSources, setIncomeSources] = useState<any[]>([]);
  const [monthlyIncomes, setMonthlyIncomes] = useState<any[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [oneTimeIncomes, setOneTimeIncomes] = useState<any[]>([]);
  const [oneTimeDialogOpen, setOneTimeDialogOpen] = useState(false);
  const [oneTimeName, setOneTimeName] = useState("");
  const [oneTimeAmount, setOneTimeAmount] = useState("");
  const [oneTimeNotes, setOneTimeNotes] = useState("");
  const [oneTimeIsShared, setOneTimeIsShared] = useState(false);
  const [oneTimeCoParentId, setOneTimeCoParentId] = useState("");
  const [oneTimeSharePercentage, setOneTimeSharePercentage] = useState("50");
  const [coParents, setCoParents] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);

  // Income source management states
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [sourceFormData, setSourceFormData] = useState<{
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
    owner_id: "",
  });

  const currentMonth = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const fetchData = async () => {
    if (!user) return;

    const { data: householdData } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .single();

    if (!householdData) return;

    const [
      { data: householdInfo },
      { data: sourcesData },
      { data: monthlyData },
      { data: coParentsData },
      { data: membersData },
    ] = await Promise.all([
      supabase.from("households").select("*").eq("id", householdData.household_id).single(),
      supabase.from("income_sources").select("*, profiles(full_name, avatar_url)").eq("household_id", householdData.household_id).eq("is_active", true),
      supabase.from("monthly_incomes").select("*").eq("household_id", householdData.household_id).eq("month", currentMonth),
      supabase.from("co_parents").select("*").eq("household_id", householdData.household_id),
      supabase.from("household_members").select("*, profiles(full_name, email)").eq("household_id", householdData.household_id),
    ]);

    setHousehold(householdInfo);
    setIncomeSources(sourcesData || []);
    setCoParents(coParentsData || []);
    setMembers(membersData || []);

    // Separate regular incomes and one-time incomes
    const regularIncomes = (monthlyData || []).filter((m: any) => m.income_source_id !== null);
    const oneTimeIncomesData = (monthlyData || []).filter((m: any) => m.income_source_id === null);

    setMonthlyIncomes(regularIncomes);
    setOneTimeIncomes(oneTimeIncomesData);

    const initialAmounts: Record<string, string> = {};
    (sourcesData || []).forEach((source: any) => {
      const existing = (monthlyData || []).find((m: any) => m.income_source_id === source.id);
      initialAmounts[source.id] = existing ? existing.amount.toString() : source.default_amount.toString();
    });
    setAmounts(initialAmounts);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleSave = async () => {
    if (!household || !user) return;
    setSaving(true);

    const entries = incomeSources.map((source) => ({
      income_source_id: source.id,
      household_id: household.id,
      month: currentMonth,
      amount: parseFloat(amounts[source.id] || "0"),
      created_by: user.id,
    }));

    const { error } = await supabase
      .from("monthly_incomes")
      .upsert(entries, { onConflict: "income_source_id,month" });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save income data",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Monthly income saved",
      });
      fetchData();
    }
    setSaving(false);
  };

  const handleAddOneTime = async () => {
    if (!household || !user || !oneTimeName || !oneTimeAmount) {
      toast({
        title: "Error",
        description: "Name and amount are required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("monthly_incomes")
      .insert({
        household_id: household.id,
        month: currentMonth,
        amount: parseFloat(oneTimeAmount),
        one_time_name: oneTimeName,
        notes: oneTimeNotes || null,
        is_shared: oneTimeIsShared,
        co_parent_id: oneTimeIsShared ? oneTimeCoParentId : null,
        share_percentage: oneTimeIsShared ? parseFloat(oneTimeSharePercentage) : 50,
        created_by: user.id,
        income_source_id: null,
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add one-time income",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "One-time income added",
      });
      setOneTimeDialogOpen(false);
      setOneTimeName("");
      setOneTimeAmount("");
      setOneTimeNotes("");
      setOneTimeIsShared(false);
      setOneTimeCoParentId("");
      setOneTimeSharePercentage("50");
      fetchData();
    }
    setSaving(false);
  };

  const handleDeleteOneTime = async (id: string) => {
    const { error } = await supabase
      .from("monthly_incomes")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete one-time income",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "One-time income deleted",
      });
      fetchData();
    }
  };

  // Income source management functions
  const resetSourceForm = () => {
    setSourceFormData({
      category: "salary",
      name: "",
      type: "static",
      default_amount: "0",
      owner_id: members[0]?.user_id || "",
    });
    setEditingSourceId(null);
  };

  const handleSaveSource = async () => {
    if (!household || !user) return;

    const data = {
      household_id: household.id,
      category: sourceFormData.category,
      name: sourceFormData.name,
      type: sourceFormData.type,
      default_amount: parseFloat(sourceFormData.default_amount),
      owner_id: sourceFormData.owner_id,
    };

    let error;
    if (editingSourceId) {
      ({ error } = await supabase
        .from("income_sources")
        .update(data)
        .eq("id", editingSourceId));
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
        description: editingSourceId ? "Income source updated" : "Income source added",
      });
      setSourceDialogOpen(false);
      resetSourceForm();
      fetchData();
    }
  };

  const handleEditSource = (source: any) => {
    setSourceFormData({
      category: source.category,
      name: source.name,
      type: source.type,
      default_amount: source.default_amount.toString(),
      owner_id: source.owner_id,
    });
    setEditingSourceId(source.id);
    setSourceDialogOpen(true);
  };

  const handleDeleteSource = async (id: string) => {
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
      fetchData();
    }
  };

  const formatCategory = (category: string) => {
    return category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const totalIncome = Object.values(amounts).reduce((sum, val) => sum + parseFloat(val || "0"), 0) +
    oneTimeIncomes.reduce((sum, income) => {
      const amount = parseFloat(income.amount || "0");
      // If shared, only count your portion
      if (income.is_shared && income.share_percentage) {
        return sum + (amount * (parseFloat(income.share_percentage.toString()) / 100));
      }
      return sum + amount;
    }, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Income Management</h1>
          <p className="text-muted-foreground mt-2">
            {format(new Date(currentMonth), "MMMM yyyy")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total Income</p>
          <p className="text-2xl sm:text-3xl font-bold text-success">
            {totalIncome.toFixed(0)} {household?.currency || "SEK"}
          </p>
        </div>
      </div>

      {/* Unified Income Management */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-success" />
                Monthly Income
              </CardTitle>
              <CardDescription>
                Add your income sources with a default amount, and adjust the actual monthly income if needed. When you're done, click "Save Monthly Income"!
              </CardDescription>
            </div>
            <Dialog open={sourceDialogOpen} onOpenChange={(open) => {
              setSourceDialogOpen(open);
              if (!open) resetSourceForm();
            }}>
              <DialogTrigger asChild>
                <Button size="sm" className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Source
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingSourceId ? "Edit" : "Add"} Income Source</DialogTitle>
                  <DialogDescription>
                    Configure a recurring income source for your household
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={sourceFormData.category} onValueChange={(v) => setSourceFormData({ ...sourceFormData, category: v as typeof sourceFormData.category })}>
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
                      value={sourceFormData.name}
                      onChange={(e) => setSourceFormData({ ...sourceFormData, name: e.target.value })}
                      placeholder="e.g., Dad's Salary"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Owner</Label>
                    <Select value={sourceFormData.owner_id} onValueChange={(v) => setSourceFormData({ ...sourceFormData, owner_id: v })}>
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
                    <Select value={sourceFormData.type} onValueChange={(v) => setSourceFormData({ ...sourceFormData, type: v as typeof sourceFormData.type })}>
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
                      value={sourceFormData.default_amount}
                      onChange={(e) => setSourceFormData({ ...sourceFormData, default_amount: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleSaveSource}>
                    {editingSourceId ? "Update" : "Add"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {incomeSources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
              <p>No income sources configured</p>
              <p className="text-sm">Add income sources above to get started</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {incomeSources.map((source) => {
                  const hasEntry = monthlyIncomes.some((m) => m.income_source_id === source.id);
                  const isDifferent = amounts[source.id] !== source.default_amount.toString();
                  const isSkipped = amounts[source.id] === "0";

                  return (
                    <div
                      key={source.id}
                      className="p-3 sm:p-4 rounded-lg border border-border bg-background/40"
                    >
                      {/* Mobile: Compact layout */}
                      <div className="sm:hidden space-y-3">
                        {/* Top row: Avatar + Title + Toggle */}
                        <div className="flex items-start gap-3">
                          <Avatar className="h-9 w-9 shrink-0 mt-0.5">
                            <AvatarImage src={source.profiles.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {source.profiles.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium ${isSkipped ? "line-through text-muted-foreground" : ""}`}>
                              {source.name}
                            </p>
                            <Badge variant="outline" className="text-xs mt-1">{formatCategory(source.category)}</Badge>
                          </div>
                          <Switch
                            checked={!isSkipped}
                            onCheckedChange={(checked) =>
                              setAmounts({ ...amounts, [source.id]: checked ? source.default_amount.toString() : "0" })
                            }
                            className="scale-90"
                          />
                        </div>

                        {/* Bottom row: Amount input and actions */}
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={amounts[source.id] || ""}
                            onChange={(e) => setAmounts({ ...amounts, [source.id]: e.target.value })}
                            className={`flex-1 text-right text-lg font-semibold bg-transparent border-0 border-b-2 ${isDifferent ? "border-primary" : "border-border"} focus:outline-none focus:border-primary rounded-none px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed`}
                            placeholder="0"
                            disabled={isSkipped}
                          />
                          <span className="text-sm text-muted-foreground whitespace-nowrap">{household?.currency || "SEK"}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => handleEditSource(source)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => handleDeleteSource(source.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Desktop: Single line layout */}
                      <div className="hidden sm:flex items-center gap-4">
                        <Switch
                          checked={!isSkipped}
                          onCheckedChange={(checked) =>
                            setAmounts({ ...amounts, [source.id]: checked ? source.default_amount.toString() : "0" })
                          }
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className={`font-medium ${isSkipped ? "line-through text-muted-foreground" : ""}`}>
                              {source.name}
                            </p>
                            <Badge variant="outline" className="shrink-0 text-xs">{formatCategory(source.category)}</Badge>
                            {hasEntry && <Check className="h-4 w-4 text-success shrink-0" />}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {source.profiles.full_name}
                          </p>
                        </div>
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={source.profiles.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {source.profiles.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={amounts[source.id] || ""}
                            onChange={(e) => setAmounts({ ...amounts, [source.id]: e.target.value })}
                            className={`w-32 text-right text-xl font-semibold bg-transparent border-0 border-b-2 ${isDifferent ? "border-primary" : "border-border"} focus:outline-none focus:border-primary rounded-none px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed`}
                            placeholder="0"
                            disabled={isSkipped}
                          />
                          <span className="text-sm text-muted-foreground whitespace-nowrap">{household?.currency || "SEK"}</span>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditSource(source)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteSource(source.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? "Saving..." : "Save Monthly Income"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-success" />
                One-Time Income
              </CardTitle>
              <CardDescription>
                Gift money, lottery wins, or other temporary income
              </CardDescription>
            </div>
            <Dialog open={oneTimeDialogOpen} onOpenChange={setOneTimeDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Income
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add One-Time Income</DialogTitle>
                  <DialogDescription>
                    Record temporary income like gifts or windfalls
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="one-time-name">Name *</Label>
                    <Input
                      id="one-time-name"
                      placeholder="e.g., Birthday gift, Lottery win"
                      value={oneTimeName}
                      onChange={(e) => setOneTimeName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="one-time-amount">Amount ({household?.currency || "SEK"}) *</Label>
                    <Input
                      id="one-time-amount"
                      type="number"
                      placeholder="0"
                      value={oneTimeAmount}
                      onChange={(e) => setOneTimeAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="one-time-notes">Notes (optional)</Label>
                    <Textarea
                      id="one-time-notes"
                      placeholder="Additional details..."
                      value={oneTimeNotes}
                      onChange={(e) => setOneTimeNotes(e.target.value)}
                    />
                  </div>

                  <div className="space-y-4 border-t border-border pt-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={oneTimeIsShared}
                        onCheckedChange={setOneTimeIsShared}
                      />
                      <Label>Shared income (you keep {oneTimeSharePercentage}%)</Label>
                    </div>

                    {oneTimeIsShared && (
                      <>
                        <div className="space-y-2">
                          <Label>Co-Parent</Label>
                          <Select value={oneTimeCoParentId} onValueChange={setOneTimeCoParentId}>
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
                            value={oneTimeSharePercentage}
                            onChange={(e) => setOneTimeSharePercentage(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            You keep {oneTimeSharePercentage}%, send {100 - parseFloat(oneTimeSharePercentage || "0")}% to co-parent
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOneTimeDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddOneTime} disabled={saving}>
                    {saving ? "Adding..." : "Add Income"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {oneTimeIncomes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <p className="text-sm">No one-time income recorded this month</p>
            </div>
          ) : (
            <div className="space-y-3">
              {oneTimeIncomes.map((income) => (
                <div
                  key={income.id}
                  className="flex items-center gap-4 p-4 rounded-lg border border-border bg-background/40"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{income.one_time_name}</p>
                      {income.is_shared && (
                        <Badge variant="secondary">{income.share_percentage}% yours</Badge>
                      )}
                    </div>
                    {income.notes && (
                      <p className="text-sm text-muted-foreground mt-1">{income.notes}</p>
                    )}
                    <p className="font-semibold text-success mt-1">
                      {income.is_shared
                        ? (parseFloat(income.amount) * parseFloat(income.share_percentage?.toString() || "50") / 100).toFixed(0)
                        : parseFloat(income.amount).toFixed(0)} {household?.currency || "SEK"}
                      {income.is_shared && (
                        <span className="text-muted-foreground text-sm font-normal"> (of {parseFloat(income.amount).toFixed(0)} total)</span>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteOneTime(income.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Income;