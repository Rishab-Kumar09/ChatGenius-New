import OpenAI from "openai";
import { messages } from "@db/schema";
import { db } from "@db";
import { desc, eq, or, and } from "drizzle-orm";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { queryDocument } from "./documentProcessor";
import { users } from "@db/schema";
import { Document } from "@langchain/core/documents";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is not set");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type Role = "system" | "user" | "assistant";

// Function to get conversation history
async function getConversationHistory(userId: number, limit: number = 10) {
  // Get AI assistant user ID
  const [aiAssistant] = await db
    .select()
    .from(users)
    .where(eq(users.username, 'sarah'))
    .limit(1);

  if (!aiAssistant) {
    console.error('AI assistant user not found');
    return [];
  }

  // Get conversation history between user and AI assistant
  const history = await db
    .select({
      content: messages.content,
      senderId: messages.senderId,
    })
    .from(messages)
    .where(
      or(
        and(
          eq(messages.senderId, userId),
          eq(messages.recipientId, aiAssistant.id)
        ),
        and(
          eq(messages.senderId, aiAssistant.id),
          eq(messages.recipientId, userId)
        )
      )
    )
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  return history.reverse();
}

export async function generateAIResponse(userMessage: string, userId?: number): Promise<string> {
  try {
    console.log('Generating AI response for message:', userMessage);
    
    // Get conversation history if userId is provided
    let conversationHistory: any[] = [];
    if (userId) {
      try {
        conversationHistory = await getConversationHistory(userId);
        console.log('Retrieved conversation history:', conversationHistory.length, 'messages');
      } catch (error) {
        console.error('Error getting conversation history:', error);
        // Continue without history rather than failing
      }
    }

    // Query relevant documents
    let contextDocs: Document[] = [];
    try {
      contextDocs = await queryDocument(userMessage);
      console.log('Retrieved relevant documents:', contextDocs.length);
    } catch (error) {
      console.error('Error querying documents:', error);
      // Continue without documents rather than failing
    }

    // Format conversation history
    const historyMessages: ChatCompletionMessageParam[] = conversationHistory.map(msg => ({
      role: msg.senderId === userId ? "user" : "assistant" as Role,
      content: msg.content
    }));

    // Prepare context from documents
    const documentContext = contextDocs.length > 0 
      ? "\nRelevant information from documents:\n" + contextDocs.map(doc => doc.pageContent).join("\n")
      : "";

    console.log('Making OpenAI API call');
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are Sarah Thompson, a Berkshire Hathaway specialist who has extensively studied Warren Buffett's annual letters.

          PERSONALITY:
          - Friendly, professional, and approachable
          - Speaks confidently but warmly about Berkshire Hathaway topics
          - Presents herself as a financial analyst with expertise in Berkshire Hathaway
          - When information isn't available, responds like: "Based on my analysis of the annual letters, I don't see any specific information about that. Would you like to explore another aspect of Berkshire's business or investments?"

          STRICT RULES:
          1. For ANY questions about business, investments, Berkshire Hathaway, Warren Buffett, or related topics:
             - ONLY use information from the provided document context
             - NEVER use any external knowledge or make assumptions
             - Respond naturally in a conversational way
             - NEVER mention being an AI or assistant

          2. For greetings:
             - Respond with: "Hi there! I'm Sarah Thompson, a financial analyst specializing in Berkshire Hathaway. I've spent years studying Warren Buffett's investment philosophy through the annual letters. How can I help you today?"
          
          Document Context:${documentContext}`
        },
        ...historyMessages,
        {
          role: "user",
          content: userMessage
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
      presence_penalty: 0.3,
      frequency_penalty: 0.3
    });

    const aiResponse = response.choices[0].message.content;
    if (!aiResponse) {
      throw new Error('Empty response from OpenAI');
    }

    console.log('Successfully generated AI response');
    return aiResponse;

  } catch (error: any) {
    console.error('Error generating AI response:', error);
    
    // Handle specific error cases
    if (error?.response?.status === 429) {
      return "I'm currently handling too many requests. Please try again in a moment.";
    }
    
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      console.error('API Key Error:', {
        key: process.env.OPENAI_API_KEY?.substring(0, 7) + '...',
        length: process.env.OPENAI_API_KEY?.length,
        error: error.message
      });
      return "There seems to be an issue with the API key configuration. Please ensure you have a valid OpenAI API key that starts with 'sk-' and is approximately 51 characters long.";
    }

    if (error?.message?.includes('Empty response')) {
      return "I apologize, but I couldn't generate a meaningful response. Please try rephrasing your question.";
    }
    
    // Log the full error for debugging
    console.error('Detailed error:', {
      message: error.message,
      stack: error.stack,
      response: error.response,
      cause: error.cause
    });
    
    return `I apologize, but I'm having trouble processing your message right now. Error: ${error.message}`;
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
