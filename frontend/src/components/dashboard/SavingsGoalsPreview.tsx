import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getActiveHousehold } from "@/utils/householdHelpers";

interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  priority: "high" | "medium" | "low";
}

interface SavingsGoalsPreviewProps {
  currency: string;
}

const SavingsGoalsPreview = ({ currency }: SavingsGoalsPreviewProps) => {
  const { user } = useAuth();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGoals();
  }, [user]);

  const fetchGoals = async () => {
    if (!user) return;

    const { membership } = await getActiveHousehold(user.id);

    if (!membership) return;

    const { data } = await supabase
      .from("savings_goals")
      .select("id, name, target_amount, current_amount, priority")
      .eq("household_id", membership.household_id)
      .eq("is_active", true)
      .order("priority", { ascending: true })
      .limit(3);

    if (data) {
      setGoals(data as SavingsGoal[]);
    }
    setLoading(false);
  };

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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Savings Goals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
        </CardContent>
      </Card>
    );
  }

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
            const progress = (goal.current_amount / goal.target_amount) * 100;
            return (
              <div key={goal.id} className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{goal.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(goal.current_amount)} of {formatCurrency(goal.target_amount)}
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