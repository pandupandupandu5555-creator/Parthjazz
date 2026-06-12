import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetOpenaiConversationQueryKey, getListOpenaiMessagesQueryKey, getListOpenaiConversationsQueryKey } from "@workspace/api-client-react";

export function useChatStream(conversationId?: number) {
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const queryClient = useQueryClient();
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const stopStreaming = useCallback(() => {
    readerRef.current?.cancel();
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    console.log("SENDING:", content);
    if (!conversationId || isStreaming || !content.trim()) return;

    setIsStreaming(true);
    setStreamingContent("");

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/openai/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) throw new Error(`Error: ${response.statusText}`);
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      readerRef.current = reader;

      const decoder = new TextDecoder();
      let fullContent = "";
      let streamDone = false;        // ← CORRECT POSITION: outside the while loop

      while (true) {
        const { done, value } = await reader.read();
        if (done || streamDone) break;

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
                streamDone = true;   // ← sets flag, exits inner loop
                break;
              }
            } catch {
              // malformed SSE chunk - skip
            }
          }
        }
      }

    } catch (error) {
      // Ignore stream cancellation - user clicked Stop
      if (error instanceof Error && error.name === 'AbortError') return;
    } finally {
      readerRef.current = null;
      setIsStreaming(false);
      setStreamingContent("");
      queryClient.invalidateQueries({ queryKey: getListOpenaiMessagesQueryKey(conversationId) });
      queryClient.invalidateQueries({ queryKey: getGetOpenaiConversationQueryKey(conversationId) });
      queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
    }
  }, [conversationId, isStreaming, queryClient]);

  return { sendMessage, stopStreaming, streamingContent, isStreaming };
}
