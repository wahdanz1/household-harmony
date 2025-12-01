import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { CreditCardManagement } from "./credit/CreditCardManagement";
import { CreditCardSummaryCards } from "./credit/CreditCardSummaryCards";
import { CreditExpensesList } from "./credit/CreditExpensesList";

interface CreditCardExpense {
    id: string;
    credit_card_id: string;
    category: string;
    description: string;
    amount: number;
    notes: string | null;
    credit_cards: {
        name: string;
    };
}

interface CreditCard {
    id: string;
    name: string;
    monthly_limit: number;
}

interface CreditTabProps {
    householdId: string;
    currency: string;
    monthStart: Date;
    monthEnd: Date;
}

export const CreditTab = ({ householdId, currency, monthStart, monthEnd }: CreditTabProps) => {
    const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
    const [expenses, setExpenses] = useState<CreditCardExpense[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [householdId]);

    const fetchData = async () => {
        const [
            { data: cardsData },
            { data: expensesData },
        ] = await Promise.all([
            supabase.from("credit_cards").select("*").eq("household_id", householdId).eq("is_active", true),
            supabase.from("credit_card_expenses").select("*, credit_cards(name)").eq("household_id", householdId).gte("month_end", format(monthStart, "yyyy-MM-dd")).lte("month_start", format(monthEnd, "yyyy-MM-dd")),
        ]);

        setCreditCards(cardsData || []);
        setExpenses(expensesData || []);
        setLoading(false);
    };

    const calculateCardTotal = (cardId: string) => {
        return expenses
            .filter(e => e.credit_card_id === cardId)
            .reduce((sum, e) => sum + e.amount, 0);
    };

    if (loading) {
        return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Credit Card Management */}
            <CreditCardManagement
                householdId={householdId}
                currency={currency}
                creditCards={creditCards}
                onUpdate={fetchData}
            />

            {creditCards.length === 0 ? null : (
                <>
                    {/* Summary Cards */}
                    <CreditCardSummaryCards
                        creditCards={creditCards}
                        calculateCardTotal={calculateCardTotal}
                        currency={currency}
                    />

                    {/* Expenses List */}
                    <CreditExpensesList
                        householdId={householdId}
                        currency={currency}
                        monthStart={monthStart}
                        monthEnd={monthEnd}
                        creditCards={creditCards}
                        expenses={expenses}
                        onUpdate={fetchData}
                    />
                </>
            )}
        </div>
    );
};
