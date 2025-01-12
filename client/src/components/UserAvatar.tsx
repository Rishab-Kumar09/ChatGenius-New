import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { useUser } from "@/hooks/use-user";

interface UserAvatarProps {
  user: User | null | undefined;
  className?: string;
  interactive?: boolean;
  forceRefresh?: boolean;
}

export function UserAvatar({
  user,
  className,
  interactive = true,
  forceRefresh = false
}: UserAvatarProps) {
  const [, setLocation] = useLocation();
  const { user: currentUser } = useUser();

  // Handle cases where user object is null or undefined
  if (!user) {
    return (
      <Avatar className={cn("ring-2 ring-background", className)}>
        <AvatarFallback className="text-sm font-semibold bg-primary text-primary-foreground">
          ?
        </AvatarFallback>
      </Avatar>
    );
  }

  // Get initials from username as fallback
  const getInitials = () => {
    if (user.username) {
      return user.username[0].toUpperCase();
    }
    return '?';
  };

  // Get the avatar URL, handling both full URLs and relative paths
  const getAvatarUrl = () => {
    if (!user.avatarUrl) return undefined;

    // If it's already a full URL, return as is
    if (user.avatarUrl.startsWith('http') || user.avatarUrl.startsWith('data:')) {
      return user.avatarUrl;
    }

    // For relative paths, ensure they start with /uploads/avatars/
    let url = user.avatarUrl;
    if (!url.startsWith('/uploads/avatars/')) {
      url = `/uploads/avatars/${url.replace(/^\//, '')}`;
    }

    // Add cache-busting if forceRefresh is true
    if (forceRefresh) {
      url = `${url}?t=${Date.now()}`;
    }

    return url;
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!interactive) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    // If this is the current user's avatar, navigate to /profile
    if (currentUser && user.id === currentUser.id) {
      setLocation('/profile');
    } else {
      // For other users, navigate to their specific profile page
      setLocation(`/profile/${user.id}`);
    }
  };

  return (
    <Avatar 
      className={cn(
        "ring-2 ring-background", 
        interactive && "cursor-pointer hover:opacity-80 transition-opacity",
        !interactive && "cursor-default",
        className
      )}
      onClick={handleClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <AvatarImage
        src={getAvatarUrl()}
        alt={user.username ? `${user.username}'s avatar` : 'User avatar'}
      />
      <AvatarFallback 
        className="text-sm font-semibold bg-primary text-primary-foreground"
      >
        {getInitials()}
      </AvatarFallback>
    </Avatar>
  );
}