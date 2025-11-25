import { useState } from "react";
import MonthOverview from "@/components/dashboard/MonthOverview";
import QuickActions from "@/components/dashboard/QuickActions";
import SavingsGoalsPreview from "@/components/dashboard/SavingsGoalsPreview";

const Dashboard = () => {
  // Mock data - will be replaced with real data from Supabase
  const [monthData] = useState({
    income: 45000,
    expenses: 38500,
    currency: "SEK",
  });

  const [savingsGoals] = useState([
    {
      id: "1",
      name: "Summer Vacation 2025",
      target: 50000,
      current: 15000,
      priority: "high" as const,
    },
    {
      id: "2",
      name: "Emergency Fund",
      target: 100000,
      current: 42000,
      priority: "high" as const,
    },
    {
      id: "3",
      name: "New Car",
      target: 200000,
      current: 8000,
      priority: "medium" as const,
    },
  ]);

  const currentMonth = new Date().toLocaleDateString('sv-SE', { 
    year: 'numeric', 
    month: 'long' 
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 capitalize">{currentMonth}</p>
      </div>

      <MonthOverview 
        income={monthData.income}
        expenses={monthData.expenses}
        currency={monthData.currency}
      />

      <QuickActions />

      <SavingsGoalsPreview goals={savingsGoals} currency={monthData.currency} />
    </div>
  );
};

export default Dashboard;