import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, Check, AlertCircle } from "lucide-react";

interface MonthlyExpensesProps {
  expenseCategories: any[];
  monthlyExpenses: any[];
  amounts: Record<string, string>;
  currency: string;
  saving: boolean;
  subscriptionsTotal: number;
  insuranceTotal: number;
  onAmountsChange: (amounts: Record<string, string>) => void;
  onSave: () => void;
}

export const MonthlyExpenses = ({
  expenseCategories,
  monthlyExpenses,
  amounts,
  currency,
  saving,
  subscriptionsTotal,
  insuranceTotal,
  onAmountsChange,
  onSave,
}: MonthlyExpensesProps) => {
  const staticCategories = expenseCategories.filter((c) => c.type === "static");
  const dynamicCategories = expenseCategories.filter((c) => c.type === "dynamic");

  return (
    <div className="space-y-4">
      {expenseCategories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
            <p>No expense categories configured</p>
            <p className="text-sm">Go to Settings to add expense categories</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {staticCategories.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                  Static Expenses
                </CardTitle>
                <CardDescription>Fixed monthly costs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {staticCategories.map((category) => {
                  const hasEntry = monthlyExpenses.some((m) => m.expense_category_id === category.id);
                  const isDifferent = amounts[category.id] !== category.default_amount.toString();

                  return (
                    <div
                      key={category.id}
                      className="flex items-center gap-4 p-4 rounded-lg border border-border bg-background/40"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">{category.name}</p>
                          <Badge variant="secondary">static</Badge>
                          {hasEntry && <Check className="h-4 w-4 text-success" />}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Default: {category.default_amount} {currency}
                        </p>
                      </div>
                      <Input
                        type="number"
                        value={amounts[category.id] || ""}
                        onChange={(e) =>
                          onAmountsChange({ ...amounts, [category.id]: e.target.value })
                        }
                        className={`w-32 ${isDifferent ? "border-primary" : ""}`}
                        placeholder="0"
                      />
                    </div>
                  );
                })}
                
                {subscriptionsTotal > 0 && (
                  <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-muted/40">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-muted-foreground">Subscriptions</p>
                        <Badge variant="secondary">auto</Badge>
                      </div>
                    </div>
                    <Input
                      type="number"
                      value={subscriptionsTotal.toFixed(0)}
                      disabled
                      className="w-32 bg-muted/20"
                    />
                  </div>
                )}

                {insuranceTotal > 0 && (
                  <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-muted/40">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-muted-foreground">Insurance Savings</p>
                        <Badge variant="secondary">auto</Badge>
                      </div>
                    </div>
                    <Input
                      type="number"
                      value={insuranceTotal.toFixed(0)}
                      disabled
                      className="w-32 bg-muted/20"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {dynamicCategories.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                  Dynamic Expenses
                </CardTitle>
                <CardDescription>Variable costs with rolling average</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dynamicCategories.map((category) => {
                  const hasEntry = monthlyExpenses.some((m) => m.expense_category_id === category.id);
                  const isDifferent = amounts[category.id] !== category.default_amount.toString();

                  return (
                    <div
                      key={category.id}
                      className="flex items-center gap-4 p-4 rounded-lg border border-border bg-background/40"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">{category.name}</p>
                          <Badge variant="outline">dynamic</Badge>
                          {hasEntry && <Check className="h-4 w-4 text-success" />}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Suggested: {category.default_amount} {currency} • Rolling average
                        </p>
                      </div>
                      <Input
                        type="number"
                        value={amounts[category.id] || ""}
                        onChange={(e) =>
                          onAmountsChange({ ...amounts, [category.id]: e.target.value })
                        }
                        className={`w-32 ${isDifferent ? "border-primary" : ""}`}
                        placeholder="0"
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <Button onClick={onSave} disabled={saving} className="w-full">
            {saving ? "Saving..." : "Save Monthly Expenses"}
          </Button>
        </>
      )}
    </div>
  );
};
