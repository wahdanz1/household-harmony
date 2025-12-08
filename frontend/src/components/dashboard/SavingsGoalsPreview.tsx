import { useEffect, useState } from "react";
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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const priorityColors = {
    high: "text-red-500 bg-red-500/20",
    medium: "text-yellow-500 bg-yellow-500/20",
    low: "text-muted-foreground bg-muted",
  };

  if (loading) {
    return (
      <div className="bg-muted/40 rounded-lg p-4 border border-primary/20">
        <div className="flex items-center gap-3 mb-4">
          <Target className="h-5 w-5 text-blue-500" />
          <h3 className="font-semibold text-foreground">Savings Goals</h3>
        </div>
        <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-muted/40 rounded-lg p-4 border border-primary/20">
      <div className="flex items-center gap-3 mb-4">
        <Target className="h-5 w-5 text-blue-500" />
        <h3 className="font-semibold text-foreground">Savings Goals</h3>
      </div>

      {goals.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No savings goals yet. Create your first goal!
        </p>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => {
            const progress = (goal.current_amount / goal.target_amount) * 100;
            return (
              <div key={goal.id} className="bg-background/40 rounded-lg p-3 border border-border">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{goal.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)} {currency}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityColors[goal.priority]}`}>
                    {goal.priority}
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SavingsGoalsPreview;