import OpenAI from "openai";
import { messages } from "@db/schema";
import { db } from "@db";
import { desc, eq } from "drizzle-orm";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

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
    // Get conversation history if userId is provided
    const history = userId ? await getConversationHistory(userId) : [];
    
    const apiMessages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `You are a helpful AI assistant in a chat application. You should be friendly, 
        concise, and helpful. You have access to the conversation history for context. 
        Your responses should be natural and engaging, while maintaining a helpful and professional tone.
        You should avoid being overly formal or robotic.`
      },
      ...history.map(msg => ({
        role: (msg.senderId === userId ? "user" : "assistant") as Role,
        content: msg.content || ""
      })),
      {
        role: "user",
        content: userMessage
      }
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: apiMessages,
      temperature: 0.7,
      max_tokens: 150,
    });

    return response.choices[0].message.content || "I'm not sure how to respond to that.";
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
