import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "../hooks/use-user";
import { useWebSocket } from "../hooks/use-websocket";
import { SearchResults } from "./SearchResults";
import { MessageThread } from "./MessageThread";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useToast } from "../hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export function Channel() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  
  const onSelect = (type: 'message' | 'channel' | 'dm', id: string | number) => {
    if (type === 'channel') {
      navigate(`/channel/${id}`);
    } else if (type === 'dm') {
      navigate(`/dm/${id}`);
    }
    setQuery(''); // Clear search after selection
  };
  
  // ... rest of component code
} 