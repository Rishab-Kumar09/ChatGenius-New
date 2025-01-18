import { seedDatabase } from './seed';
export async function initializeDatabase() {
    try {
        await seedDatabase();
        console.log('Database initialization completed');
    }
    catch (error) {
        console.error('Failed to initialize database:', error);
        throw error;
    }
}
