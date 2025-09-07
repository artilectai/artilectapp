import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { userProfiles, tasks, transactions, workouts, categories } from '@/db/schema';
import { eq, and, desc, sql, count } from 'drizzle-orm';

async function getParams<T = any>(context: any): Promise<T> {
  const p = context?.params;
  return p && typeof p.then === 'function' ? await p : p;
}

export async function GET(
  request: NextRequest,
  context: any
) {
  try {
  const db = getDb();
    // Extract bearer token from authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ 
        error: 'Authorization header is required',
        code: 'MISSING_AUTH_HEADER' 
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    if (!token) {
      return NextResponse.json({ 
        error: 'Bearer token is required',
        code: 'MISSING_TOKEN' 
      }, { status: 401 });
    }

    // Get user_id from path parameters
  const { user_id } = await getParams<{ user_id: string }>(context);
    
    if (!user_id) {
      return NextResponse.json({ 
        error: 'user_id parameter is required',
        code: 'MISSING_USER_ID' 
      }, { status: 400 });
    }

    // Verify user exists
    const user = await db.select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user_id))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND' 
      }, { status: 404 });
    }

    const userProfile = user[0];

    // Get task statistics
    const taskStats = await db.select({
      total: count(),
      status: tasks.status,
      priority: tasks.priority
    })
    .from(tasks)
    .where(eq(tasks.userId, user_id))
    .groupBy(tasks.status, tasks.priority);

    // Process task statistics
    const taskSummary = {
      total: 0,
      completed: 0,
      pending: 0,
      inProgress: 0,
      cancelled: 0,
      byPriority: {
        low: 0,
        medium: 0,
        high: 0,
        urgent: 0
      }
    };

    taskStats.forEach(stat => {
      taskSummary.total += stat.total;
      
      // Count by status
      if (stat.status === 'completed') taskSummary.completed += stat.total;
      else if (stat.status === 'pending') taskSummary.pending += stat.total;
      else if (stat.status === 'in_progress') taskSummary.inProgress += stat.total;
      else if (stat.status === 'cancelled') taskSummary.cancelled += stat.total;
      
      // Count by priority
      if (stat.priority === 'low') taskSummary.byPriority.low += stat.total;
      else if (stat.priority === 'medium') taskSummary.byPriority.medium += stat.total;
      else if (stat.priority === 'high') taskSummary.byPriority.high += stat.total;
      else if (stat.priority === 'urgent') taskSummary.byPriority.urgent += stat.total;
    });

    // Get financial overview
    const financialData = await db.select({
      totalAmount: sql<number>`sum(${transactions.amount})`,
      type: transactions.type
    })
    .from(transactions)
    .where(eq(transactions.userId, user_id))
    .groupBy(transactions.type);

    let totalIncome = 0;
    let totalExpenses = 0;
    
    financialData.forEach(item => {
      if (item.type === 'income') {
        totalIncome = item.totalAmount || 0;
      } else if (item.type === 'expense') {
        totalExpenses = Math.abs(item.totalAmount || 0);
      }
    });

    const balance = totalIncome - totalExpenses;

    // Get recent transactions
    const recentTransactions = await db.select()
      .from(transactions)
      .where(eq(transactions.userId, user_id))
      .orderBy(desc(transactions.date))
      .limit(5);

    // Get workout statistics
    const workoutStats = await db.select({
      totalWorkouts: count(),
      totalCaloriesBurned: sql<number>`sum(${workouts.caloriesBurned})`,
      totalDurationMinutes: sql<number>`sum(${workouts.durationMinutes})`
    })
    .from(workouts)
    .where(eq(workouts.userId, user_id));

    const workoutSummary = {
      totalWorkouts: workoutStats[0]?.totalWorkouts || 0,
      totalCaloriesBurned: workoutStats[0]?.totalCaloriesBurned || 0,
      totalDurationMinutes: workoutStats[0]?.totalDurationMinutes || 0
    };

    // Get recent workouts
    const recentWorkouts = await db.select()
      .from(workouts)
      .where(eq(workouts.userId, user_id))
      .orderBy(desc(workouts.date))
      .limit(5);

    // Get category counts by type
    const categoryStats = await db.select({
      count: count(),
      type: categories.type
    })
    .from(categories)
    .where(eq(categories.userId, user_id))
    .groupBy(categories.type);

    const categoryCounts = {
      task: 0,
      transaction: 0,
      workout: 0
    };

    categoryStats.forEach(stat => {
      if (stat.type === 'task') categoryCounts.task = stat.count;
      else if (stat.type === 'transaction') categoryCounts.transaction = stat.count;
      else if (stat.type === 'workout') categoryCounts.workout = stat.count;
    });

    // Construct comprehensive dashboard response
    const dashboardData = {
      user: {
        id: userProfile.id,
        userId: userProfile.userId,
        telegramId: userProfile.telegramId,
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        username: userProfile.username,
        languageCode: userProfile.languageCode,
        timezone: userProfile.timezone,
        subscriptionPlan: userProfile.subscriptionPlan,
        subscriptionStatus: userProfile.subscriptionStatus,
        onboardingCompleted: userProfile.onboardingCompleted,
        createdAt: userProfile.createdAt,
        updatedAt: userProfile.updatedAt
      },
      tasks: taskSummary,
      financial: {
        totalIncome,
        totalExpenses,
        balance,
        recentTransactions: recentTransactions.map(t => ({
          id: t.id,
          amount: t.amount,
          type: t.type,
          category: t.category,
          description: t.description,
          date: t.date,
          account: t.account
        }))
      },
      workouts: {
        ...workoutSummary,
        recentWorkouts: recentWorkouts.map(w => ({
          id: w.id,
          name: w.name,
          type: w.type,
          durationMinutes: w.durationMinutes,
          caloriesBurned: w.caloriesBurned,
          date: w.date,
          notes: w.notes
        }))
      },
      categories: categoryCounts
    };

    return NextResponse.json(dashboardData, { status: 200 });

  } catch (error) {
    console.error('GET dashboard error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}