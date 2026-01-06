import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface CreditCardData {
    id: string;
    name: string;
    monthly_limit: number;
}

interface CreditCardSummaryCardsProps {
    creditCards: CreditCardData[];
    calculateCardTotal: (cardId: string) => number;
    currency: string;
}

export const CreditCardSummaryCards = ({ creditCards, calculateCardTotal, currency }: CreditCardSummaryCardsProps) => {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {creditCards.map((card) => {
                const total = calculateCardTotal(card.id);
                const limit = card.monthly_limit || 0;
                const remaining = limit - total;
                const percentage = limit > 0 ? (total / limit) * 100 : 0;

                return (
                    <Card key={card.id}>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <CreditCard className="h-4 w-4" />
                                {card.name}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Spent</span>
                                    <span className="font-medium">{total.toFixed(0)} {currency}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Limit</span>
                                    <span>{limit.toFixed(0)} {currency}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Remaining</span>
                                    <span className={remaining < 0 ? "text-destructive font-medium" : "text-green-600 font-medium"}>
                                        {remaining.toFixed(0)} {currency}
                                    </span>
                                </div>
                                <div className="w-full bg-secondary rounded-full h-2 mt-2">
                                    <div
                                        className={`h-2 rounded-full transition-all ${percentage > 100 ? "bg-destructive" : percentage > 80 ? "bg-orange-500" : "bg-green-600"
                                            }`}
                                        style={{ width: `${Math.min(percentage, 100)}%` }}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
};
