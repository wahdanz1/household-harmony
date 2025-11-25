import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";

const Savings = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Savings Goals</h1>
        <p className="text-muted-foreground mt-1">Set and track your household savings goals</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Your Goals
          </CardTitle>
          <CardDescription>
            Create and manage your savings goals with progress tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            Savings goals management coming soon...
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Savings;