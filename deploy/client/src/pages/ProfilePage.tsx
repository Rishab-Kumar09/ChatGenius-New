import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-user";
import { format, parseISO } from "date-fns";
import { PencilLine, Check, X, Mail, CalendarDays } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEventSource } from "@/hooks/use-event-source";
import { AvatarUpload } from "@/components/AvatarUpload.tsx";

export function ProfilePage() {
  const { user } = useUser();
  const [aboutMe, setAboutMe] = useState(user?.aboutMe || "");
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [isEditingAboutMe, setIsEditingAboutMe] = useState(false);
  const [isEditingBasicInfo, setIsEditingBasicInfo] = useState(false);
  const [tempAboutMe, setTempAboutMe] = useState(aboutMe);
  const [tempDisplayName, setTempDisplayName] = useState(displayName);
  const [tempEmail, setTempEmail] = useState(email);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Listen for profile updates via SSE
  const { lastEvent } = useEventSource();
  useEffect(() => {
    if (lastEvent?.type === 'profile_update' && lastEvent.data.userId === user?.id) {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    }
  }, [lastEvent, user?.id, queryClient]);

  useEffect(() => {
    if (user) {
      setAboutMe(user.aboutMe || "");
      setDisplayName(user.displayName || "");
      setEmail(user.email || "");
      setTempAboutMe(user.aboutMe || "");
      setTempDisplayName(user.displayName || "");
      setTempEmail(user.email || "");
    }
  }, [user]);

  if (!user) return null;

  const memberSince = user.createdAt ? format(parseISO(user.createdAt.toString()), "MMMM d, yyyy") : "Unknown";

  const handleSaveBasicInfo = async () => {
    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          displayName: tempDisplayName,
          email: tempEmail
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      await queryClient.invalidateQueries({ queryKey: ['/api/users/me'] });
      setDisplayName(tempDisplayName);
      setEmail(tempEmail);
      setIsEditingBasicInfo(false);
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    }
  };

  const handleSaveAboutMe = async () => {
    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ aboutMe: tempAboutMe }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      await queryClient.invalidateQueries({ queryKey: ['/api/users/me'] });
      setAboutMe(tempAboutMe);
      setIsEditingAboutMe(false);
      toast({
        title: "Success",
        description: "About Me updated successfully",
      });
    } catch (error) {
      console.error('Failed to update About Me:', error);
      toast({
        title: "Error",
        description: "Failed to update About Me",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex flex-col items-center mb-8">
        <AvatarUpload 
          user={user} 
          size="lg"
          disabled={user.username === 'ai-assistant'} 
        />

        <div className="mt-6 w-full max-w-3xl space-y-6">
          {/* Basic Info Card */}
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Basic Info</h2>
              {!isEditingBasicInfo ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingBasicInfo(true)}
                >
                  <PencilLine className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSaveBasicInfo}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsEditingBasicInfo(false);
                      setTempDisplayName(displayName);
                      setTempEmail(email);
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <Label>Display Name</Label>
                {isEditingBasicInfo ? (
                  <Input
                    value={tempDisplayName}
                    onChange={(e) => setTempDisplayName(e.target.value)}
                    placeholder="Enter your display name"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{displayName || user.username}</p>
                )}
              </div>

              <div>
                <Label>Email</Label>
                {isEditingBasicInfo ? (
                  <Input
                    value={tempEmail}
                    onChange={(e) => setTempEmail(e.target.value)}
                    placeholder="Enter your email"
                    type="email"
                  />
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {email}
                  </div>
                )}
              </div>

              <div>
                <Label>Member Since</Label>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  {memberSince}
                </div>
              </div>
            </div>
          </div>

          {/* About Me Card */}
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">About Me</h2>
              {!isEditingAboutMe ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingAboutMe(true)}
                >
                  <PencilLine className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSaveAboutMe}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsEditingAboutMe(false);
                      setTempAboutMe(aboutMe);
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            {isEditingAboutMe ? (
              <Input
                value={tempAboutMe}
                onChange={(e) => setTempAboutMe(e.target.value)}
                placeholder="Tell us about yourself"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {aboutMe || "No information provided"}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
