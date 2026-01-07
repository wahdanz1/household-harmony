import { TrendingUp, TrendingDown, PiggyBank } from "lucide-react";

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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));
  };

  return (
    <div className="space-y-4">
      {/* Main Balance Card */}
      <div className={`bg-muted/40 rounded-lg p-6 border ${isPositive ? 'border-green-500/30' : 'border-red-500/30'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isPositive ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              <PiggyBank className={`h-6 w-6 ${isPositive ? 'text-green-500' : 'text-red-500'}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Monthly Balance</p>
              <p className={`text-3xl font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {isPositive ? '+' : '-'}{formatCurrency(netResult)} {currency}
              </p>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${isPositive ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
            }`}>
            {isPositive ? 'Surplus' : 'Deficit'}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min((income / (income + expenses)) * 100, 100)}%` }}
          />
          <div
            className="absolute right-0 top-0 h-full bg-red-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min((expenses / (income + expenses)) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Income and Expenses Row */}
      <div className="grid-auto-fill-2">
        {/* Income */}
        <div className="bg-muted/40 rounded-lg p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Income</p>
                <p className="text-xl font-bold text-green-500">{formatCurrency(income)} {currency}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-muted/40 rounded-lg p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingDown className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-xl font-bold text-red-500">{formatCurrency(expenses)} {currency}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthOverview;