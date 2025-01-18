import { createClient } from '@supabase/supabase-js';
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase environment variables');
}
export const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: {
        persistSession: false
    }
});
// Helper function to initialize the database schema
export async function initializeSupabase() {
    // Create tables if they don't exist
    const { error: usersError } = await supabase.rpc('create_users_table');
    if (usersError && !usersError.message.includes('already exists')) {
        console.error('Error creating users table:', usersError);
    }
    const { error: channelsError } = await supabase.rpc('create_channels_table');
    if (channelsError && !channelsError.message.includes('already exists')) {
        console.error('Error creating channels table:', channelsError);
    }
    const { error: messagesError } = await supabase.rpc('create_messages_table');
    if (messagesError && !messagesError.message.includes('already exists')) {
        console.error('Error creating messages table:', messagesError);
    }
}
