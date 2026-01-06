import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { History as HistoryIcon, TrendingUp, TrendingDown, Target, CreditCard, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getActiveHousehold } from "@/utils/householdHelpers";
import { format, startOfMonth, subMonths } from "date-fns";

interface Transaction {
  id: string;
  type: "income" | "expense" | "savings" | "subscription" | "insurance";
  date: string;
  category: string;
  amount: number;
  member: {
    name: string;
    avatar_url: string | null;
  };
  notes?: string;
}

const History = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState("SEK");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedMember, setSelectedMember] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);

  const monthOptions = [
    { value: "all", label: "All Time" },
    { value: format(new Date(), "yyyy-MM"), label: format(new Date(), "MMMM yyyy") },
    { value: format(subMonths(new Date(), 1), "yyyy-MM"), label: format(subMonths(new Date(), 1), "MMMM yyyy") },
    { value: format(subMonths(new Date(), 2), "yyyy-MM"), label: format(subMonths(new Date(), 2), "MMMM yyyy") },
    { value: format(subMonths(new Date(), 3), "yyyy-MM"), label: format(subMonths(new Date(), 3), "MMMM yyyy") },
    { value: format(subMonths(new Date(), 4), "yyyy-MM"), label: format(subMonths(new Date(), 4), "MMMM yyyy") },
    { value: format(subMonths(new Date(), 5), "yyyy-MM"), label: format(subMonths(new Date(), 5), "MMMM yyyy") },
  ];

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    const { membership } = await getActiveHousehold(user.id);

    if (!membership) return;

    const [
      { data: householdInfo },
      { data: incomeData },
      { data: expenseData },
      { data: savingsData },
      { data: subscriptionsData },
      { data: insurancesData },
      { data: incomeSources },
      { data: expenseCategories },
      { data: savingsGoals },
      { data: householdMembers },
    ] = await Promise.all([
      supabase.from("households").select("currency").eq("id", membership.household_id).single(),
      supabase
        .from("monthly_incomes")
        .select("*, income_sources(name), profiles(full_name, avatar_url)")
        .eq("household_id", membership.household_id)
        .order("month", { ascending: false }),
      supabase
        .from("monthly_expenses")
        .select("*, expenses(name), profiles(full_name, avatar_url)")
        .eq("household_id", membership.household_id)
        .order("month", { ascending: false }),
      supabase
        .from("savings_allocations")
        .select("*, savings_goals(name), profiles(full_name, avatar_url)")
        .eq("household_id", membership.household_id)
        .order("month", { ascending: false }),
      supabase
        .from("subscriptions")
        .select("*")
        .eq("household_id", membership.household_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("insurances")
        .select("*")
        .eq("household_id", membership.household_id)
        .order("created_at", { ascending: false }),
      supabase.from("income_sources").select("name").eq("household_id", membership.household_id).eq("is_active", true),
      supabase.from("expenses").select("name").eq("household_id", membership.household_id).eq("is_active", true),
      supabase.from("savings_goals").select("name").eq("household_id", membership.household_id).eq("is_active", true),
      supabase
        .from("household_members")
        .select("user_id, profiles(full_name, avatar_url)")
        .eq("household_id", membership.household_id),
    ]);

    setCurrency(householdInfo?.currency || "SEK");

    // Build transactions list
    const allTransactions: Transaction[] = [];

    // Income transactions
    (incomeData || []).forEach((item: any) => {
      allTransactions.push({
        id: item.id,
        type: "income",
        date: item.month,
        category: item.income_sources?.name || "Unknown",
        amount: parseFloat(item.amount),
        member: {
          name: item.profiles?.full_name || "Unknown",
          avatar_url: item.profiles?.avatar_url || null,
        },
        notes: item.notes,
      });
    });

    // Expense transactions
    (expenseData || []).forEach((item: any) => {
      allTransactions.push({
        id: item.id,
        type: "expense",
        date: item.month,
        category: item.expenses?.name || "Unknown",
        amount: parseFloat(item.amount),
        member: {
          name: item.profiles?.full_name || "Unknown",
          avatar_url: item.profiles?.avatar_url || null,
        },
        notes: item.notes,
      });
    });

    // Savings allocations
    (savingsData || []).forEach((item: any) => {
      allTransactions.push({
        id: item.id,
        type: "savings",
        date: item.month,
        category: item.savings_goals?.name || "Unknown",
        amount: parseFloat(item.amount),
        member: {
          name: item.profiles?.full_name || "Unknown",
          avatar_url: item.profiles?.avatar_url || null,
        },
        notes: item.notes,
      });
    });

    // Subscriptions (created dates)
    (subscriptionsData || []).forEach((item: any) => {
      allTransactions.push({
        id: item.id,
        type: "subscription",
        date: item.created_at.split("T")[0],
        category: item.name,
        amount: parseFloat(item.amount),
        member: {
          name: "System",
          avatar_url: null,
        },
        notes: `${item.billing_cycle} subscription`,
      });
    });

    // Insurances (created dates)
    (insurancesData || []).forEach((item: any) => {
      const frequency = item.payment_frequency === "yearly" ? 12 : item.payment_frequency === "semi-annual" ? 6 : 3;
      const monthlyAmount = parseFloat(item.total_amount) / frequency;
      allTransactions.push({
        id: item.id,
        type: "insurance",
        date: item.created_at.split("T")[0],
        category: item.name,
        amount: monthlyAmount,
        member: {
          name: "System",
          avatar_url: null,
        },
        notes: `${item.payment_frequency} payment`,
      });
    });

    // Sort by date descending
    allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setTransactions(allTransactions);

    // Extract unique categories and members
    const uniqueCategories = Array.from(new Set(allTransactions.map((t) => t.category)));
    const uniqueMembers = Array.from(
      new Map(householdMembers?.map((m: any) => [m.user_id, { id: m.user_id, name: m.profiles.full_name }]) || []).values()
    );

    setCategories(uniqueCategories);
    setMembers(uniqueMembers);
    setLoading(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("sv-SE", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const typeIcons = {
    income: <TrendingUp className="h-4 w-4 text-success" />,
    expense: <TrendingDown className="h-4 w-4 text-destructive" />,
    savings: <Target className="h-4 w-4 text-primary" />,
    subscription: <CreditCard className="h-4 w-4 text-warning" />,
    insurance: <Shield className="h-4 w-4 text-muted-foreground" />,
  };

  const typeColors = {
    income: "bg-success/10 text-success border-success/20",
    expense: "bg-destructive/10 text-destructive border-destructive/20",
    savings: "bg-primary/10 text-primary border-primary/20",
    subscription: "bg-warning/10 text-warning border-warning/20",
    insurance: "bg-muted text-muted-foreground border-border",
  };

  // Filter transactions
  const filteredTransactions = transactions.filter((t) => {
    if (selectedMonth !== "all") {
      const transactionMonth = format(new Date(t.date), "yyyy-MM");
      if (transactionMonth !== selectedMonth) return false;
    }
    if (selectedCategory !== "all" && t.category !== selectedCategory) return false;
    if (selectedMember !== "all" && t.member.name !== selectedMember) return false;
    if (selectedType !== "all" && t.type !== selectedType) return false;
    return true;
  });

  // Calculate totals
  const totals = {
    income: filteredTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0),
    expense: filteredTransactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0),
    savings: filteredTransactions.filter((t) => t.type === "savings").reduce((sum, t) => sum + t.amount, 0),
    subscription: filteredTransactions.filter((t) => t.type === "subscription").reduce((sum, t) => sum + t.amount, 0),
    insurance: filteredTransactions.filter((t) => t.type === "insurance").reduce((sum, t) => sum + t.amount, 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading history...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transaction History</h1>
        <p className="text-muted-foreground mt-1">View and analyze all your financial transactions</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Income</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">{formatCurrency(totals.income)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">
              {formatCurrency(totals.expense + totals.subscription + totals.insurance)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net Savings</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(totals.income - totals.expense - totals.subscription - totals.insurance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HistoryIcon className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>Filter transactions by period, type, category, or member</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Period</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Type</label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="subscription">Subscription</SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Member</label>
              <Select value={selectedMember} onValueChange={setSelectedMember}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.name}>
                      {member.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="System">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transactions ({filteredTransactions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <HistoryIcon className="h-12 w-12 mb-4 opacity-50" />
              <p>No transactions found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium">
                        {format(new Date(transaction.date), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={typeColors[transaction.type]}>
                          <span className="mr-1">{typeIcons[transaction.type]}</span>
                          {transaction.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{transaction.category}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={transaction.member.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {transaction.member.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{transaction.member.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <span
                          className={
                            transaction.type === "income"
                              ? "text-success"
                              : transaction.type === "savings"
                                ? "text-primary"
                                : "text-destructive"
                          }
                        >
                          {transaction.type === "income" ? "+" : "-"}
                          {formatCurrency(transaction.amount)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {transaction.notes || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default History;
