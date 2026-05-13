import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Trash2 } from "lucide-react";

interface FormDialogFooterProps {
    isEdit: boolean;
    saving: boolean;
    canSave: boolean;
    onSave: () => void;
    /** Pass to show the Delete button (left side) in edit mode. */
    onRequestDelete?: () => void;
    deleting?: boolean;
    /** Show the "Create another" checkbox in add mode. */
    showCreateAnother?: boolean;
    createAnother?: boolean;
    onCreateAnotherChange?: (v: boolean) => void;
    saveLabel?: string;
}

export const FormDialogFooter = ({
    isEdit,
    saving,
    canSave,
    onSave,
    onRequestDelete,
    deleting = false,
    showCreateAnother = true,
    createAnother = false,
    onCreateAnotherChange,
    saveLabel,
}: FormDialogFooterProps) => (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <div className="flex items-center gap-3">
            {isEdit && onRequestDelete ? (
                <Button variant="destructive" onClick={onRequestDelete} disabled={saving || deleting} className="w-full sm:w-auto">
                    {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                    Delete
                </Button>
            ) : !isEdit && showCreateAnother && onCreateAnotherChange ? (
                <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
                    <Checkbox
                        checked={createAnother}
                        onCheckedChange={(v) => onCreateAnotherChange(v === true)}
                    />
                    Create another
                </label>
            ) : null}
        </div>
        <Button onClick={onSave} disabled={!canSave || saving} className="w-full sm:w-auto">
            {saving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
            ) : (
                saveLabel ?? (isEdit ? "Save" : "Add")
            )}
        </Button>
    </div>
);
