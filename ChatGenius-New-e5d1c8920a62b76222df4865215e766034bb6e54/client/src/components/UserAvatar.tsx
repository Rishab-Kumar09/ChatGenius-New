import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Link } from "wouter";

interface UserAvatarProps {
  user: User;
  className?: string;
  interactive?: boolean;
  forceRefresh?: boolean;
}

export function UserAvatar({ user, className, interactive = true, forceRefresh = false }: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [key, setKey] = useState(Date.now());

  // Reset error state when avatar URL changes
  const handleError = () => {
    console.error('Avatar image failed to load:', user.avatarUrl);
    setImageError(true);
  };

  // Reset error state when URL changes
  if (user.avatarUrl && imageError) {
    setImageError(false);
    setKey(Date.now()); // Force reload the image
  }

  // Ensure the avatar URL is absolute
  const getFullAvatarUrl = (url: string | null | undefined) => {
    if (!url) return null;
    // If it's already an absolute URL, return as is
    if (url.startsWith('http')) return url;
    // If it's a relative URL, make it absolute
    return `${window.location.origin}${url}${url.includes('?') ? '&' : '?'}t=${key}`;
  };

  const avatarUrl = getFullAvatarUrl(user.avatarUrl);

  const AvatarComponent = (
    <Avatar 
      className={cn(
        "relative border-2 border-background dark:border-background",
        interactive && "cursor-pointer hover:opacity-80",
        className
      )}
    >
      {avatarUrl && !imageError ? (
        <AvatarImage 
          src={avatarUrl}
          alt={user.displayName || user.username}
          onError={handleError}
        />
      ) : (
        <AvatarFallback className="bg-primary text-primary-foreground">
          {(user.displayName || user.username || "?").charAt(0).toUpperCase()}
        </AvatarFallback>
      )}
      {user.presence?.status === "online" && (
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background dark:border-background" />
      )}
    </Avatar>
  );

  if (interactive) {
    // Skip link if user ID is not available
    if (!user?.id) {
      return AvatarComponent;
    }

    return (
      <Link 
        href={`/users/${user.id}`}
        onClick={() => {
          console.log('UserAvatar clicked:', { userId: user.id, username: user.username });
        }}
      >
        {AvatarComponent}
      </Link>
    );
  }

  return AvatarComponent;
}