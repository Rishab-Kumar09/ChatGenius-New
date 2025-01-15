import { db } from "./index";
import { channels, channelMembers, users } from "./schema";
import { eq } from "drizzle-orm";
import bcrypt from 'bcryptjs';

export async function seedDatabase() {
  try {
    console.log('Starting database seeding...');

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
          displayName: 'AI Assistant',
          aboutMe: 'I am an AI assistant that helps users in the chat.',
          avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=ai-assistant'
        });
      console.log('Created AI bot user');
    } else {
      console.log('AI bot already exists');
    }

    // Create default channels
    const defaultChannels = [
      {
        name: "general",
        description: "General discussion channel",
        isPrivate: false,
      },
      {
        name: "random",
        description: "Random discussions and fun stuff",
        isPrivate: false,
      },
      {
        name: "announcements",
        description: "Important announcements",
        isPrivate: false,
      }
    ];

    // Insert or update channels
    for (const channel of defaultChannels) {
      try {
        // Check if channel exists
        const existingChannel = await db
          .select()
          .from(channels)
          .where(eq(channels.name, channel.name))
          .limit(1)
          .all();

        if (!existingChannel.length) {
          // Create the channel
          const [newChannel] = await db
            .insert(channels)
            .values({
              name: channel.name,
              description: channel.description,
              isPrivate: channel.isPrivate,
            })
            .returning();

          // Add system user as owner of default channels
          await db
            .insert(channelMembers)
            .values({
              channelId: newChannel.id,
              userId: 1, // System user ID
              role: 'owner'
            });

          console.log(`Created channel: ${channel.name}`);
        } else {
          console.log(`Channel ${channel.name} already exists, skipping...`);
        }
      } catch (error) {
        console.error(`Error creating channel ${channel.name}:`, error);
        // Continue with other channels even if one fails
      }
    }

    console.log('Database seeding completed successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}