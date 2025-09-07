import { db } from '@/db';
import { categories } from '@/db/schema';

async function main() {
    const sampleCategories = [
        // User 1: "123456789" - Task and Transaction categories
        {
            telegramId: "123456789",
            name: "work",
            type: "task",
            color: "#FF5733",
            createdAt: new Date('2024-01-15').toISOString(),
        },
        {
            telegramId: "123456789",
            name: "personal",
            type: "task",
            color: "#33C4FF",
            createdAt: new Date('2024-01-16').toISOString(),
        },
        {
            telegramId: "123456789",
            name: "food",
            type: "transaction",
            color: "#7FFF33",
            createdAt: new Date('2024-01-17').toISOString(),
        },
        {
            telegramId: "123456789",
            name: "transport",
            type: "transaction",
            color: "#FF33F1",
            createdAt: new Date('2024-01-18').toISOString(),
        },
        
        // User 2: "987654321" - All three types
        {
            telegramId: "987654321",
            name: "health",
            type: "task",
            color: "#FFC333",
            createdAt: new Date('2024-01-19').toISOString(),
        },
        {
            telegramId: "987654321",
            name: "utilities",
            type: "transaction",
            color: "#FF5733",
            createdAt: new Date('2024-01-20').toISOString(),
        },
        {
            telegramId: "987654321",
            name: "cardio",
            type: "workout",
            color: "#33C4FF",
            createdAt: new Date('2024-01-21').toISOString(),
        },
        {
            telegramId: "987654321",
            name: "strength",
            type: "workout",
            color: "#7FFF33",
            createdAt: new Date('2024-01-22').toISOString(),
        },
        
        // User 3: "456789123" - Task and Workout categories
        {
            telegramId: "456789123",
            name: "finance",
            type: "task",
            color: "#FF33F1",
            createdAt: new Date('2024-01-23').toISOString(),
        },
        {
            telegramId: "456789123",
            name: "urgent",
            type: "task",
            color: "#FFC333",
            createdAt: new Date('2024-01-24').toISOString(),
        },
        {
            telegramId: "456789123",
            name: "flexibility",
            type: "workout",
            color: "#FF5733",
            createdAt: new Date('2024-01-25').toISOString(),
        },
        {
            telegramId: "456789123",
            name: "sports",
            type: "workout",
            color: "#33C4FF",
            createdAt: new Date('2024-01-26').toISOString(),
        },
        
        // User 4: "789123456" - All three types
        {
            telegramId: "789123456",
            name: "shopping",
            type: "task",
            color: "#7FFF33",
            createdAt: new Date('2024-01-27').toISOString(),
        },
        {
            telegramId: "789123456",
            name: "entertainment",
            type: "transaction",
            color: "#FF33F1",
            createdAt: new Date('2024-01-28').toISOString(),
        },
        {
            telegramId: "789123456",
            name: "income",
            type: "transaction",
            color: "#FFC333",
            createdAt: new Date('2024-01-29').toISOString(),
        },
        {
            telegramId: "789123456",
            name: "cardio",
            type: "workout",
            color: "#FF5733",
            createdAt: new Date('2024-01-30').toISOString(),
        },
        
        // User 5: "321654987" - Transaction and Workout categories
        {
            telegramId: "321654987",
            name: "savings",
            type: "transaction",
            color: "#33C4FF",
            createdAt: new Date('2024-02-01').toISOString(),
        },
        {
            telegramId: "321654987",
            name: "food",
            type: "transaction",
            color: "#7FFF33",
            createdAt: new Date('2024-02-02').toISOString(),
        },
        {
            telegramId: "321654987",
            name: "strength",
            type: "workout",
            color: "#FF33F1",
            createdAt: new Date('2024-02-03').toISOString(),
        },
        {
            telegramId: "321654987",
            name: "sports",
            type: "workout",
            color: "#FFC333",
            createdAt: new Date('2024-02-04').toISOString(),
        }
    ];

    await db.insert(categories).values(sampleCategories);
    
    console.log('✅ Categories seeder completed successfully');
}

main().catch((error) => {
    console.error('❌ Seeder failed:', error);
});