import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { categories, userProfiles } from '@/db/schema';
import { eq, like, and, or, desc } from 'drizzle-orm';
import { authClient } from '@/lib/auth-client';

// Better-auth session authentication middleware
async function authenticateRequest(request: NextRequest) {
  try {
    const session = await authClient.getSession({ 
      fetchOptions: { headers: request.headers }
    });
    
    if (!session?.data?.user) {
      return null;
    }
    
    return session.data.user;
  } catch (error) {
    return null;
  }
}

// Normalize Next.js 15 context where params may be a Promise
async function getParams<T = any>(context: any): Promise<T> {
  const p = context?.params;
  return p && typeof p.then === 'function' ? await p : p;
}

export async function GET(
  request: NextRequest,
  context: any
) {
  try {
    // Authenticate request
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

  const { user_id } = await getParams<{ user_id: string }>(context);
    
    if (!user_id) {
      return NextResponse.json(
        { error: 'User ID is required', code: 'MISSING_USER_ID' },
        { status: 400 }
      );
    }

    // Verify the user exists in our user profiles
    const userExists = await db.select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user_id))
      .limit(1);

    if (userExists.length === 0) {
      return NextResponse.json(
        { error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const type = searchParams.get('type');

    // Validate type parameter if provided
    if (type && !['task', 'transaction', 'workout'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be one of: task, transaction, workout', code: 'INVALID_TYPE' },
        { status: 400 }
      );
    }

    // Build where conditions
    const conditions = [eq(categories.userId, user_id)];
    
    if (type) {
      conditions.push(eq(categories.type, type));
    }
    
    if (search) {
      conditions.push(like(categories.name, `%${search}%`));
    }
    
    const results = await db.select()
      .from(categories)
      .where(and(...conditions))
      .orderBy(desc(categories.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(results, { status: 200 });

  } catch (error) {
    console.error('GET categories error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}