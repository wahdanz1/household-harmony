import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2, User, Upload } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AvatarCropDialog } from "./AvatarCropDialog";

/**
 * Display-only profile hero: avatar + name + email + Change avatar action.
 * Reads identity from HouseholdContext.members (already populated, no extra
 * fetch) and only writes when the user uploads a new avatar.
 */
export const ProfileCard = () => {
    const { user } = useAuth();
    const { members, refresh: refreshHousehold } = useHousehold();
    const [uploading, setUploading] = useState(false);
    const [cropDialogOpen, setCropDialogOpen] = useState(false);
    const [imageToCrop, setImageToCrop] = useState<string>("");

    const me = members.find(m => m.user_id === user?.id);
    const fullName = me?.profiles?.full_name?.trim() || "";
    const email = me?.profiles?.email || "";
    const avatarUrl = me?.profiles?.avatar_url || null;

    const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            setImageToCrop(reader.result as string);
            setCropDialogOpen(true);
        };
        reader.readAsDataURL(file);
        e.target.value = "";
    };

    const handleCropComplete = async (croppedBlob: Blob) => {
        if (!user) return;
        setUploading(true);
        try {
            const filePath = `${user.id}/avatar.jpg`;
            const { error: uploadError } = await supabase.storage
                .from("avatars")
                .upload(filePath, croppedBlob, { upsert: true });
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
            const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;
            const { error: updateError } = await supabase
                .from("profiles")
                .update({ avatar_url: urlWithCacheBust })
                .eq("id", user.id);
            if (updateError) throw updateError;
            toast.success("Profile photo updated");
            await refreshHousehold();
        } catch (error: any) {
            console.error("Error uploading avatar:", error);
            toast.error(error.message || "Failed to upload profile photo");
        } finally {
            setUploading(false);
        }
    };

    return (
        <>
            <Card variant="flush">
                <CardHeader className="p-0 space-y-0 border-b border-line-2">
                    <p className="px-5 py-2.5 text-[11.5px] font-semibold text-muted uppercase tracking-[0.08em] leading-[1.5]">
                        Profile
                    </p>
                </CardHeader>
                <CardContent className="p-5 mt-0">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16 shrink-0">
                            <AvatarImage src={avatarUrl || undefined} alt={fullName || "User"} />
                            <AvatarFallback>
                                <User className="h-8 w-8" />
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-ink truncate">{fullName || "Unnamed"}</p>
                            <p className="text-sm text-muted truncate">{email}</p>
                        </div>
                        <label htmlFor="profile-avatar-upload" className="shrink-0">
                            <Button variant="secondary" size="sm" asChild>
                                <span className="cursor-pointer">
                                    {uploading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Upload className="h-4 w-4" />
                                    )}
                                    <span className="ml-2">Change avatar</span>
                                </span>
                            </Button>
                            <input
                                id="profile-avatar-upload"
                                type="file"
                                accept="image/*"
                                onChange={handleFilePick}
                                className="hidden"
                                disabled={uploading}
                            />
                        </label>
                    </div>
                </CardContent>
            </Card>
            <AvatarCropDialog
                open={cropDialogOpen}
                imageSrc={imageToCrop}
                onClose={() => setCropDialogOpen(false)}
                onCropComplete={handleCropComplete}
            />
        </>
    );
};
