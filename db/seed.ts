import { db } from "./index";
import { users, channels, channelMembers } from "./schema";
import { eq, and } from "drizzle-orm";
import bcrypt from 'bcryptjs';

export async function seedDatabase() {
  try {
    console.log('Starting database seeding...');

    // Create system user if it doesn't exist
    const existingSystem = await db
      .select()
      .from(users)
      .where(eq(users.username, 'system'))
      .limit(1)
      .all();

    if (!existingSystem.length) {
      console.log('System user not found, creating...');
      const hashedPassword = await bcrypt.hash('system-' + Date.now(), 10);
      await db
        .insert(users)
        .values({
          username: 'system',
          password: hashedPassword,
          displayName: 'System',
          aboutMe: 'System user for managing system operations.',
          avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=system'
        });
      console.log('Created system user');
    } else {
      console.log('System user already exists');
    }

    // Create AI bot user if it doesn't exist
    const existingBot = await db
      .select()
      .from(users)
      .where(eq(users.username, 'ai-assistant'))
      .limit(1)
      .all();

    if (!existingBot.length) {
      console.log('AI bot not found, creating...');
      const hashedPassword = await bcrypt.hash('ai-bot-password-' + Date.now(), 10);
      await db
        .insert(users)
        .values({
          username: 'ai-assistant',
          password: hashedPassword,
          displayName: "Warren's AI Assistant",
          aboutMe: "I'm an AI assistant with knowledge from Berkshire Hathaway's annual letters. I can help you understand Warren Buffett's investment philosophy and Berkshire's history.",
          avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=ai-assistant'
        });
      console.log('Created AI bot user');
    }

    // Get AI assistant user ID
    const [aiAssistant] = await db
      .select()
      .from(users)
      .where(eq(users.username, 'ai-assistant'))
      .limit(1)
      .all();

    if (!aiAssistant) {
      throw new Error('AI assistant not found after creation');
    }

    // Add AI assistant to all public channels
    const publicChannels = await db
      .select()
      .from(channels)
      .where(eq(channels.isPrivate, false))
      .all();

    for (const channel of publicChannels) {
      // Check if AI is already a member
      const [membership] = await db
        .select()
        .from(channelMembers)
        .where(
          and(
            eq(channelMembers.channelId, channel.id),
            eq(channelMembers.userId, aiAssistant.id)
          )
        )
        .limit(1)
        .all();

      if (!membership) {
        await db
          .insert(channelMembers)
          .values({
            channelId: channel.id,
            userId: aiAssistant.id,
            role: 'member'
          });
        console.log(`Added AI assistant to channel: ${channel.name}`);
      }
    }

    console.log('Database seeding completed successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}