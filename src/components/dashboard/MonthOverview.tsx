import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";

interface MonthOverviewProps {
  income: number;
  expenses: number;
  currency: string;
}

const MonthOverview = ({ income, expenses, currency }: MonthOverviewProps) => {
  const netResult = income - expenses;
  const isPositive = netResult >= 0;

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

      <Card className={`border-${isPositive ? 'primary' : 'warning'}/20 bg-${isPositive ? 'primary' : 'warning'}/5`}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Available to Save</CardTitle>
          <Wallet className={`h-4 w-4 text-${isPositive ? 'primary' : 'warning'}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold number-display text-${isPositive ? 'primary' : 'warning'}`}>
            {formatCurrency(netResult)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isPositive ? 'Surplus' : 'Deficit'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default MonthOverview;