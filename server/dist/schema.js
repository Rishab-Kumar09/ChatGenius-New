"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reactions = exports.messages = exports.channelInvitations = exports.channels = exports.users = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
const drizzle_orm_1 = require("drizzle-orm");
// Define users and channels tables first
exports.users = (0, sqlite_core_1.sqliteTable)('users', {
    id: (0, sqlite_core_1.integer)('id').primaryKey({ autoIncrement: true }),
    username: (0, sqlite_core_1.text)('username').notNull().unique(),
    password: (0, sqlite_core_1.text)('password').notNull(),
    displayName: (0, sqlite_core_1.text)('display_name'),
    email: (0, sqlite_core_1.text)('email'),
    avatarUrl: (0, sqlite_core_1.text)('avatar_url'),
    aboutMe: (0, sqlite_core_1.text)('about_me'),
    note: (0, sqlite_core_1.text)('note'),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
    updatedAt: (0, sqlite_core_1.text)('updated_at').notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
});
exports.channels = (0, sqlite_core_1.sqliteTable)('channels', {
    id: (0, sqlite_core_1.integer)('id').primaryKey({ autoIncrement: true }),
    name: (0, sqlite_core_1.text)('name').notNull().unique(),
    description: (0, sqlite_core_1.text)('description'),
    isPrivate: (0, sqlite_core_1.integer)('is_private', { mode: 'boolean' }).notNull().default(false),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
    updatedAt: (0, sqlite_core_1.text)('updated_at').notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
});
exports.channelInvitations = (0, sqlite_core_1.sqliteTable)('channel_invitations', {
    id: (0, sqlite_core_1.integer)('id').primaryKey({ autoIncrement: true }),
    channelId: (0, sqlite_core_1.integer)('channel_id').notNull().references(() => exports.channels.id, { onDelete: 'cascade' }),
    inviterId: (0, sqlite_core_1.integer)('inviter_id').notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    inviteeId: (0, sqlite_core_1.integer)('invitee_id').notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    status: (0, sqlite_core_1.text)('status', { enum: ['pending', 'accepted', 'rejected'] }).notNull().default('pending'),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
    updatedAt: (0, sqlite_core_1.text)('updated_at').notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
});
// Messages table with parent-child hierarchy support
exports.messages = (0, sqlite_core_1.sqliteTable)("messages", {
    id: (0, sqlite_core_1.integer)("id").primaryKey({ autoIncrement: true }),
    content: (0, sqlite_core_1.text)("content").notNull(),
    senderId: (0, sqlite_core_1.integer)("sender_id").references(() => exports.users.id, { onDelete: "cascade" }).notNull(),
    channelId: (0, sqlite_core_1.integer)("channel_id").references(() => exports.channels.id, { onDelete: "cascade" }),
    recipientId: (0, sqlite_core_1.integer)("recipient_id").references(() => exports.users.id, { onDelete: "cascade" }),
    parentId: (0, sqlite_core_1.integer)("parent_id"),
    replyCount: (0, sqlite_core_1.integer)("reply_count").default(0).notNull(),
    fileName: (0, sqlite_core_1.text)("file_name"),
    fileUrl: (0, sqlite_core_1.text)("file_url"),
    fileSize: (0, sqlite_core_1.integer)("file_size"),
    fileType: (0, sqlite_core_1.text)("file_type"),
    createdAt: (0, sqlite_core_1.text)("created_at").default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`).notNull(),
    updatedAt: (0, sqlite_core_1.text)("updated_at").default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`).notNull(),
    isEdited: (0, sqlite_core_1.integer)("is_edited", { mode: "boolean" }).default(false).notNull(),
    deliveryStatus: (0, sqlite_core_1.text)("delivery_status").default("sent").notNull(),
});
exports.reactions = (0, sqlite_core_1.sqliteTable)('reactions', {
    id: (0, sqlite_core_1.integer)('id').primaryKey({ autoIncrement: true }),
    messageId: (0, sqlite_core_1.integer)('message_id').notNull().references(() => exports.messages.id, { onDelete: 'cascade' }),
    userId: (0, sqlite_core_1.integer)('user_id').notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    emoji: (0, sqlite_core_1.text)('emoji').notNull(),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull().default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`),
});
