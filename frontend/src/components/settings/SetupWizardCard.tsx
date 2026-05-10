import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export const SetupWizardCard = () => {
    const navigate = useNavigate();
    return (
        <Card>
            <CardHeader>
                <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1.5">
                        <CardTitle>Setup wizard</CardTitle>
                        <CardDescription>
                            Walk through adding incomes, fixed expenses, subscriptions and insurances.
                            Re-run any time you want to add several items in one flow.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Button variant="outline" onClick={() => navigate("/?setup=1")}>
                    Open setup wizard
                </Button>
            </CardContent>
        </Card>
    );
};
