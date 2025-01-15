import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Message, Channel, User, SearchResults } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

async function fetchSearchResults(query: string, isUserSearch: boolean): Promise<SearchResults> {
  const response = await fetch(`/api/search?query=${encodeURIComponent(query)}${isUserSearch ? '&type=users' : ''}`);
  
  if (!response.ok) {
    throw new Error(await response.text());
  }
  
  return response.json();
}

export function useSearch() {
  const [query, setQuery] = useState("");
  const { toast } = useToast();

  // Extract @ mentions for specialized user search
  const isUserSearch = query.startsWith('@');
  const searchQuery = isUserSearch ? query.slice(1) : query;

  const { data, isLoading, error } = useQuery({
    queryKey: ['search', searchQuery, isUserSearch],
    queryFn: () => fetchSearchResults(searchQuery, isUserSearch),
    enabled: query.length > 0,
    placeholderData: { messages: [], channels: [], users: [] } as SearchResults
  });

  // Handle errors
  useEffect(() => {
    if (error) {
      console.error('Search error:', error);
      toast({
        title: "Search failed",
        description: error instanceof Error ? error.message : "Failed to perform search",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  return {
    query,
    setQuery,
    results: data || { messages: [], channels: [], users: [] },
    isLoading,
    error,
    isUserSearch
  };
}