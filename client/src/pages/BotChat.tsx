import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "@/components/UserAvatar";
import { MessageInput } from "@/components/MessageInput";
import { Bot } from "lucide-react";

export function BotChat() {
  const [messages, setMessages] = useState<Array<{ content: string; isBot: boolean }>>([
    { content: "Hi! I'm your AI assistant. How can I help you today?", isBot: true }
  ]);

  const handleSendMessage = async (content: string) => {
    // Add user message
    setMessages(prev => [...prev, { content, isBot: false }]);

    try {
      const response = await fetch('/api/bot/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: content })
      });

      if (!response.ok) throw new Error('Failed to get bot response');
      const data = await response.json();

      // Add bot response
      setMessages(prev => [...prev, { content: data.response, isBot: true }]);
    } catch (error) {
      console.error('Error getting bot response:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `I apologize, but I encountered an error: ${errorMessage}. Please try asking your question again.` 
      }]);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
            <Bot className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">AI Assistant</h1>
            <p className="text-sm text-muted-foreground">Ask me anything about ChatGenius!</p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div key={index} className={`flex gap-3 ${message.isBot ? '' : 'justify-end'}`}>
              {message.isBot && (
                <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-5 w-5 text-blue-500" />
                </div>
              )}
              <div className={`flex-1 max-w-[80%] ${message.isBot ? 'order-2' : 'order-1'}`}>
                <div className={`rounded-lg p-3 ${
                  message.isBot 
                    ? 'bg-muted' 
                    : 'bg-primary text-primary-foreground ml-auto'
                }`}>
                  <p className="text-sm">{message.content}</p>
                </div>
              </div>
              {!message.isBot && <UserAvatar className="h-8 w-8 order-2" />}
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-background">
        <MessageInput onSend={handleSendMessage} placeholder="Ask me anything..." />
      </div>
    </div>
  );
}

export default BotChat;