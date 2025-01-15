import OpenAI from "openai";
import { messages } from "@db/schema";
import { db } from "@db";
import { desc, eq } from "drizzle-orm";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { queryDocument } from "./documentProcessor";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is not set");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type Role = "system" | "user" | "assistant";

// Function to get conversation history
async function getConversationHistory(userId: number, limit: number = 10) {
  const history = await db
    .select({
      content: messages.content,
      senderId: messages.senderId,
    })
    .from(messages)
    .where(
      eq(messages.recipientId, userId)
    )
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  return history.reverse();
}

export async function generateAIResponse(userMessage: string, userId?: number): Promise<string> {
  try {
    // Use queryDocument to get relevant documents
    const documents = await queryDocument(userMessage);
    
    if (!documents || documents.length === 0) {
      return "I couldn't find any relevant information in the uploaded documents.";
    }

    // Create a context from the relevant documents
    const context = documents.map(doc => doc.pageContent).join('\n\n');

    // Generate a response using the context
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that answers questions based on the provided documents. Use only the information from the documents to answer questions."
        },
        {
          role: "user",
          content: `Context from documents:\n${context}\n\nQuestion: ${userMessage}\n\nAnswer:`
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    return response.choices[0].message.content || "I apologize, but I couldn't generate a response based on the documents.";
  } catch (error) {
    console.error('Error generating AI response:', error);
    return "I apologize, but I'm having trouble processing your message right now.";
  }
}

export async function generateMessageSuggestions(
  channelId: number,
  currentInput: string
): Promise<string[]> {
  try {
    // Get recent messages from the channel for context
    const recentMessages = await db
      .select({
        content: messages.content,
      })
      .from(messages)
      .where(eq(messages.channelId, channelId))
      .orderBy(desc(messages.createdAt))
      .limit(5);

    // Create a context from recent messages
    const context = recentMessages
      .reverse()
      .map(msg => msg.content)
      .filter((content): content is string => content !== null)
      .join("\n");

    const apiMessages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: "You are a helpful assistant providing message suggestions in a chat application. Generate 3 short, natural, and contextually relevant message suggestions. Keep each suggestion under 50 characters. Format as a JSON array of strings."
      },
      {
        role: "user",
        content: `Recent chat context:\n${context}\n\nCurrent user input: "${currentInput || ''}"\n\nProvide 3 message suggestions that would be appropriate follow-ups or completions.`
      }
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: apiMessages,
      temperature: 0.7,
      max_tokens: 150,
      response_format: { type: "json_object" }
    });

    const suggestions = JSON.parse(response.choices[0].message.content || "{}");
    return suggestions.suggestions || [];
  } catch (error) {
    console.error('Error generating message suggestions:', error);
    return [];
  }
}

export async function generateQuickReplies(
  messageContent: string
): Promise<string[]> {
  try {
    const apiMessages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: "You are a helpful assistant generating quick reply options for a chat message. Generate 3 short, contextually appropriate responses. Keep each response under 50 characters. Format as a JSON array of strings."
      },
      {
        role: "user",
        content: `Message to respond to: "${messageContent}"\n\nProvide 3 appropriate quick replies.`
      }
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: apiMessages,
      temperature: 0.7,
      max_tokens: 150,
      response_format: { type: "json_object" }
    });

    const replies = JSON.parse(response.choices[0].message.content || "{}");
    return replies.suggestions || [];
  } catch (error) {
    console.error('Error generating quick replies:', error);
    return [];
  }
}
