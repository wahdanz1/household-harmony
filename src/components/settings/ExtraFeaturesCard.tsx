import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CreditCard, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ExtraFeaturesCardProps {
    householdId: string;
    enableCreditCards: boolean;
    enableSharedExpenses: boolean;
    onUpdate: () => void;
}

export const ExtraFeaturesCard = ({ householdId, enableCreditCards, enableSharedExpenses, onUpdate }: ExtraFeaturesCardProps) => {
    const { toast } = useToast();

    const handleToggleCreditCards = async (enabled: boolean) => {
        const { error } = await supabase
            .from("households")
            .update({ enable_credit_cards: enabled })
            .eq("id", householdId);

        if (error) {
            toast({
                title: "Error",
                description: "Failed to update credit card settings",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Success",
                description: enabled ? "Credit cards enabled" : "Credit cards disabled",
            });
            onUpdate();
        }
    };

    const handleToggleSharedExpenses = async (enabled: boolean) => {
        const { error } = await supabase
            .from("households")
            .update({ enable_shared_expenses: enabled })
            .eq("id", householdId);

        if (error) {
            toast({
                title: "Error",
                description: "Failed to update shared expenses settings",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Success",
                description: enabled ? "Shared expenses enabled" : "Shared expenses disabled",
            });
            onUpdate();
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Extra Features</CardTitle>
                <CardDescription>Enable optional features for your household</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                    {/* Credit Cards Column */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b">
                            <CreditCard className="h-5 w-5" />
                            <h3 className="font-semibold">Credit Cards</h3>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-background/40">
                            <div className="space-y-0.5 flex-1">
                                <Label>Enable Credit Card Tracking</Label>
                                <p className="text-sm text-muted-foreground">
                                    Track credit card expenses with monthly limits
                                </p>
                            </div>
                            <Switch
                                checked={enableCreditCards}
                                onCheckedChange={handleToggleCreditCards}
                            />
                        </div>
                        {enableCreditCards && (
                            <p className="text-sm text-muted-foreground">
                                Manage your credit cards in <strong>Expenses → Credit</strong>
                            </p>
                        )}
                    </div>

                    {/* Shared Expenses / Co-Parents Column */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b">
                            <Users className="h-5 w-5" />
                            <h3 className="font-semibold">Shared Expenses</h3>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-background/40">
                            <div className="space-y-0.5 flex-1">
                                <Label>Enable Shared Expenses</Label>
                                <p className="text-sm text-muted-foreground">
                                    Track expenses shared with co-parents
                                </p>
                            </div>
                            <Switch
                                checked={enableSharedExpenses}
                                onCheckedChange={handleToggleSharedExpenses}
                            />
                        </div>
                        {enableSharedExpenses && (
                            <p className="text-sm text-muted-foreground">
                                Manage co-parents in <strong>Expenses → Shared</strong>
                            </p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
