import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getActiveHousehold } from "@/utils/householdHelpers";
import { useEncryptedFields, savingsGoalFields } from "@/hooks/useEncryptedFields";

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
  const { decryptRecords } = useEncryptedFields(savingsGoalFields);

  useEffect(() => {
    fetchGoals();
  }, [user]);

  const fetchGoals = async () => {
    if (!user) return;

    const { membership } = await getActiveHousehold(user.id);

    if (!membership) return;

    const householdId = membership.household_id;

    const { data, error } = await supabase
      .from("savings_goals")
      .select("id, encrypted_name, encrypted_target_amount, encrypted_current_amount, priority, is_encrypted")
      .eq("household_id", householdId)
      .eq("is_active", true)
      .order("priority", { ascending: true })
      .limit(3);

    if (data) {
      const decrypted = await decryptRecords(data);
      setGoals(decrypted as any);
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
      <div className="card-surface">
        <div className="flex items-center gap-3 mb-4">
          <Target className="h-5 w-5 text-blue-500" />
          <h3>Savings Goals</h3>
        </div>
        <p className="card-description text-center py-4">Loading...</p>
      </div>
    );
  }

  return (
    <div className="card-surface">
      <div className="flex items-center gap-3 mb-4">
        <Target className="h-5 w-5 text-blue-500" />
        <h3>Savings Goals</h3>
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