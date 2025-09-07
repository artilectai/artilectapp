import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { workouts } from '@/db/schema';
import { eq, like, and, or, desc, asc, gte, lte, type SQL } from 'drizzle-orm';
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

async function getParams<T = any>(context: any): Promise<T> {
  const p = context?.params;
  return p && typeof p.then === 'function' ? await p : p;
}

export async function GET(request: NextRequest, context: any) {
  try {
    // Get session from better-auth
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    // Extract user_id from path parameters
  const { user_id } = await getParams<{ user_id: string }>(context);
    
    if (!user_id) {
      return NextResponse.json({ 
        error: "User ID is required",
        code: "MISSING_USER_ID" 
      }, { status: 400 });
    }

    // Verify user can access this data (users can only access their own data)
    if (session.user.id !== user_id) {
      return NextResponse.json({ 
        error: 'Access denied',
        code: 'FORBIDDEN' 
      }, { status: 403 });
    }

    // Extract query parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const type = searchParams.get('type');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const sort = searchParams.get('sort') || 'createdAt';
    const order = searchParams.get('order') || 'desc';

    // Validate pagination parameters
    if (isNaN(limit) || limit < 1) {
      return NextResponse.json({ 
        error: "Limit must be a positive integer",
        code: "INVALID_LIMIT" 
      }, { status: 400 });
    }

    if (isNaN(offset) || offset < 0) {
      return NextResponse.json({ 
        error: "Offset must be a non-negative integer",
        code: "INVALID_OFFSET" 
      }, { status: 400 });
    }

    // Validate type parameter
    const validTypes = ['cardio', 'strength', 'flexibility', 'sports', 'other'];
    if (type && !validTypes.includes(type)) {
      return NextResponse.json({ 
        error: "Invalid type. Must be one of: " + validTypes.join(', '),
        code: "INVALID_TYPE" 
      }, { status: 400 });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateFrom && !dateRegex.test(dateFrom)) {
      return NextResponse.json({ 
        error: "Invalid date_from format. Use YYYY-MM-DD",
        code: "INVALID_DATE_FROM" 
      }, { status: 400 });
    }

    if (dateTo && !dateRegex.test(dateTo)) {
      return NextResponse.json({ 
        error: "Invalid date_to format. Use YYYY-MM-DD",
        code: "INVALID_DATE_TO" 
      }, { status: 400 });
    }

    // Validate sort parameter
    const validSortFields = ['createdAt', 'updatedAt', 'date', 'name', 'type', 'durationMinutes', 'caloriesBurned'];
    if (!validSortFields.includes(sort)) {
      return NextResponse.json({ 
        error: "Invalid sort field. Must be one of: " + validSortFields.join(', '),
        code: "INVALID_SORT_FIELD" 
      }, { status: 400 });
    }

    // Validate order parameter
    if (order !== 'asc' && order !== 'desc') {
      return NextResponse.json({ 
        error: "Invalid order. Must be 'asc' or 'desc'",
        code: "INVALID_ORDER" 
      }, { status: 400 });
    }

    // Build query conditions
    const conditions = [eq(workouts.userId, user_id)];

    // Add search condition
    if (search) {
      const searchTerm = `%${search}%`;
      const nameClause = like(workouts.name, searchTerm) as any;
      const notesClause = like(workouts.notes, searchTerm) as any;
      conditions.push(or(nameClause, notesClause) as any);
    }

    // Add type filter
    if (type) {
      conditions.push(eq(workouts.type, type));
    }

    // Add date range filters
    if (dateFrom) {
      conditions.push(gte(workouts.date, dateFrom));
    }

    if (dateTo) {
      conditions.push(lte(workouts.date, dateTo));
    }

    // Build the final where condition
    const whereCondition = conditions.length > 1 ? and(...conditions) : conditions[0];

    // Execute query with sorting
    const sortOrder = order === 'asc' ? asc : desc;

    // Map allowed sort fields to concrete columns to avoid undefined access
    const sortColumns = {
      createdAt: workouts.createdAt,
      updatedAt: workouts.updatedAt,
      date: workouts.date,
      name: workouts.name,
      type: workouts.type,
      durationMinutes: workouts.durationMinutes,
      caloriesBurned: workouts.caloriesBurned
    } as const;

    const sortColumn = sortColumns[sort as keyof typeof sortColumns] ?? workouts.createdAt;

    const results = await db.select()
      .from(workouts)
      .where(whereCondition)
      .orderBy(sortOrder(sortColumn))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination metadata
    const totalCountResult = await db.select()
      .from(workouts)
      .where(whereCondition);
    
    const totalCount = totalCountResult.length;
    const hasMore = offset + results.length < totalCount;

    // Helper function to format dates
    const formatDateRange = (startDate: Date, endDate: Date) => {
      const start = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const end = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${start} - ${end}`;
    };

    // Local helper for start of day (used in save/toggle handlers)
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

    return NextResponse.json({
      data: results,
      pagination: {
        limit,
        offset,
        totalCount,
        hasMore,
        currentPage: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(totalCount / limit)
      },
      filters: {
        search,
        type,
        dateFrom,
        dateTo
      }
    }, { status: 200 });

  } catch (error) {
    console.error('GET workouts error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}