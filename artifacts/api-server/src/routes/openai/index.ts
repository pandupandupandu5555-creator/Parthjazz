import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, pool, conversations, messages } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { readNotes, saveNote } from "../../notes.js";
import {
  CreateOpenaiConversationBody,
  GetOpenaiConversationParams,
  RenameOpenaiConversationParams,
  RenameOpenaiConversationBody,
  DeleteOpenaiConversationParams,
  ListOpenaiMessagesParams,
  SearchOpenaiConversationsQueryParams,
  SendOpenaiMessageParams,
  SendOpenaiMessageBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/openai/conversations", async (_req, res): Promise<void> => {
  const result = await db
    .select()
    .from(conversations)
    .orderBy(asc(conversations.createdAt));
  res.json(result);
});

router.post("/openai/conversations", async (req, res): Promise<void> => {
  const parsed = CreateOpenaiConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [conversation] = await db
    .insert(conversations)
    .values({ title: parsed.data.title })
    .returning();

  res.status(201).json(conversation);
});

router.get("/openai/conversations/search", async (req, res): Promise<void> => {
  const parsed = SearchOpenaiConversationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const term = parsed.data.q.trim();
  if (!term) {
    res.json([]);
    return;
  }

  const pattern = `%${term}%`;

  const rows = await pool.query<{
    id: number;
    title: string;
    created_at: string;
    snippet: string;
  }>(
    `SELECT DISTINCT ON (c.id)
       c.id,
       c.title,
       c.created_at,
       COALESCE(m.content, '') AS snippet
     FROM conversations c
     LEFT JOIN messages m
       ON m.conversation_id = c.id AND m.content ILIKE $1
     WHERE c.title ILIKE $1 OR m.content ILIKE $1
     ORDER BY c.id, m.created_at ASC
     LIMIT 30`,
    [pattern]
  );

  const results = rows.rows.map((row) => {
    const lowerTerm = term.toLowerCase();
    const lowerSnippet = row.snippet.toLowerCase();
    const idx = lowerSnippet.indexOf(lowerTerm);
    let snippet = row.snippet;
    if (idx !== -1) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(row.snippet.length, idx + term.length + 60);
      snippet = (start > 0 ? "…" : "") + row.snippet.slice(start, end) + (end < row.snippet.length ? "…" : "");
    } else {
      snippet = row.snippet.slice(0, 100) + (row.snippet.length > 100 ? "…" : "");
    }
    return {
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      snippet,
    };
  });

  res.json(results);
});

router.get("/openai/conversations/:id", async (req, res): Promise<void> => {
  const params = GetOpenaiConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, params.data.id));

  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, params.data.id))
    .orderBy(asc(messages.createdAt));

  res.json({ ...conversation, messages: msgs });
});

router.patch("/openai/conversations/:id", async (req, res): Promise<void> => {
  const params = RenameOpenaiConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = RenameOpenaiConversationBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [updated] = await db
    .update(conversations)
    .set({ title: body.data.title })
    .where(eq(conversations.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  res.json(updated);
});

router.delete("/openai/conversations/:id", async (req, res): Promise<void> => {
  const params = DeleteOpenaiConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [conversation] = await db
    .delete(conversations)
    .where(eq(conversations.id, params.data.id))
    .returning();

  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  res.sendStatus(204);
});

router.get(
  "/openai/conversations/:id/messages",
  async (req, res): Promise<void> => {
    const params = ListOpenaiMessagesParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, params.data.id))
      .orderBy(asc(messages.createdAt));

    res.json(msgs);
  }
);

router.post(
  "/openai/conversations/:id/messages",
  async (req, res): Promise<void> => {
    const params = SendOpenaiMessageParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const body = SendOpenaiMessageBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, params.data.id));

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const userContent = body.data.content;
    const lowerContent = userContent.toLowerCase();

    await db.insert(messages).values({
      conversationId: params.data.id,
      role: "user",
      content: userContent,
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Helper: send a plain reply without calling OpenAI
    const sendDirectReply = async (replyText: string, isFirst: boolean) => {
      await db.insert(messages).values({
        conversationId: params.data.id,
        role: "assistant",
        content: replyText,
      });
      if (isFirst) {
        const autoTitle = replyText.slice(0, 42).replace(/\s+\S*$/, "") + (replyText.length > 42 ? "…" : "");
        await pool.query("UPDATE conversations SET title = $1 WHERE id = $2", [autoTitle, params.data.id]);
      }
      res.write(`data: ${JSON.stringify({ content: replyText })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    };

    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, params.data.id))
      .orderBy(asc(messages.createdAt));

    const isFirstMessage = history.length === 1;

    // ── "Remember this" ────────────────────────────────────────────
    if (lowerContent.includes("remember this")) {
      const match = userContent.match(/remember this[:\-,]?\s*([\s\S]*)/i);
      const noteText = (match?.[1] ?? userContent.replace(/remember this/i, "")).trim();
      if (noteText) saveNote(noteText);
      const reply = noteText
        ? `Got it. I've saved that to memory:\n\n"${noteText}"`
        : "I've noted that down.";
      await sendDirectReply(reply, isFirstMessage);
      return;
    }

    // ── "What do you remember / my notes" ─────────────────────────
    if (
      lowerContent.includes("what do you remember") ||
      lowerContent.includes("what have you remembered") ||
      lowerContent.includes("my notes") ||
      lowerContent.includes("show my notes") ||
      lowerContent.includes("show notes")
    ) {
      const notes = readNotes();
      const reply =
        notes.length === 0
          ? "I don't have anything saved in memory yet. You can say \"remember this: [something]\" and I'll keep it."
          : `Here's what I remember:\n\n${notes.map((n, i) => `${i + 1}. ${n.text}`).join("\n")}`;
      await sendDirectReply(reply, isFirstMessage);
      return;
    }

    // ── Normal message → inject notes into system prompt ──────────
    const chatMessages = history.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    const notes = readNotes();
    const notesContext =
      notes.length > 0
        ? `\n\nYou have the following notes saved about this user:\n${notes.map((n) => `- ${n.text}`).join("\n")}`
        : "";

    chatMessages.unshift({
      role: "system",
      content:
        "You are Jarvis, a highly capable, witty, and intelligent AI assistant. You are helpful, precise, and occasionally charming. You speak with confidence and clarity. Keep responses concise unless the user asks for detail." +
        notesContext,
    });

    let fullResponse = "";

    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    await db.insert(messages).values({
      conversationId: params.data.id,
      role: "assistant",
      content: fullResponse,
    });

    if (isFirstMessage) {
      const raw = userContent.trim();
      const firstSentence = raw.split(/[.!?\n]/)[0].trim();
      const source = firstSentence.length >= 8 ? firstSentence : raw;
      const autoTitle =
        source.length <= 42
          ? source
          : source.slice(0, 42).replace(/\s+\S*$/, "") + "…";
      await pool.query(
        "UPDATE conversations SET title = $1 WHERE id = $2",
        [autoTitle, params.data.id]
      );
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  }
);

export default router;
