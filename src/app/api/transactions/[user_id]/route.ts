import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { transactions } from '@/db/schema';
import { eq, like, and, or, desc, asc, gte, lte } from 'drizzle-orm';
import { auth } from '@/lib/auth';

async function getParams<T = any>(context: any): Promise<T> {
  const p = context?.params;
  return p && typeof p.then === 'function' ? await p : p;
}

export async function GET(
  request: NextRequest,
  context: any
) {
  try {
    // Get session from better-auth
    const session = await auth.api.getSession({
      headers: request.headers
    });

    if (!session) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHENTICATED' 
      }, { status: 401 });
    }

    // Get user_id from path parameters
  const { user_id: userId } = await getParams<{ user_id: string }>(context);
    if (!userId) {
      return NextResponse.json({ 
        error: 'User ID is required',
        code: 'MISSING_USER_ID' 
      }, { status: 400 });
    }

    // Check authorization - users can only access their own data
    if (session.user.id !== userId) {
      return NextResponse.json({ 
        error: 'Forbidden - can only access your own transactions',
        code: 'FORBIDDEN' 
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    
    // Pagination parameters
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Filter parameters
    const type = searchParams.get('type'); // 'income' or 'expense'
    const category = searchParams.get('category');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const search = searchParams.get('search');
    const account = searchParams.get('account');
    
    // Sorting parameters
    const sort = searchParams.get('sort') || 'date';
    const order = searchParams.get('order') || 'desc';

    // Build query conditions
    let conditions = [eq(transactions.userId, userId)];

    // Type filter
    if (type && (type === 'income' || type === 'expense')) {
      conditions.push(eq(transactions.type, type));
    }

    // Category filter
    if (category) {
      conditions.push(eq(transactions.category, category));
    }

    // Account filter
    if (account) {
      conditions.push(eq(transactions.account, account));
    }

    // Date range filter
    if (dateFrom) {
      conditions.push(gte(transactions.date, dateFrom));
    }
    if (dateTo) {
      conditions.push(lte(transactions.date, dateTo));
    }

    // Search in description
    if (search) {
      conditions.push(like(transactions.description, `%${search}%`));
    }

    // Build the main query
  const db = getDb();
  const baseQuery = db.select().from(transactions);

    // Apply all conditions without changing the type of baseQuery
    const filteredQuery = conditions.length > 0
      ? baseQuery.where(and(...conditions))
      : baseQuery;

    // Apply sorting
    const sortColumn = sort === 'amount' ? transactions.amount :
                      sort === 'type' ? transactions.type :
                      sort === 'category' ? transactions.category :
                      sort === 'account' ? transactions.account :
                      sort === 'createdAt' ? transactions.createdAt :
                      transactions.date; // default to date

    const orderedQuery = order === 'asc' ? 
      filteredQuery.orderBy(asc(sortColumn)) : 
      filteredQuery.orderBy(desc(sortColumn));

    // Apply pagination
    const results = await orderedQuery.limit(limit).offset(offset);

    // Get total count for pagination metadata
  const baseCountQuery = db.select({ count: transactions.id }).from(transactions);
    const finalCountQuery = conditions.length > 0
      ? baseCountQuery.where(and(...conditions))
      : baseCountQuery;
    const totalResult = await finalCountQuery;
    const total = totalResult.length;

    return NextResponse.json({
      transactions: results,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      },
      filters: {
        type,
        category,
        account,
        dateFrom,
        dateTo,
        search
      }
    });

  } catch (error) {
    console.error('GET transactions error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}