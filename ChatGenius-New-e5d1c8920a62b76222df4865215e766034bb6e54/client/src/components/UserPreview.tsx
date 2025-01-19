import { User } from "@/lib/types";
import { UserAvatar } from "./UserAvatar";
import { Card } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Circle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface UserPreviewProps {
  user: User;
  status?: 'online' | 'busy' | 'offline';
  children: React.ReactNode;
}

export function UserPreview({ user, status = 'offline', children }: UserPreviewProps) {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent 
        side="right" 
        align="start"
        className="w-80 bg-[#1a1f36] border-white/10"
      >
        <div className="flex justify-between space-x-4">
          <UserAvatar 
            user={user} 
            className="h-16 w-16 border-2 border-white/10" 
            interactive={false}
          />
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{user.displayName || user.username}</span>
              {user.username !== 'sarah' && (
                <Circle className={cn(
                  "h-2 w-2",
                  status === 'online' && "fill-green-500 text-green-500",
                  status === 'busy' && "fill-yellow-500 text-yellow-500",
                  status === 'offline' && "fill-red-500 text-red-500"
                )} />
              )}
            </div>
            <span className="text-sm text-muted-foreground">@{user.username}</span>
          </div>
        </div>
        {user.aboutMe && (
          <div className="mt-4">
            <p className="text-sm text-white/90">{user.aboutMe}</p>
          </div>
        )}
        {user.createdAt && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-xs text-white/50">
              Joined {format(new Date(user.createdAt), 'MMMM yyyy')}
            </p>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
