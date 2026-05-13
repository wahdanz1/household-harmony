import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Upload, User, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { DateInput } from "@/components/ui/date-input";
import { AvatarCropDialog } from "./AvatarCropDialog";

export const PersonalSettingsCard = () => {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [birthdate, setBirthdate] = useState<Date | undefined>(undefined);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [emailPublic, setEmailPublic] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string>("");

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("full_name, email, birthdate, avatar_url, email_public")
        .eq("id", user.id)
        .single();

      if (data) {
        setFullName(data.full_name || "");
        setEmail(data.email);
        setAvatarUrl(data.avatar_url);
        setEmailPublic(data.email_public ?? true);
        if (data.birthdate) {
          setBirthdate(new Date(data.birthdate));
        }
      }
    };

    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        birthdate: birthdate ? format(birthdate, "yyyy-MM-dd") : null,
        email_public: emailPublic,
      })
      .eq("id", user.id);

    setIsSaving(false);

    if (error) {
      toast.error("Failed to update profile");
      return;
    }

    toast.success("Profile updated successfully");
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      const fileExt = "jpg";
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, croppedBlob, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Add cache-busting parameter to force browser to reload the image
      const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: urlWithCacheBust })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setAvatarUrl(urlWithCacheBust);
      toast.success("Profile photo updated successfully");
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      toast.error(error.message || "Failed to upload profile photo");
    } finally {
      setUploading(false);
    }
  };

  const handleChangePassword = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });

    if (error) {
      toast.error("Failed to send password reset email");
      return;
    }

    toast.success("Password reset email sent! Check your inbox.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal Settings</CardTitle>
        <CardDescription>Manage your personal information and account settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            <Avatar className="h-24 w-24">
              <AvatarImage src={avatarUrl || undefined} alt={fullName || "User"} />
              <AvatarFallback>
                <User className="h-12 w-12" />
              </AvatarFallback>
            </Avatar>
            <label htmlFor="avatar-upload" className="absolute bottom-0 right-0 p-2 bg-accent text-accent-ink rounded-full cursor-pointer hover:bg-accent/90 transition-colors">
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarSelect}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Profile Photo</p>
            <p className="text-sm text-muted">
              Click the upload icon to change your photo
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="email">Email</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">
                  {emailPublic ? "Visible" : "Hidden"}
                </span>
                <Switch
                  checked={emailPublic}
                  onCheckedChange={setEmailPublic}
                />
              </div>
            </div>
            <Input
              id="email"
              type="email"
              value={email}
              disabled
              className="bg-surface-2"
            />
          </div>

          <div className="space-y-2">
            <Label>Date of Birth</Label>
            <DateInput
              value={birthdate}
              onChange={setBirthdate}
              placeholder="YYYY-MM-DD"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button onClick={handleSave} disabled={isSaving} className="flex-1">
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleChangePassword}
            className="flex-1"
          >
            Change Password
          </Button>
        </div>
      </CardContent>

      <AvatarCropDialog
        open={cropDialogOpen}
        imageSrc={imageToCrop}
        onClose={() => setCropDialogOpen(false)}
        onCropComplete={handleCropComplete}
      />
    </Card>
  );
};
