This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Supabase setup

This project persists data in Supabase for Tasks, Finance, and Workout.

1) Env variables

Copy `.env.example` to `.env.local` and fill:

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

2) Database schema

Open the Supabase SQL editor and run `supabase/schema.sql` to create tables, enable RLS, and add CRUD policies per user. Then go to Database → Replication and enable `postgres_changes` (Realtime) for the created tables in `public`.

Tables used:
- tasks
- finance_accounts, finance_categories, finance_transactions
- workout_programs, workout_sessions

3) Realtime

Ensure Realtime is enabled for the above tables so UI auto-updates on inserts/updates/deletes.

4) Auth

Client and server Supabase clients are configured in `src/lib/supabase/*`. Server actions verify auth and write rows with `user_id` from the current session.

5) Seeding

Use the `seedCategories` server action (Finance) after first sign-in to create default categories for a user if needed.

## Learn More

To learn more about Next.js, take a look at the following resources:


You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
