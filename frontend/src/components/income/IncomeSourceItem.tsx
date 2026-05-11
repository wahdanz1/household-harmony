import { Pencil, Sparkles } from "lucide-react";
import { getIncomeCategoryById } from "@/constants/incomeCategories";
import { RowItem } from "@/components/ui/row-item";
import { MoneyInput } from "@/components/ui/money-input";
import { CatIcon } from "@/components/ui/cat-icon";
import { ShowEncryptedDataButton } from "@/components/demo/ShowEncryptedDataButton";

interface IncomeSourceItemProps {
    source: any;
    amount: string;
    /** Realised amount confirmed for this month, if known. Drives the variance badge. */
    actualAmount?: number;
    currency: string;
    onAmountChange: (sourceId: string, value: string) => void;
    onEdit: (source: any) => void;
    onDelete: (sourceId: string) => void;
    status?: 'saved' | 'modified' | 'none';
    readOnly?: boolean;
    /** Set true on the last item of the list to drop the bottom divider. */
    last?: boolean;
}

export const IncomeSourceItem = ({
    source,
    amount,
    actualAmount,
    currency,
    onAmountChange,
    onEdit,
    status = 'none',
    readOnly = false,
    last = false,
}: IncomeSourceItemProps) => {
    const isSkipped = amount === "0";

    const cat = getIncomeCategoryById(source.category);
    const Icon = cat?.icon || Sparkles;

    const inputStatus =
        isSkipped ? "default" : status === "saved" ? "saved" : status === "modified" ? "modified" : "default";

    return (
        <RowItem
            onClick={() => !readOnly && onEdit(source)}
            last={last}
            className="group"
        >
            {/* Icon + Name */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <CatIcon icon={Icon} hue={cat?.hue} size={32} />
                <p className={`font-medium text-sm sm:text-base truncate ${isSkipped ? "line-through text-muted-foreground" : ""}`}>
                    {(source.name || source.provider)}
                </p>
            </div>

            {/* Amount input + actions */}
            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                <MoneyInput
                    value={amount || ""}
                    currency={currency}
                    status={inputStatus}
                    disabled={isSkipped || readOnly}
                    onChange={(v) => onAmountChange(source.id, v.toString())}
                    aria-label={`${(source.name || source.provider)} amount`}
                />

                {actualAmount !== undefined && Math.round(actualAmount) !== Math.round(parseFloat(amount || "0")) && (() => {
                    const variance = actualAmount - parseFloat(amount || "0");
                    const moreReceived = variance > 0;
                    return (
                        <span
                            className={`text-[10px] font-semibold tracking-wide px-1.5 py-0.5 rounded ${moreReceived
                                ? "bg-success/10 text-success"
                                : "bg-destructive/10 text-destructive"
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
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground hidden md:block md:opacity-0 md:group-hover:opacity-100 transition-opacity" />
                )}
            </div>
        </RowItem>
    );
};
