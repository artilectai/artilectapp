import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { userProfiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAuth } from '@/lib/auth';

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
  const session = await getAuth().api.getSession({
      headers: request.headers
    });

    if (!session) {
      return NextResponse.json({
        error: 'Authentication required',
        code: 'UNAUTHENTICATED'
      }, { status: 401 });
    }

  const { user_id: userId } = await getParams<{ user_id: string }>(context);
    
    if (!userId) {
      return NextResponse.json({
        error: 'User ID is required',
        code: 'MISSING_USER_ID'
      }, { status: 400 });
    }

    // Check if requesting user's own profile or has permission
    if (session.user.id !== userId) {
      return NextResponse.json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      }, { status: 403 });
    }

    const userProfile = await db.select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    if (userProfile.length === 0) {
      return NextResponse.json({
        error: 'User profile not found',
        code: 'PROFILE_NOT_FOUND'
      }, { status: 404 });
    }

    return NextResponse.json(userProfile[0]);
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({
      error: 'Internal server error: ' + error
    }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: any
) {
  try {
  const db = getDb();
  const session = await getAuth().api.getSession({
      headers: request.headers
    });

    if (!session) {
      return NextResponse.json({
        error: 'Authentication required',
        code: 'UNAUTHENTICATED'
      }, { status: 401 });
    }

  const { user_id: userId } = await getParams<{ user_id: string }>(context);
    
    if (!userId) {
      return NextResponse.json({
        error: 'User ID is required',
        code: 'MISSING_USER_ID'
      }, { status: 400 });
    }

    // Check if updating user's own profile
    if (session.user.id !== userId) {
      return NextResponse.json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      }, { status: 403 });
    }

    const requestBody = await request.json();

    // Security check: prevent modification of sensitive fields
    if ('id' in requestBody || 'userId' in requestBody) {
      return NextResponse.json({
        error: 'ID and User ID cannot be modified',
        code: 'IMMUTABLE_FIELDS'
      }, { status: 400 });
    }

    // Check if user profile exists
    const existingProfile = await db.select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    if (existingProfile.length === 0) {
      return NextResponse.json({
        error: 'User profile not found',
        code: 'PROFILE_NOT_FOUND'
      }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date().toISOString()
    };

    // Validate and sanitize fields
    if ('telegramId' in requestBody) {
      if (requestBody.telegramId && typeof requestBody.telegramId !== 'string') {
        return NextResponse.json({
          error: 'Telegram ID must be a string',
          code: 'INVALID_TELEGRAM_ID'
        }, { status: 400 });
      }
      updateData.telegramId = requestBody.telegramId ? requestBody.telegramId.trim() : null;
    }

    if ('firstName' in requestBody) {
      if (requestBody.firstName && typeof requestBody.firstName !== 'string') {
        return NextResponse.json({
          error: 'First name must be a string',
          code: 'INVALID_FIRST_NAME'
        }, { status: 400 });
      }
      updateData.firstName = requestBody.firstName ? requestBody.firstName.trim() : null;
    }

    if ('lastName' in requestBody) {
      if (requestBody.lastName && typeof requestBody.lastName !== 'string') {
        return NextResponse.json({
          error: 'Last name must be a string',
          code: 'INVALID_LAST_NAME'
        }, { status: 400 });
      }
      updateData.lastName = requestBody.lastName ? requestBody.lastName.trim() : null;
    }

    if ('username' in requestBody) {
      if (requestBody.username && typeof requestBody.username !== 'string') {
        return NextResponse.json({
          error: 'Username must be a string',
          code: 'INVALID_USERNAME'
        }, { status: 400 });
      }
      updateData.username = requestBody.username ? requestBody.username.trim() : null;
    }

    if ('languageCode' in requestBody) {
      if (requestBody.languageCode && typeof requestBody.languageCode !== 'string') {
        return NextResponse.json({
          error: 'Language code must be a string',
          code: 'INVALID_LANGUAGE_CODE'
        }, { status: 400 });
      }
      updateData.languageCode = requestBody.languageCode || 'en';
    }

    if ('timezone' in requestBody) {
      if (requestBody.timezone && typeof requestBody.timezone !== 'string') {
        return NextResponse.json({
          error: 'Timezone must be a string',
          code: 'INVALID_TIMEZONE'
        }, { status: 400 });
      }
      updateData.timezone = requestBody.timezone || 'UTC';
    }

    if ('subscriptionPlan' in requestBody) {
      const validPlans = ['free', 'premium', 'pro'];
      if (!validPlans.includes(requestBody.subscriptionPlan)) {
        return NextResponse.json({
          error: 'Subscription plan must be one of: free, premium, pro',
          code: 'INVALID_SUBSCRIPTION_PLAN'
        }, { status: 400 });
      }
      updateData.subscriptionPlan = requestBody.subscriptionPlan;
    }

    if ('subscriptionStatus' in requestBody) {
      const validStatuses = ['active', 'inactive', 'trial'];
      if (!validStatuses.includes(requestBody.subscriptionStatus)) {
        return NextResponse.json({
          error: 'Subscription status must be one of: active, inactive, trial',
          code: 'INVALID_SUBSCRIPTION_STATUS'
        }, { status: 400 });
      }
      updateData.subscriptionStatus = requestBody.subscriptionStatus;
    }

    if ('onboardingCompleted' in requestBody) {
      if (typeof requestBody.onboardingCompleted !== 'boolean') {
        return NextResponse.json({
          error: 'Onboarding completed must be a boolean',
          code: 'INVALID_ONBOARDING_COMPLETED'
        }, { status: 400 });
      }
      updateData.onboardingCompleted = requestBody.onboardingCompleted;
    }

    const updatedProfile = await db.update(userProfiles)
      .set(updateData)
      .where(eq(userProfiles.userId, userId))
      .returning();

    if (updatedProfile.length === 0) {
      return NextResponse.json({
        error: 'Failed to update user profile',
        code: 'UPDATE_FAILED'
      }, { status: 500 });
    }

    return NextResponse.json(updatedProfile[0]);
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({
      error: 'Internal server error: ' + error
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: any
) {
  try {
  const db = getDb();
  const session = await getAuth().api.getSession({
      headers: request.headers
    });

    if (!session) {
      return NextResponse.json({
        error: 'Authentication required',
        code: 'UNAUTHENTICATED'
      }, { status: 401 });
    }

  const { user_id: userId } = await getParams<{ user_id: string }>(context);
    
    if (!userId) {
      return NextResponse.json({
        error: 'User ID is required',
        code: 'MISSING_USER_ID'
      }, { status: 400 });
    }

    // Check if deleting user's own profile
    if (session.user.id !== userId) {
      return NextResponse.json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      }, { status: 403 });
    }

    // Check if user profile exists
    const existingProfile = await db.select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    if (existingProfile.length === 0) {
      return NextResponse.json({
        error: 'User profile not found',
        code: 'PROFILE_NOT_FOUND'
      }, { status: 404 });
    }

    const deletedProfile = await db.delete(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .returning();

    if (deletedProfile.length === 0) {
      return NextResponse.json({
        error: 'Failed to delete user profile',
        code: 'DELETE_FAILED'
      }, { status: 500 });
    }

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