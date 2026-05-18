import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  useListOpenaiConversations,
  useCreateOpenaiConversation,
  useDeleteOpenaiConversation,
  useRenameOpenaiConversation,
  useSearchOpenaiConversations,
  useListOpenaiMessages,
  useGetOpenaiConversation,
  getListOpenaiConversationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useChatStream } from "@/hooks/use-chat-stream";
import { Plus, MessageSquare, Trash2, Cpu, Send, Menu, X, Search, Sun, Moon, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function HighlightedText({ text, term }: { text: string; term: string }) {
  if (!term.trim()) return <span>{text}</span>;
  const lowerText = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  const idx = lowerText.indexOf(lowerTerm);
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <mark className="bg-primary/30 text-primary-foreground rounded-sm px-0.5">{text.slice(idx, idx + term.length)}</mark>
      {text.slice(idx + term.length)}
    </span>
  );
}

export default function ChatPage() {
  const { theme, toggleTheme } = useTheme();
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [, setLocation] = useLocation();
  const params = useParams();
  const idParam = params.id ? parseInt(params.id) : undefined;

  const { data: conversations, isLoading: loadingConversations } = useListOpenaiConversations();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentConversation } = useGetOpenaiConversation(idParam!, {
    query: { enabled: !!idParam } as any,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: messages = [] } = useListOpenaiMessages(idParam!, {
    query: { enabled: !!idParam } as any,
  });

  const createConversation = useCreateOpenaiConversation();
  const deleteConversation = useDeleteOpenaiConversation();
  const renameConversation = useRenameOpenaiConversation();
  const queryClient = useQueryClient();

  const { sendMessage, isStreaming, streamingContent } = useChatStream(idParam);

  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const isSearching = debouncedSearch.trim().length > 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: searchResults = [], isFetching: searchFetching } = useSearchOpenaiConversations(
    { q: debouncedSearch },
    { query: { enabled: isSearching } as any }
  );

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSidebarOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  useEffect(() => {
    if (idParam && inputRef.current) {
      inputRef.current.focus();
    }
  }, [idParam]);

  useEffect(() => {
    if (editingId !== null && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleCreateNew = () => {
    createConversation.mutate(
      { data: { title: "New Conversation" } },
      {
        onSuccess: (conv) => {
          queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
          setLocation(`/c/${conv.id}`);
          setSidebarOpen(false);
          setSearchQuery("");
        },
      }
    );
  };

  const handleDelete = (e: React.MouseEvent, convId: number) => {
    e.preventDefault();
    e.stopPropagation();
    deleteConversation.mutate(
      { id: convId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
          if (idParam === convId) setLocation("/");
        },
      }
    );
  };

  const startEditing = (e: React.MouseEvent, convId: number, currentTitle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(convId);
    setEditingTitle(currentTitle);
  };

  const commitEdit = useCallback(() => {
    if (editingId === null) return;
    const trimmed = editingTitle.trim();
    if (!trimmed) {
      setEditingId(null);
      setEditingTitle("");
      return;
    }
    renameConversation.mutate(
      { id: editingId, data: { title: trimmed } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        },
      }
    );
    setEditingId(null);
    setEditingTitle("");
  }, [editingId, editingTitle, renameConversation, queryClient]);

  const cancelEdit = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
    else if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
  };

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isStreaming || !idParam) return;
    sendMessage(inputValue);
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (id: number, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const handleSearchResultClick = (convId: number) => {
    setLocation(`/c/${convId}`);
    setSidebarOpen(false);
    setSearchQuery("");
  };

  const ConversationList = () => (
    <>
      {loadingConversations ? (
        <div className="p-4 text-center text-sm text-muted-foreground animate-pulse">
          Initializing data streams...
        </div>
      ) : conversations?.length === 0 ? (
        <div className="p-4 text-center text-xs text-muted-foreground uppercase tracking-wider">
          No active protocols
        </div>
      ) : (
        conversations?.map((conv) => (
          <div key={conv.id}>
            {editingId === conv.id ? (
              <div
                className={cn(
                  "flex items-center gap-2 p-3 rounded-md",
                  "bg-sidebar-accent shadow-[inset_2px_0_0_0_hsl(var(--sidebar-primary))]"
                )}
              >
                <MessageSquare className="w-4 h-4 shrink-0 text-primary" />
                <input
                  ref={editInputRef}
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  onBlur={commitEdit}
                  className="flex-1 min-w-0 bg-transparent text-sm text-sidebar-accent-foreground outline-none border-b border-primary/50 focus:border-primary pb-px"
                  maxLength={80}
                />
              </div>
            ) : (
              <Link href={`/c/${conv.id}`}>
                <div
                  className={cn(
                    "group flex items-center justify-between p-3 rounded-md text-sm transition-all duration-200 cursor-pointer",
                    idParam === conv.id
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_0_hsl(var(--sidebar-primary))]"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                    <MessageSquare
                      className={cn("w-4 h-4 shrink-0", idParam === conv.id ? "text-primary" : "")}
                    />
                    <span
                      className="truncate cursor-text"
                      onClick={(e) => startEditing(e, conv.id, conv.title)}
                      title="Click to rename"
                    >
                      {conv.title || "Unknown Protocol"}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    onClick={(e) => handleDelete(e, conv.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Link>
            )}
          </div>
        ))
      )}
    </>
  );

  const SearchResults = () => (
    <>
      {searchFetching ? (
        <div className="p-4 text-center text-sm text-muted-foreground animate-pulse">
          Scanning data streams...
        </div>
      ) : searchResults.length === 0 ? (
        <div className="p-4 text-center text-xs text-muted-foreground uppercase tracking-wider">
          No matches found
        </div>
      ) : (
        searchResults.map((result) => (
          <button
            key={result.id}
            onClick={() => handleSearchResultClick(result.id)}
            className={cn(
              "w-full text-left p-3 rounded-md text-sm transition-all duration-200 space-y-1",
              idParam === result.id
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_0_hsl(var(--sidebar-primary))]"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <div className="flex items-center gap-2 font-medium truncate">
              <MessageSquare
                className={cn("w-3.5 h-3.5 shrink-0", idParam === result.id ? "text-primary" : "text-primary/60")}
              />
              <span className="truncate">
                <HighlightedText text={result.title} term={debouncedSearch} />
              </span>
            </div>
            {result.snippet && (
              <p className="text-xs text-muted-foreground/70 pl-5 line-clamp-2 leading-relaxed">
                <HighlightedText text={result.snippet} term={debouncedSearch} />
              </p>
            )}
          </button>
        ))
      )}
    </>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden animate-in fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed md:static inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-sidebar-border transform transition-transform duration-300 ease-in-out md:transform-none flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-sidebar-primary">
            <Cpu className="w-6 h-6" />
            <span className="font-bold tracking-widest text-lg uppercase">JARVIS</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-sidebar-foreground"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-3 space-y-2">
          <Button
            onClick={handleCreateNew}
            className="w-full justify-start gap-2 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-all group"
          >
            <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
            Initialize Protocol
          </Button>

          {/* Search input */}
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-8 pr-14 py-2 text-sm bg-sidebar-accent/40 border border-sidebar-border/60 rounded-md outline-none focus:border-primary/40 focus:bg-sidebar-accent/60 placeholder:text-muted-foreground/40 text-sidebar-foreground transition-colors"
            />
            {searchQuery ? (
              <button
                onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}
                className="absolute right-2.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="absolute right-2.5 pointer-events-none flex items-center gap-0.5 text-[10px] font-mono text-muted-foreground/30 select-none">
                <span>⌘</span><span>K</span>
              </kbd>
            )}
          </div>
        </div>

        {isSearching && (
          <div className="px-3 pb-1">
            <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest font-mono">
              {searchFetching ? "Scanning…" : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isSearching ? <SearchResults /> : <ConversationList />}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative min-w-0">
        <header className="h-14 border-b border-border flex items-center px-4 shrink-0 bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden mr-2 text-foreground"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          {currentConversation ? (
            <h1 className="text-sm font-medium tracking-wide uppercase text-foreground/80">
              {currentConversation.title}
            </h1>
          ) : (
            <div className="w-full flex justify-center">
              <span className="text-xs tracking-[0.2em] text-primary/60 uppercase">System Standby</span>
            </div>
          )}
        </header>

        {idParam ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
              {messages.length === 0 && !isStreaming ? (
                <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto animate-slide-up-fade">
                  <div className="w-16 h-16 rounded-full border border-primary/30 flex items-center justify-center mb-4 bg-primary/5 shadow-[0_0_30px_hsl(var(--primary)/0.1)]">
                    <Cpu className="w-8 h-8 text-primary animate-pulse-glow" />
                  </div>
                  <h2 className="text-xl font-medium tracking-widest uppercase mb-2">Systems Online</h2>
                  <p className="text-muted-foreground text-sm">
                    Jarvis is ready for your command. Input directives below to begin.
                  </p>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto space-y-6 pb-8">
                  {messages.map((msg, i) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "group/msg flex w-full animate-slide-up-fade",
                        msg.role === "user" ? "justify-end" : "justify-start"
                      )}
                      style={{ animationDelay: `${Math.min(i * 50, 300)}ms` }}
                    >
                      <div className="relative max-w-[85%]">
                        <div
                          className={cn(
                            "rounded-2xl px-5 py-4 text-[15px] leading-relaxed",
                            msg.role === "user"
                              ? "bg-secondary text-secondary-foreground rounded-br-sm"
                              : "bg-transparent border border-border/50 text-foreground"
                          )}
                        >
                          {msg.role === "assistant" && (
                            <div className="flex items-center gap-2 mb-2">
                              <Cpu className="w-4 h-4 text-primary" />
                              <span className="text-xs font-bold tracking-widest text-primary uppercase">
                                Jarvis
                              </span>
                            </div>
                          )}
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        </div>
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          title="Copy message"
                          className={cn(
                            "absolute -bottom-3 p-1 rounded-md border transition-all duration-200",
                            "bg-background border-border/50 text-muted-foreground hover:text-foreground hover:border-border",
                            "opacity-0 group-hover/msg:opacity-100 focus:opacity-100",
                            msg.role === "user" ? "right-2" : "left-2"
                          )}
                        >
                          {copiedId === msg.id
                            ? <Check className="w-3 h-3 text-primary" />
                            : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  ))}

                  {isStreaming && (
                    <div className="flex w-full justify-start animate-slide-up-fade">
                      <div className="max-w-[85%] rounded-2xl px-5 py-4 bg-transparent border border-primary/20 shadow-[0_0_15px_hsl(var(--primary)/0.05)] text-foreground">
                        <div className="flex items-center gap-2 mb-2">
                          <Cpu className="w-4 h-4 text-primary animate-pulse-glow" />
                          <span className="text-xs font-bold tracking-widest text-primary uppercase">
                            Jarvis Processing
                          </span>
                        </div>
                        <div className="whitespace-pre-wrap">{streamingContent}</div>
                        {!streamingContent && (
                          <div className="flex gap-1 mt-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="p-4 md:px-8 bg-gradient-to-t from-background via-background to-transparent pt-5 shrink-0">
              <div className="max-w-3xl mx-auto relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-accent/30 rounded-xl blur opacity-20 group-focus-within:opacity-50 transition duration-500"></div>
                <div className="relative flex items-end gap-2 bg-secondary/80 backdrop-blur border border-border/50 focus-within:border-primary/50 rounded-xl p-2 transition-colors">
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Input command sequence..."
                    className="w-full max-h-48 min-h-[44px] bg-transparent resize-none outline-none py-2.5 px-3 text-[15px] placeholder:text-muted-foreground/60 scrollbar-thin"
                    rows={1}
                    disabled={isStreaming}
                    style={{ height: "auto" }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = "auto";
                      target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
                    }}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isStreaming}
                    className="h-10 w-10 shrink-0 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-300 disabled:opacity-50"
                    size="icon"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                <div className="text-center mt-2">
                  <span className="text-[10px] text-muted-foreground/40 uppercase tracking-widest font-mono">
                    Shift+Enter for newline
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,hsl(var(--background))_100%)]">
            <div className="relative mb-8 group">
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 group-hover:scale-110 group-hover:bg-primary/30 transition-all duration-1000"></div>
              <div className="w-24 h-24 rounded-full border border-primary/40 flex items-center justify-center relative bg-background/50 backdrop-blur">
                <Cpu className="w-10 h-10 text-primary animate-pulse-glow" />
              </div>
            </div>
            <h2 className="text-2xl font-light tracking-[0.3em] uppercase mb-4 text-foreground/90">
              Jarvis Online
            </h2>
            <p className="text-muted-foreground max-w-md mb-8">
              Personal AI Assistant Interface. Initialize a new protocol to begin interaction sequence.
            </p>
            <Button
              onClick={handleCreateNew}
              size="lg"
              className="bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 hover:border-primary/50 tracking-wider uppercase transition-all duration-300"
            >
              Initialize New Protocol
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
