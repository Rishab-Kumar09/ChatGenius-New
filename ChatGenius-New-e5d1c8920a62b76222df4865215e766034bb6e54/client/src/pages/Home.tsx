import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

export function Home() {
  return (
    <div className="container mx-auto p-8">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Welcome to Chat Genius</h1>
          </div>
          <p className="text-muted-foreground">
            Select a channel or direct message to start chatting
          </p>
        </CardContent>
      </Card>
    </div>
  );
}