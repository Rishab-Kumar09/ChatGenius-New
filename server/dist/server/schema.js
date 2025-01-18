import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
// Define users and channels tables first
export const users = sqliteTable('users', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    username: text('username').notNull().unique(),
    password: text('password').notNull(),
    displayName: text('display_name'),
    email: text('email'),
    avatarUrl: text('avatar_url'),
    aboutMe: text('about_me'),
    note: text('note'),
    createdAt: text('created_at').notNull().default(sql `CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql `CURRENT_TIMESTAMP`),
});
export const channels = sqliteTable('channels', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull().unique(),
    description: text('description'),
    isPrivate: integer('is_private', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull().default(sql `CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql `CURRENT_TIMESTAMP`),
});
export const channelInvitations = sqliteTable('channel_invitations', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    channelId: integer('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
    inviterId: integer('inviter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    inviteeId: integer('invitee_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['pending', 'accepted', 'rejected'] }).notNull().default('pending'),
    createdAt: text('created_at').notNull().default(sql `CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql `CURRENT_TIMESTAMP`),
});
// Messages table with parent-child hierarchy support
export const messages = sqliteTable("messages", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    content: text("content").notNull(),
    senderId: integer("sender_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    channelId: integer("channel_id").references(() => channels.id, { onDelete: "cascade" }),
    recipientId: integer("recipient_id").references(() => users.id, { onDelete: "cascade" }),
    parentId: integer("parent_id"),
    replyCount: integer("reply_count").default(0).notNull(),
    fileName: text("file_name"),
    fileUrl: text("file_url"),
    fileSize: integer("file_size"),
    fileType: text("file_type"),
    createdAt: text("created_at").default(sql `CURRENT_TIMESTAMP`).notNull(),
    updatedAt: text("updated_at").default(sql `CURRENT_TIMESTAMP`).notNull(),
    isEdited: integer("is_edited", { mode: "boolean" }).default(false).notNull(),
    deliveryStatus: text("delivery_status").default("sent").notNull(),
});
export const reactions = sqliteTable('reactions', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    messageId: integer('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    emoji: text('emoji').notNull(),
    createdAt: text('created_at').notNull().default(sql `CURRENT_TIMESTAMP`),
});
