import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { tasks } from '@/db/schema';
import { eq, like, and, or, desc, asc } from 'drizzle-orm';
import { getAuth } from '@/lib/auth';
import { headers } from 'next/headers';

// Better-auth authentication
async function authenticateRequest(request: NextRequest) {
  const session = await getAuth().api.getSession({
    headers: await headers()
  });
  
  if (!session) {
    return null;
  }
  
  return session;
}

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
    // Authenticate request with better-auth
    const session = await authenticateRequest(request);
    if (!session) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED' 
      }, { status: 401 });
    }

  const { user_id } = await getParams<{ user_id: string }>(context);
    
    if (!user_id) {
      return NextResponse.json({ 
        error: 'User ID is required',
        code: 'MISSING_USER_ID' 
      }, { status: 400 });
    }

    // Verify user can access their own tasks or has appropriate permissions
    if (session.user.id !== user_id) {
      return NextResponse.json({ 
        error: 'Access denied. You can only access your own tasks.',
        code: 'ACCESS_DENIED' 
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    
    // Pagination parameters
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Filter parameters
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    
    // Sorting parameters
    const sort = searchParams.get('sort') || 'createdAt';
    const order = searchParams.get('order') || 'desc';
    
    // Build query conditions
    const conditions = [eq(tasks.userId, user_id)];
    
    if (status) {
      conditions.push(eq(tasks.status, status));
    }
    
    if (priority) {
      conditions.push(eq(tasks.priority, priority));
    }
    
    if (category) {
      conditions.push(eq(tasks.category, category));
    }
    
    if (search) {
      const searchCondition = or(
        like(tasks.title, `%${search}%`),
        like(tasks.description, `%${search}%`)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }
    
    const whereCondition = conditions.length > 1 ? and(...conditions) : conditions[0];
    
    // Build sort condition
    const sortColumn = (tasks as any)[sort] ?? tasks.createdAt;
    const orderBy = order === 'asc' ? asc(sortColumn) : desc(sortColumn);
    
    // Execute query
    const results = await db.select()
      .from(tasks)
      .where(whereCondition)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);
    
    return NextResponse.json(results, { status: 200 });
    
  } catch (error) {
    console.error('GET tasks error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}