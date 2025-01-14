import OpenAI from "openai";
import { messages } from "@db/schema";
import { db } from "@db";
import { desc, eq } from "drizzle-orm";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is not set");
}

import { loadDocuments, queryRAG } from './rag';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Initialize RAG with documents
const docsDirectory = './training_data'; // Create this directory and add your documents
loadDocuments(docsDirectory)
  .then(() => console.log('Documents loaded into RAG system'))
  .catch(console.error);

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
      .join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant providing message suggestions in a chat application. Generate 3 short, natural, and contextually relevant message suggestions. Keep each suggestion under 50 characters. Format as a JSON array of strings."
        },
        {
          role: "user",
          content: `Recent chat context:\n${context}\n\nCurrent user input: "${currentInput || ''}"\n\nProvide 3 message suggestions that would be appropriate follow-ups or completions.`
        }
      ],
      temperature: 0.7,
      max_tokens: 150,
      response_format: { type: "json_object" }
    });

    const suggestions = JSON.parse(response.choices[0].message.content);
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
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant generating quick reply options for a chat message. Generate 3 short, contextually appropriate responses. Keep each response under 50 characters. Format as a JSON array of strings."
        },
        {
          role: "user",
          content: `Message to respond to: "${messageContent}"\n\nProvide 3 appropriate quick replies.`
        }
      ],
      temperature: 0.7,
      max_tokens: 150,
      response_format: { type: "json_object" }
    });

    const replies = JSON.parse(response.choices[0].message.content);
    return replies.suggestions || [];
  } catch (error) {
    console.error('Error generating quick replies:', error);
    return [];
  }
}
