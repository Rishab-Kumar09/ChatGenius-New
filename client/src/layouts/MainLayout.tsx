import { ReactNode, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LogOut, User } from "lucide-react";
import { useLocation } from "wouter";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function MainLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useUser();
  const [, navigate] = useLocation();

  useEffect(() => {
    const currentPath = window.location.hash.slice(1);
    if (!user && !isLoading && currentPath !== '/login') {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar className="w-64 border-r" />
      <main className="flex-1 relative flex flex-col">
        <header className="h-14 border-b px-4 flex items-center justify-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <UserAvatar
                  user={user}
                  className="h-8 w-8"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <ScrollArea className="flex-1">
          {children}
        </ScrollArea>
      </main>
    </div>
  );
}