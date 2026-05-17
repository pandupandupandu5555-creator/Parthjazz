import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetOpenaiConversationQueryKey, getListOpenaiMessagesQueryKey, getListOpenaiConversationsQueryKey } from "@workspace/api-client-react";

export function useChatStream(conversationId?: number) {
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const queryClient = useQueryClient();

  const sendMessage = useCallback(async (content: string) => {
    if (!conversationId || isStreaming || !content.trim()) return;

    setIsStreaming(true);
    setStreamingContent("");

    try {
      // Optimistically add user message to cache? We'll just invalidate after.
      
      const response = await fetch(`/api/openai/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (!dataStr) continue;
            
            try {
              const data = JSON.parse(dataStr);
              if (data.content) {
                fullContent += data.content;
                setStreamingContent(fullContent);
              }
              if (data.done) {
                break;
              }
            } catch (e) {
              console.error('Failed to parse SSE JSON:', dataStr);
            }
          }
        }
      }
    } catch (error) {
      console.error("Stream error:", error);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      
      queryClient.invalidateQueries({ queryKey: getListOpenaiMessagesQueryKey(conversationId) });
      queryClient.invalidateQueries({ queryKey: getGetOpenaiConversationQueryKey(conversationId) });
      queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
    }
  }, [conversationId, isStreaming, queryClient]);

  return {
    sendMessage,
    streamingContent,
    isStreaming
  };
}
