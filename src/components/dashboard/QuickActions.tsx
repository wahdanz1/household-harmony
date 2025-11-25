import { Button } from "@/components/ui/button";
import { Plus, Edit, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";

const QuickActions = () => {
  const navigate = useNavigate();

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Button 
        onClick={() => navigate("/income")}
        variant="outline" 
        className="h-auto py-4 flex-col gap-2 hover:bg-success/10 hover:border-success/30"
      >
        <Plus className="h-5 w-5 text-success" />
        <span className="text-sm font-medium">Add Income</span>
      </Button>

      <Button 
        onClick={() => navigate("/expenses")}
        variant="outline" 
        className="h-auto py-4 flex-col gap-2 hover:bg-primary/10 hover:border-primary/30"
      >
        <Edit className="h-5 w-5 text-primary" />
        <span className="text-sm font-medium">Update Expenses</span>
      </Button>

      <Button 
        onClick={() => navigate("/savings")}
        variant="outline" 
        className="h-auto py-4 flex-col gap-2 hover:bg-accent/30 hover:border-accent"
      >
        <Target className="h-5 w-5 text-accent-foreground" />
        <span className="text-sm font-medium">Manage Savings</span>
      </Button>
    </div>
  );
};

export default QuickActions;