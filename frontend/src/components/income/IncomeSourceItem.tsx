import { Pencil, Info, Sparkles } from "lucide-react";
import { getIncomeCategoryById } from "@/constants/incomeCategories";
import { RowItem } from "@/components/ui/row-item";
import { Money } from "@/components/ui/money";
import { CatIcon } from "@/components/ui/cat-icon";
import { ShowEncryptedDataButton } from "@/components/demo/ShowEncryptedDataButton";

interface IncomeSourceItemProps {
    source: any;
    amount: number;
    /** Realised amount confirmed for this month, if known. Drives the variance badge. */
    actualAmount?: number;
    currency: string;
    onEdit: (source: any) => void;
    readOnly?: boolean;
    /** Past-month read-only mode: pencil hover becomes info icon. Click still fires. */
    pastMonth?: boolean;
    /** Set true on the last item of the list to drop the bottom divider. */
    last?: boolean;
}

export const IncomeSourceItem = ({
    source,
    amount,
    actualAmount,
    currency,
    onEdit,
    readOnly = false,
    pastMonth = false,
    last = false,
}: IncomeSourceItemProps) => {
    const isSkipped = amount === 0;

    const cat = getIncomeCategoryById(source.category);
    const Icon = cat?.icon || Sparkles;

    return (
        <RowItem
            onClick={() => !readOnly && onEdit(source)}
            last={last}
            className="group"
        >
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <CatIcon icon={Icon} hue={cat?.hue} size={32} />
                <p className={`font-medium text-sm sm:text-base truncate ${isSkipped ? "line-through text-muted" : ""}`}>
                    {(source.name || source.provider)}
                </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <Money
                    v={amount}
                    currency={currency}
                    className={isSkipped ? "text-muted line-through" : ""}
                />

                {actualAmount !== undefined && Math.round(actualAmount) !== Math.round(amount) && (() => {
                    const variance = actualAmount - amount;
                    const moreReceived = variance > 0;
                    return (
                        <span
                            className={`text-[10px] font-semibold tracking-wide px-1.5 py-0.5 rounded ${moreReceived
                                ? "bg-accent/10 text-accent"
                                : "bg-danger/10 text-danger"
                                }`}
                            title={`Actual: ${Math.round(actualAmount)} ${currency}`}
                        >
                            {moreReceived ? "+" : "−"}{Math.abs(Math.round(variance))} {currency}
                        </span>
                    );
                })()}

                <ShowEncryptedDataButton
                    recordId={source.id}
                    tableName="income_sources"
                    fieldName="encrypted_name"
                    displayLabel="Name"
                />

                {!readOnly && (
                    pastMonth ? (
                        <Info className="h-3.5 w-3.5 text-muted hidden md:block md:opacity-0 md:group-hover:opacity-100 transition-opacity" />
                    ) : (
                        <Pencil className="h-3.5 w-3.5 text-muted hidden md:block md:opacity-0 md:group-hover:opacity-100 transition-opacity" />
                    )
                )}
            </div>
        </RowItem>
    );
};
