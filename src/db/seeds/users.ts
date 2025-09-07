import { db } from '@/db';
import { users } from '@/db/schema';

async function main() {
    const sampleUsers = [
        {
            telegramId: '123456789',
            firstName: 'Alex',
            lastName: 'Rodriguez',
            username: 'alex_dev',
            languageCode: 'en',
            timezone: 'America/New_York',
            subscriptionPlan: 'premium',
            subscriptionStatus: 'active',
            onboardingCompleted: true,
            createdAt: new Date('2024-12-01T08:30:00Z').toISOString(),
            updatedAt: new Date('2024-12-15T14:22:00Z').toISOString(),
        },
        {
            telegramId: '987654321',
            firstName: 'Sarah',
            lastName: null,
            username: 'sarah92',
            languageCode: 'es',
            timezone: 'Europe/Madrid',
            subscriptionPlan: 'free',
            subscriptionStatus: 'inactive',
            onboardingCompleted: false,
            createdAt: new Date('2024-12-05T15:45:00Z').toISOString(),
            updatedAt: new Date('2024-12-05T15:45:00Z').toISOString(),
        },
        {
            telegramId: '456789123',
            firstName: 'Mike',
            lastName: 'Johnson',
            username: null,
            languageCode: 'en',
            timezone: 'UTC',
            subscriptionPlan: 'pro',
            subscriptionStatus: 'trial',
            onboardingCompleted: true,
            createdAt: new Date('2024-12-10T09:15:00Z').toISOString(),
            updatedAt: new Date('2024-12-20T11:30:00Z').toISOString(),
        },
        {
            telegramId: '789123456',
            firstName: 'Emma',
            lastName: 'Chen',
            username: 'emma_productivity',
            languageCode: 'fr',
            timezone: 'Europe/London',
            subscriptionPlan: 'premium',
            subscriptionStatus: 'active',
            onboardingCompleted: true,
            createdAt: new Date('2024-12-08T12:00:00Z').toISOString(),
            updatedAt: new Date('2024-12-18T16:45:00Z').toISOString(),
        },
        {
            telegramId: '321654987',
            firstName: 'David',
            lastName: null,
            username: null,
            languageCode: 'de',
            timezone: 'Asia/Tokyo',
            subscriptionPlan: 'free',
            subscriptionStatus: 'inactive',
            onboardingCompleted: false,
            createdAt: new Date('2024-12-12T20:30:00Z').toISOString(),
            updatedAt: new Date('2024-12-12T20:30:00Z').toISOString(),
        }
    ];

    await db.insert(users).values(sampleUsers);
    
    console.log('✅ Users seeder completed successfully');
}

main().catch((error) => {
    console.error('❌ Seeder failed:', error);
});