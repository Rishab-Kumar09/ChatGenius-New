"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
exports.initializeSupabase = initializeSupabase;
const supabase_js_1 = require("@supabase/supabase-js");
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase environment variables');
}
exports.supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: {
        persistSession: false
    }
});
// Helper function to initialize the database schema
async function initializeSupabase() {
    // Create tables if they don't exist
    const { error: usersError } = await exports.supabase.rpc('create_users_table');
    if (usersError && !usersError.message.includes('already exists')) {
        console.error('Error creating users table:', usersError);
    }
    const { error: channelsError } = await exports.supabase.rpc('create_channels_table');
    if (channelsError && !channelsError.message.includes('already exists')) {
        console.error('Error creating channels table:', channelsError);
    }
    const { error: messagesError } = await exports.supabase.rpc('create_messages_table');
    if (messagesError && !messagesError.message.includes('already exists')) {
        console.error('Error creating messages table:', messagesError);
    }
}
