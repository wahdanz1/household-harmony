import { Switch } from "@/components/ui/switch";
import { Pencil, Sparkles } from "lucide-react";
import { getIncomeCategoryById } from "@/constants/incomeCategories";
import { DataListItem } from "@/components/ui/data-list-item";
import { CatIcon } from "@/components/ui/cat-icon";
import { ShowEncryptedDataButton } from "@/components/demo/ShowEncryptedDataButton";

interface IncomeSourceItemProps {
    source: any;
    amount: string;
    currency: string;
    onAmountChange: (sourceId: string, value: string) => void;
    onEdit: (source: any) => void;
    onDelete: (sourceId: string) => void;
    status?: 'saved' | 'modified' | 'none';
    readOnly?: boolean;
}

export const IncomeSourceItem = ({
    source,
    amount,
    currency,
    onAmountChange,
    onEdit,
    status = 'none',
    readOnly = false,
}: IncomeSourceItemProps) => {
    const isSkipped = amount === "0";

    const cat = getIncomeCategoryById(source.category);
    const Icon = cat?.icon || Sparkles;

    // Bottom underline on input: shows save status
    const getInputUnderlineClass = () => {
        if (isSkipped) return 'border-border';
        switch (status) {
            case 'saved':
                return 'border-success';
            case 'modified':
                return 'border-warning';
            default:
                return 'border-border';
        }
    };

    return (
        <DataListItem onClick={() => !readOnly && onEdit(source)} className="group">
            {/* Icon + Name */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <CatIcon icon={Icon} hue={cat?.hue} size={32} />
                <p className={`font-medium text-sm sm:text-base truncate ${isSkipped ? "line-through text-muted-foreground" : ""}`}>
                    {source.name}
                </p>
            </div>

            {/* Input + Currency + Edit (desktop hover) + Toggle */}
            <div className="flex items-center gap-2 shrink-0">
                <input
                    type="number"
                    value={amount || ""}
                    onChange={(e) => onAmountChange(source.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className={`currency-input w-24 sm:w-28 ${getInputUnderlineClass()}`}
                    placeholder="0"
                    disabled={isSkipped || readOnly}
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">{currency}</span>

                {/* Show Encrypted Data button - demo only */}
                <div onClick={(e) => e.stopPropagation()}>
                    <ShowEncryptedDataButton
                        recordId={source.id}
                        tableName="income_sources"
                        fieldName="encrypted_name"
                        displayLabel="Name"
                    />
                </div>

                {/* Edit icon - desktop only, visible on hover */}
                {!readOnly && <Pencil className="h-3.5 w-3.5 text-muted-foreground hidden md:block md:opacity-0 md:group-hover:opacity-100 transition-opacity" />}

                {/* Vertical toggle on desktop, horizontal on mobile */}
                <div
                    className="flex items-center justify-center"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Switch
                        checked={!isSkipped}
                        disabled={readOnly}
                        onCheckedChange={(checked) =>
                            onAmountChange(source.id, checked ? (source.default_amount || 0).toString() : "0")
                        }
                        className="sm:-rotate-90 data-[state=unchecked]:bg-muted"
                    />
                </div>
            </div>
        </DataListItem>
    );
};
