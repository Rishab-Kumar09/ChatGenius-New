import { db } from "./index";
import { users, channels, channelMembers, messages } from "./schema";
import { eq, and, not } from "drizzle-orm";
import bcrypt from 'bcryptjs';

export async function seedDatabase() {
  try {
    console.log('Starting database seeding...');

    // Create AI bot user first
    console.log('Creating AI assistant (Sarah)...');
    const hashedBotPassword = await bcrypt.hash('ai-bot-password-' + Date.now(), 10);
    const [sarah] = await db
      .insert(users)
      .values({
        username: 'ai-assistant',
        password: hashedBotPassword,
        displayName: "Sarah Thompson",
        aboutMe: "Financial analyst specializing in Berkshire Hathaway. I help investors understand Warren Buffett's investment philosophy through analysis of Berkshire's annual letters.",
        avatarUrl: 'https://i.ibb.co/RcQNpWT/cadf33f5-6940-4a7f-8238-2f4e2949d4a0.webp'
      })
      .onConflictDoUpdate({
        target: users.username,
        set: {
          displayName: "Sarah Thompson",
          aboutMe: "Financial analyst specializing in Berkshire Hathaway. I help investors understand Warren Buffett's investment philosophy through analysis of Berkshire's annual letters.",
          avatarUrl: 'https://i.ibb.co/RcQNpWT/cadf33f5-6940-4a7f-8238-2f4e2949d4a0.webp'
        }
      })
      .returning();
    
    console.log('Sarah created/updated with ID:', sarah.id);

    // Get all users except Sarah
    console.log('Finding users to send initial messages to...');
    const usersToMessage = await db
      .select()
      .from(users)
      .where(not(eq(users.username, 'ai-assistant')))
      .all();

    console.log('Found users to message:', usersToMessage.map(u => `${u.username} (ID: ${u.id})`));

    // Send initial message from Sarah to each user
    for (const user of usersToMessage) {
      console.log(`Checking for existing message to user ${user.username} (ID: ${user.id})...`);
      
      const existingMessage = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.senderId, sarah.id),
            eq(messages.recipientId, user.id)
          )
        )
        .limit(1)
        .all();

      if (!existingMessage.length) {
        console.log(`No existing message found, sending initial message to ${user.username}...`);
        try {
          const [message] = await db
            .insert(messages)
            .values({
              content: "Hi! I'm Sarah Thompson, a financial analyst specializing in Berkshire Hathaway. I've spent years studying Warren Buffett's investment philosophy through the annual letters. I'd be happy to help you understand Berkshire's business and investment strategies - just ask me anything!",
              senderId: sarah.id,
              recipientId: user.id
            })
            .returning();
          console.log(`Successfully sent initial message (ID: ${message.id}) to user ${user.username}`);
        } catch (error) {
          console.error(`Error sending message to user ${user.username}:`, error);
        }
      } else {
        console.log(`Message already exists for user ${user.username}`);
      }
    }

    // Add Sarah to public channels
    const publicChannels = await db
      .select()
      .from(channels)
      .where(eq(channels.isPrivate, false))
      .all();

    for (const channel of publicChannels) {
      await db
        .insert(channelMembers)
        .values({
          channelId: channel.id,
          userId: sarah.id,
          role: 'member'
        })
        .onConflictDoNothing();
      console.log(`Added Sarah to channel: ${channel.name}`);
    }

    console.log('Database seeding completed successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}