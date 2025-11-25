import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

const History = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">History & Analytics</h1>
        <p className="text-muted-foreground mt-1">View your financial trends and patterns</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Financial Analytics
          </CardTitle>
          <CardDescription>
            Charts and insights from your income and expense history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            Analytics and history coming soon...
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default History;