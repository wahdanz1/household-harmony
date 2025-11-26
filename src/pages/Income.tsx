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
import { TrendingUp, Check, AlertCircle, Plus, X } from "lucide-react";
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
    ] = await Promise.all([
      supabase.from("households").select("*").eq("id", householdData.household_id).single(),
      supabase.from("income_sources").select("*, profiles(full_name, avatar_url)").eq("household_id", householdData.household_id).eq("is_active", true),
      supabase.from("monthly_incomes").select("*").eq("household_id", householdData.household_id).eq("month", currentMonth),
      supabase.from("co_parents").select("*").eq("household_id", householdData.household_id),
    ]);

    setHousehold(householdInfo);
    setIncomeSources(sourcesData || []);
    setCoParents(coParentsData || []);
    
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
          <p className="text-muted-foreground mt-1">
            {format(new Date(currentMonth), "MMMM yyyy")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total Income</p>
          <p className="text-3xl font-bold text-success">
            {totalIncome.toFixed(0)} {household?.currency || "SEK"}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-success" />
            Monthly Income Entry
          </CardTitle>
          <CardDescription>
            Update amounts that differ from defaults
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {incomeSources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
              <p>No income sources configured</p>
              <p className="text-sm">Go to Settings to add income sources</p>
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
                      className="flex items-center gap-4 p-4 rounded-lg border border-border bg-background/40"
                    >
                      <Switch
                        checked={!isSkipped}
                        onCheckedChange={(checked) =>
                          setAmounts({ ...amounts, [source.id]: checked ? source.default_amount.toString() : "0" })
                        }
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className={`font-medium ${isSkipped ? "line-through text-muted-foreground" : ""}`}>
                            {source.name}
                          </p>
                          <Badge variant={source.type === "static" ? "secondary" : "outline"}>
                            {source.type}
                          </Badge>
                          {hasEntry && <Check className="h-4 w-4 text-success" />}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {source.profiles.full_name}
                        </p>
                      </div>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={source.profiles.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {source.profiles.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <Input
                        type="number"
                        value={amounts[source.id] || ""}
                        onChange={(e) => setAmounts({ ...amounts, [source.id]: e.target.value })}
                        className={`w-32 ${isDifferent ? "border-primary" : ""}`}
                        placeholder="0"
                        disabled={isSkipped}
                      />
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
          <div className="flex items-center justify-between">
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
                <Button size="sm">
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