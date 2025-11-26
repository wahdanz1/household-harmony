import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Home, Copy, Check, UserPlus } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { JoinExistingUserDialog } from "./JoinExistingUserDialog";
import { useAuth } from "@/contexts/AuthContext";

interface HouseholdInfoCardProps {
  household: {
    id: string;
    name: string;
    currency: string;
  };
  onUpdate: () => void;
}

export const HouseholdInfoCard = ({ household, onUpdate }: HouseholdInfoCardProps) => {
  const { user } = useAuth();
  const [name, setName] = useState(household.name);
  const [currency, setCurrency] = useState(household.currency);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await supabase
      .from("households")
      .update({ name, currency })
      .eq("id", household.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update household info",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Household info updated",
      });
      onUpdate();
    }
    setIsSaving(false);
  };

  const copyHouseholdId = () => {
    navigator.clipboard.writeText(household.id);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Household ID copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Home className="h-5 w-5 text-primary" />
          Household Information
        </CardTitle>
        <CardDescription>Manage your household name and currency</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="household-name">Household Name</Label>
            <Input
              id="household-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Household"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SEK">SEK (Swedish Crowns)</SelectItem>
                <SelectItem value="EUR">EUR (Euro)</SelectItem>
                <SelectItem value="USD">USD (US Dollar)</SelectItem>
                <SelectItem value="NOK">NOK (Norwegian Krone)</SelectItem>
                <SelectItem value="DKK">DKK (Danish Krone)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Household ID</Label>
            <div className="flex gap-2">
              <div className="flex-1 font-mono text-sm py-2 px-3 rounded-md bg-muted text-muted-foreground border border-border truncate">
                {household.id}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={copyHouseholdId}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
          <Button variant="outline" onClick={() => setShowJoinDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Join Another Household
          </Button>
        </div>
      </CardContent>

      <JoinExistingUserDialog
        open={showJoinDialog}
        onOpenChange={setShowJoinDialog}
        onSuccess={onUpdate}
      />
    </Card>
  );
};
