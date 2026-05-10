import { useState } from "react";
import { toast } from "sonner";

interface UseEntityFormOpts {
    /** Capitalized name used in toast messages, e.g. "Subscription". */
    entityName: string;
    isEdit: boolean;
    save: () => Promise<void>;
    /** Omit when not in edit mode or delete isn't supported. */
    remove?: () => Promise<void>;
    /** Called after a successful save. Parent typically refetches + closes. */
    onSaved?: () => void;
    /** Called after a successful delete. */
    onDeleted?: () => void;
    /** Reset form fields to blank — used when "Create another" is checked. */
    resetForm?: () => void;
    /** Current form values; together with `pristineValues` enables dirty tracking. */
    formValues?: unknown;
    /** Form values at last reset (initial load or after Create-another). */
    pristineValues?: unknown;
}

export function useEntityForm({
    entityName,
    isEdit,
    save,
    remove,
    onSaved,
    onDeleted,
    resetForm,
    formValues,
    pristineValues,
}: UseEntityFormOpts) {
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [createAnother, setCreateAnother] = useState(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

    const isDirty = formValues === undefined
        ? true
        : JSON.stringify(formValues) !== JSON.stringify(pristineValues);

    const lower = entityName.toLowerCase();

    const handleSave = async () => {
        setSaving(true);
        try {
            await save();
            toast.success(`${entityName} ${isEdit ? "updated" : "added"}`);
            onSaved?.();
            if (!isEdit && createAnother) resetForm?.();
        } catch (err: any) {
            toast.error(err?.message || `Failed to save ${lower}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!remove) return;
        setDeleting(true);
        try {
            await remove();
            toast.success(`${entityName} deleted`);
            setConfirmDeleteOpen(false);
            onDeleted?.();
        } catch (err: any) {
            toast.error(err?.message || `Failed to delete ${lower}`);
        } finally {
            setDeleting(false);
        }
    };

    return {
        saving,
        deleting,
        createAnother,
        setCreateAnother,
        confirmDeleteOpen,
        setConfirmDeleteOpen,
        handleSave,
        handleDelete,
        requestDelete: () => setConfirmDeleteOpen(true),
        isDirty,
    };
}
