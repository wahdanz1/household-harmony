import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target } from "lucide-react";

interface SavingsGoal {
  id: string;
  name: string;
  target: number;
  current: number;
  priority: "high" | "medium" | "low";
}

interface SavingsGoalsPreviewProps {
  goals: SavingsGoal[];
  currency: string;
}

const SavingsGoalsPreview = ({ goals, currency }: SavingsGoalsPreviewProps) => {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Savings Goals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {goals.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No savings goals yet. Create your first goal!
          </p>
        ) : (
          goals.map((goal) => {
            const progress = (goal.current / goal.target) * 100;
            return (
              <div key={goal.id} className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{goal.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(goal.current)} of {formatCurrency(goal.target)}
                    </p>
                  </div>
                  <span className={`text-xs font-medium ${priorityColors[goal.priority]} uppercase`}>
                    {goal.priority}
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default SavingsGoalsPreview;