import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, UserMinus, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface Member {
  id: string;
  user_id: string;
  role: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

interface HouseholdMembersCardProps {
  members: Member[];
  householdId: string;
  onUpdate: () => void;
}

export const HouseholdMembersCard = ({ members, householdId, onUpdate }: HouseholdMembersCardProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const currentMember = members.find(m => m.user_id === user?.id);
  const isOwner = currentMember?.role === "owner";

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await supabase
      .from("household_members")
      .delete()
      .eq("id", memberId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Member removed from household",
      });
      onUpdate();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Household Members
        </CardTitle>
        <CardDescription>Manage who has access to this household</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/40"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{member.profiles.full_name || "Unknown"}</p>
                  {member.role === "owner" && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Crown className="h-3 w-3" />
                      Owner
                    </Badge>
                  )}
                  {member.user_id === user?.id && (
                    <Badge variant="outline">You</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{member.profiles.email}</p>
              </div>
              
              {isOwner && member.role !== "owner" && member.user_id !== user?.id && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveMember(member.id)}
                >
                  <UserMinus className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
