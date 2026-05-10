import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

interface IncomeSourceDialogProps {
    open: boolean;
    editingSourceId: string | null;
    sourceFormData: {
        category: "salary" | "business_income" | "government_benefits" | "investment_income" | "gift" | "other";
        name: string;
        default_amount: string;
        owner_id: string;
        is_shared: boolean;
        co_parent_id: string;
        share_percentage: string;
    };
    members: any[];
    coParents: any[];
    onOpenChange: (open: boolean) => void;
    onFormDataChange: (data: any) => void;
    onSave: () => void;
    onDelete?: () => void;
}

export const IncomeSourceDialog = ({
    open,
    editingSourceId,
    sourceFormData,
    members,
    coParents,
    onOpenChange,
    onFormDataChange,
    onSave,
    onDelete,
}: IncomeSourceDialogProps) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{editingSourceId ? "Edit" : "Add"} Income Source</DialogTitle>
                    <DialogDescription>
                        Configure a recurring income source for your household
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Category</Label>
                        <Select
                            value={sourceFormData.category}
                            onValueChange={(v) => onFormDataChange({ ...sourceFormData, category: v as typeof sourceFormData.category })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="salary">Salary</SelectItem>
                                <SelectItem value="business_income">Business Income</SelectItem>
                                <SelectItem value="government_benefits">Government Benefits</SelectItem>
                                <SelectItem value="investment_income">Investment Income</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                            value={sourceFormData.name}
                            onChange={(e) => onFormDataChange({ ...sourceFormData, name: e.target.value })}
                            placeholder="e.g., Monthly Salary"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Owner</Label>
                        <Select
                            value={sourceFormData.owner_id}
                            onValueChange={(v) => onFormDataChange({ ...sourceFormData, owner_id: v })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {members.map((member) => (
                                    <SelectItem key={member.user_id} value={member.user_id}>
                                        {member.profiles.full_name || member.profiles.email}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>


                    <div className="space-y-2">
                        <Label>Default Amount</Label>
                        <Input
                            type="number"
                            value={sourceFormData.default_amount}
                            onChange={(e) => onFormDataChange({ ...sourceFormData, default_amount: e.target.value })}
                            placeholder="0"
                        />
                    </div>

                    {coParents.length > 0 && (
                        <>
                            <div className="flex items-center justify-between space-x-2 pt-2">
                                <div className="space-y-0.5">
                                    <Label>Shared Income</Label>
                                    <p className="text-sm text-muted-foreground">Split this income with a co-parent</p>
                                </div>
                                <Switch
                                    checked={sourceFormData.is_shared}
                                    onCheckedChange={(checked) => onFormDataChange({ ...sourceFormData, is_shared: checked })}
                                />
                            </div>

                            {sourceFormData.is_shared && (
                                <>
                                    <div className="space-y-2">
                                        <Label>Co-parent</Label>
                                        <Select
                                            value={sourceFormData.co_parent_id}
                                            onValueChange={(v) => onFormDataChange({ ...sourceFormData, co_parent_id: v })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select co-parent" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {coParents.map((coParent) => (
                                                    <SelectItem key={coParent.id} value={coParent.id}>
                                                        {coParent.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Your Share (%)</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={sourceFormData.share_percentage}
                                            onChange={(e) => onFormDataChange({ ...sourceFormData, share_percentage: e.target.value })}
                                            placeholder="50"
                                        />
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
                <DialogFooter className="flex-col gap-2">
                    <Button onClick={onSave} className="w-full">
                        {editingSourceId ? "Update" : "Add"}
                    </Button>
                    {editingSourceId && (
                        <div className="flex gap-2 w-full">
                            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                                Cancel
                            </Button>
                            {onDelete && (
                                <Button variant="destructive" onClick={onDelete} className="flex-1">
                                    Delete
                                </Button>
                            )}
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
