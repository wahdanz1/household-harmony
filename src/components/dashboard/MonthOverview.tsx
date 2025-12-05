import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";

interface MonthOverviewProps {
  income: number;
  expenses: number;
  currency: string;
}

const MonthOverview = ({ income, expenses, currency }: MonthOverviewProps) => {
  const netResult = income - expenses;
  const percentageLeft = income > 0 ? (netResult / income) * 100 : 0;

  let statusColor = "success";
  let statusText = "Surplus";

  if (netResult < 0) {
    statusColor = "destructive";
    statusText = "Deficit";
  } else if (percentageLeft < 10) {
    statusColor = "warning";
    statusText = "Low Balance";
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="border-success/20 bg-success/5">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Income</CardTitle>
          <TrendingUp className="h-4 w-4 text-success" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold number-display text-success">
            {formatCurrency(income)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">This month</p>
        </CardContent>
      </Card>

      <Card className="border-destructive/20 bg-destructive/5">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
          <TrendingDown className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold number-display text-destructive">
            {formatCurrency(expenses)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">This month</p>
        </CardContent>
      </Card>

      <Card className={`border-${statusColor}/20 bg-${statusColor}/5`}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Available to Save</CardTitle>
          <Wallet className={`h-4 w-4 text-${statusColor}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold number-display text-${statusColor}`}>
            {formatCurrency(netResult)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {statusText}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default MonthOverview;