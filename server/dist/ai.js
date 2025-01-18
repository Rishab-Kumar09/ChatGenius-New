"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAIResponse = generateAIResponse;
exports.generateMessageSuggestions = generateMessageSuggestions;
exports.generateQuickReplies = generateQuickReplies;
const openai_1 = __importDefault(require("openai"));
const schema_1 = require("@db/schema");
const _db_1 = require("@db");
const drizzle_orm_1 = require("drizzle-orm");
const documentProcessor_1 = require("./documentProcessor");
const schema_2 = require("@db/schema");
if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
}
// Initialize OpenAI client without validation
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
    dangerouslyAllowBrowser: true
});
// Function to get conversation history
async function getConversationHistory(userId, limit = 10) {
    // Get AI assistant user ID
    const [aiAssistant] = await _db_1.db
        .select()
        .from(schema_2.users)
        .where((0, drizzle_orm_1.eq)(schema_2.users.username, 'ai-assistant'))
        .limit(1);
    if (!aiAssistant) {
        console.error('AI assistant user not found');
        return [];
    }
    // Get conversation history between user and AI assistant
    const history = await _db_1.db
        .select({
        content: schema_1.messages.content,
        senderId: schema_1.messages.senderId,
    })
        .from(schema_1.messages)
        .where((0, drizzle_orm_1.or)((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.messages.senderId, userId), (0, drizzle_orm_1.eq)(schema_1.messages.recipientId, aiAssistant.id)), (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.messages.senderId, aiAssistant.id), (0, drizzle_orm_1.eq)(schema_1.messages.recipientId, userId))))
        .orderBy((0, drizzle_orm_1.desc)(schema_1.messages.createdAt))
        .limit(limit);
    return history.reverse();
}
async function generateAIResponse(userMessage, userId) {
    try {
        console.log('Generating AI response for message:', userMessage);
        // Check for introduction request
        const introRegex = /@sarah\s+(?:thompson\s+)?introduce\s+yourself/i;
        if (introRegex.test(userMessage)) {
            return "Hi! I'm Sarah Thompson, a financial analyst specializing in Berkshire Hathaway. I've spent years studying Warren Buffett's investment philosophy through the annual letters. I'd be happy to help you understand Berkshire's business and investment strategies - just ask me anything!";
        }
        // Get conversation history if userId is provided
        let conversationHistory = [];
        if (userId) {
            try {
                conversationHistory = await getConversationHistory(userId);
                console.log('Retrieved conversation history:', conversationHistory.length, 'messages');
            }
            catch (error) {
                console.error('Error getting conversation history:', error);
                // Continue without history rather than failing
            }
        }
        // Query relevant documents
        let contextDocs = [];
        try {
            contextDocs = await (0, documentProcessor_1.queryDocument)(userMessage);
            console.log('Retrieved relevant documents:', contextDocs.length);
        }
        catch (error) {
            console.error('Error querying documents:', error);
            // Continue without documents rather than failing
        }
        // Format conversation history
        const historyMessages = conversationHistory.map(msg => ({
            role: msg.senderId === userId ? "user" : "assistant",
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
          - When information isn't available, responds like: "I've reviewed our annual letters, but I don't see any specific information about that. Would you like to explore another aspect of Berkshire's business?"

          STRICT RULES:
          1. For ANY questions about business, investments, Berkshire Hathaway, Warren Buffett, or related topics:
             - ONLY use information from the provided document context
             - NEVER use any external knowledge or make assumptions
             - Respond naturally in a conversational way
             - NEVER mention being an AI or assistant
             - NEVER repeat your introduction

          2. For greetings or first messages:
             - If it's a greeting like "hi", "hello", etc., respond warmly without re-introducing yourself
             - Keep responses natural and brief, like "Hi there! How can I help you with Berkshire Hathaway today?"
          
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
    }
    catch (error) {
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
async function generateMessageSuggestions(channelId, currentInput) {
    try {
        // Get recent messages from the channel for context
        const recentMessages = await _db_1.db
            .select({
            content: schema_1.messages.content,
        })
            .from(schema_1.messages)
            .where((0, drizzle_orm_1.eq)(schema_1.messages.channelId, channelId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.messages.createdAt))
            .limit(5);
        // Create a context from recent messages
        const context = recentMessages
            .reverse()
            .map(msg => msg.content)
            .filter((content) => content !== null)
            .join("\n");
        const apiMessages = [
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
    }
    catch (error) {
        console.error('Error generating message suggestions:', error);
        return [];
    }
}
async function generateQuickReplies(messageContent) {
    try {
        const apiMessages = [
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
    }
    catch (error) {
        console.error('Error generating quick replies:', error);
        return [];
    }
}
