import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, User as UserIcon, CalendarDays, Hash } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { useUser } from "@/hooks/use-user";
import type { SelectUser } from "@db/schema";

export function UserProfile() {
  const { id } = useParams();
  const { user: currentUser } = useUser();

  // Handle both numeric IDs and special 'sarah' case
  const userId = id === 'sarah' ? 'sarah' : id;

  const { data: profile, isLoading, error } = useQuery<SelectUser>({
    queryKey: ['user', userId],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch user profile');
      }
      return response.json();
    },
    enabled: !!userId,
    retry: false, // Don't retry on failure
  });

  console.log('UserProfile debug:', { userId, profile, error }); // Debug logging

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-destructive">Error loading profile: {(error as Error).message}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">User not found</p>
      </div>
    );
  }

  const displayName = profile.displayName || profile.username;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <UserAvatar
              user={profile}
              className="w-16 h-16"
              interactive={false}
            />
            <div>
              <CardTitle className="text-2xl">
                {displayName}
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Hash className="h-4 w-4" />
              <span>@{profile.username}</span>
            </div>
            {profile.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>{profile.email}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <UserIcon className="h-4 w-4" />
              <span>{displayName}</span>
            </div>
          </div>

          {profile.aboutMe && (
            <div className="pt-4 border-t">
              <h3 className="font-medium mb-2">About</h3>
              <p className="text-muted-foreground">{profile.aboutMe}</p>
            </div>
          )}

          <div className="pt-4 border-t flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            <span>Member since {new Date(profile.createdAt).toLocaleDateString()}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default UserProfile;