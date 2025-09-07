import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { userProfiles } from '@/db/schema';
import { eq, like, and, or, desc, asc } from 'drizzle-orm';
import { getAuth } from '@/lib/auth';
import { headers } from 'next/headers';

async function authenticateRequest(request: NextRequest) {
  try {
    const session = await getAuth().api.getSession({
      headers: await headers()
    });
    return session;
  } catch (error) {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
  const db = getDb();
  const session = await authenticateRequest(request);
    if (!session) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    // Single user by user_id
    if (userId) {
      const userProfile = await db.select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .limit(1);

      if (userProfile.length === 0) {
        return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
      }

      return NextResponse.json(userProfile[0]);
    }

    // List user profiles with pagination and search
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') || 'createdAt';
    const order = searchParams.get('order') || 'desc';

    let query = db.select().from(userProfiles).$dynamic();

    if (search) {
      query = query.where(or(
        like(userProfiles.telegramId, `%${search}%`),
        like(userProfiles.firstName, `%${search}%`),
        like(userProfiles.username, `%${search}%`)
      ));
    }

    if (sort === 'createdAt') {
      query = order === 'asc' ? query.orderBy(asc(userProfiles.createdAt)) : query.orderBy(desc(userProfiles.createdAt));
    } else if (sort === 'firstName') {
      query = order === 'asc' ? query.orderBy(asc(userProfiles.firstName)) : query.orderBy(desc(userProfiles.firstName));
    }

    const results = await query.limit(limit).offset(offset);
    return NextResponse.json(results);

  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
  const db = getDb();
    const session = await authenticateRequest(request);
    if (!session) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    const body = await request.json();
    const { 
      userId,
      telegramId, 
      firstName, 
      lastName, 
      username, 
      languageCode, 
      timezone, 
      subscriptionPlan, 
      subscriptionStatus, 
      onboardingCompleted 
    } = body;

    // Validate required fields
    if (!userId) {
      return NextResponse.json({ 
        error: "User ID is required",
        code: "MISSING_USER_ID" 
      }, { status: 400 });
    }

    if (!firstName || firstName.trim() === '') {
      return NextResponse.json({ 
        error: "First name is required",
        code: "MISSING_FIRST_NAME" 
      }, { status: 400 });
    }

    // Check if user profile already exists
    const existingProfile = await db.select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    if (existingProfile.length > 0) {
      return NextResponse.json({ 
        error: "User profile already exists",
        code: "PROFILE_EXISTS" 
      }, { status: 400 });
    }

    const currentTime = new Date().toISOString();

    const newProfile = await db.insert(userProfiles).values({
      userId: userId,
      telegramId: telegramId || null,
      firstName: firstName.trim(),
      lastName: lastName ? lastName.trim() : null,
      username: username ? username.trim() : null,
      languageCode: languageCode || 'en',
      timezone: timezone || 'UTC',
      subscriptionPlan: subscriptionPlan || 'free',
      subscriptionStatus: subscriptionStatus || 'inactive',
      onboardingCompleted: onboardingCompleted || false,
      createdAt: currentTime,
      updatedAt: currentTime
    }).returning();

    return NextResponse.json(newProfile[0], { status: 201 });

  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
  const db = getDb();
    const session = await authenticateRequest(request);
    if (!session) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json({ 
        error: "User ID is required",
        code: "MISSING_USER_ID" 
      }, { status: 400 });
    }

    // Check if user profile exists
    const existingProfile = await db.select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    if (existingProfile.length === 0) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const updates: any = {};

    // Validate and sanitize fields
    if (body.firstName !== undefined) {
      if (!body.firstName || body.firstName.trim() === '') {
        return NextResponse.json({ 
          error: "First name cannot be empty",
          code: "INVALID_FIRST_NAME" 
        }, { status: 400 });
      }
      updates.firstName = body.firstName.trim();
    }

    if (body.lastName !== undefined) {
      updates.lastName = body.lastName ? body.lastName.trim() : null;
    }

    if (body.username !== undefined) {
      updates.username = body.username ? body.username.trim() : null;
    }

    if (body.languageCode !== undefined) {
      updates.languageCode = body.languageCode || 'en';
    }

    if (body.timezone !== undefined) {
      updates.timezone = body.timezone || 'UTC';
    }

    if (body.subscriptionPlan !== undefined) {
      updates.subscriptionPlan = body.subscriptionPlan || 'free';
    }

    if (body.subscriptionStatus !== undefined) {
      updates.subscriptionStatus = body.subscriptionStatus || 'inactive';
    }

    if (body.onboardingCompleted !== undefined) {
      updates.onboardingCompleted = Boolean(body.onboardingCompleted);
    }

    updates.updatedAt = new Date().toISOString();

    const updatedProfile = await db.update(userProfiles)
      .set(updates)
      .where(eq(userProfiles.userId, userId))
      .returning();

    return NextResponse.json(updatedProfile[0]);

  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
  const db = getDb();
    const session = await authenticateRequest(request);
    if (!session) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json({ 
        error: "User ID is required",
        code: "MISSING_USER_ID" 
      }, { status: 400 });
    }

    // Check if user profile exists before deleting
    const existingProfile = await db.select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    if (existingProfile.length === 0) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const deletedProfile = await db.delete(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .returning();

    return NextResponse.json({
      message: 'User profile deleted successfully',
      deletedProfile: deletedProfile[0]
    });

  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}