import { Card, CardContent } from "@/components/ui/card";
import { Bot, MessageSquare } from "lucide-react";

export function Home() {
  return (
    <div className="container mx-auto p-8">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="h-8 w-8 text-blue-500" />
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