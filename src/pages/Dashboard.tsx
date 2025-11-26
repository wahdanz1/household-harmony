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

      <SavingsGoalsPreview currency={monthData.currency} />
    </div>
  );
};

export default Dashboard;