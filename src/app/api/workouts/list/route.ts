import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { workouts } from '@/db/schema';
import { eq, like, and, or, desc, asc, gte, lte } from 'drizzle-orm';
import { getAuth } from '@/lib/auth';

// Better-auth authentication
async function authenticateRequest(request: NextRequest) {
  try {
    const session = await getAuth().api.getSession({
      headers: request.headers
    });
    
    if (!session || !session.user) {
      return null;
    }
    
    return session.user;
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
  const db = getDb();
    // Authentication check
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    
    // Pagination parameters
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Filter parameters
    const userId = searchParams.get('user_id');
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const id = searchParams.get('id');
    
    // Sorting parameters
    const sort = searchParams.get('sort') || 'createdAt';
    const order = searchParams.get('order') === 'asc' ? asc : desc;

    // Single record fetch
    if (id) {
      if (!id || isNaN(parseInt(id))) {
        return NextResponse.json({ 
          error: "Valid ID is required",
          code: "INVALID_ID" 
        }, { status: 400 });
      }

      const workout = await db.select()
        .from(workouts)
        .where(and(
          eq(workouts.id, parseInt(id)),
          eq(workouts.userId, user.id)
        ))
        .limit(1);

      if (workout.length === 0) {
        return NextResponse.json({ 
          error: 'Workout not found',
          code: 'NOT_FOUND' 
        }, { status: 404 });
      }

      return NextResponse.json(workout[0]);
    }

    // Build where conditions
    let whereConditions = [eq(workouts.userId, userId || user.id)];

    if (type) {
      whereConditions.push(eq(workouts.type, type));
    }

    if (search) {
      const nameClause = like(workouts.name, `%${search}%`) as any;
      const notesClause = like(workouts.notes, `%${search}%`) as any;
      whereConditions.push(or(nameClause, notesClause) as any);
    }

    if (dateFrom) {
      whereConditions.push(gte(workouts.date, dateFrom));
    }

    if (dateTo) {
      whereConditions.push(lte(workouts.date, dateTo));
    }

    // Build query (avoid reassigning query object to keep types intact)
    const baseQuery = db.select().from(workouts);
    const filteredQuery = whereConditions.length > 0
      ? (baseQuery as any).where(and(...whereConditions) as any)
      : baseQuery;

    // Apply sorting
    const sortColumn = sort === 'name' ? workouts.name :
                      sort === 'type' ? workouts.type :
                      sort === 'date' ? workouts.date :
                      sort === 'updatedAt' ? workouts.updatedAt :
                      workouts.createdAt;

    const orderedQuery = (filteredQuery as any).orderBy(order(sortColumn));

    // Apply pagination
    const results = await (orderedQuery as any).limit(limit).offset(offset);

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
    // Authentication check
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    const requestBody = await request.json();
    const { name, type, durationMinutes, caloriesBurned, notes, date } = requestBody;

    // Validate required fields
    if (!name) {
      return NextResponse.json({ 
        error: "name is required",
        code: "MISSING_NAME" 
      }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({ 
        error: "date is required",
        code: "MISSING_DATE" 
      }, { status: 400 });
    }

    // Validate date format (ISO date)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ 
        error: "date must be in ISO date format (YYYY-MM-DD)",
        code: "INVALID_DATE_FORMAT" 
      }, { status: 400 });
    }

    // Validate type if provided
    const validTypes = ['cardio', 'strength', 'flexibility', 'sports', 'other'];
    const workoutType = type || 'other';
    if (!validTypes.includes(workoutType)) {
      return NextResponse.json({ 
        error: "type must be one of: cardio, strength, flexibility, sports, other",
        code: "INVALID_TYPE" 
      }, { status: 400 });
    }

    // Validate numeric fields if provided
    if (durationMinutes !== undefined && (!Number.isInteger(durationMinutes) || durationMinutes < 0)) {
      return NextResponse.json({ 
        error: "durationMinutes must be a positive integer",
        code: "INVALID_DURATION" 
      }, { status: 400 });
    }

    if (caloriesBurned !== undefined && (!Number.isInteger(caloriesBurned) || caloriesBurned < 0)) {
      return NextResponse.json({ 
        error: "caloriesBurned must be a positive integer",
        code: "INVALID_CALORIES" 
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Prepare insert data with defaults
    const insertData = {
      userId: user.id,
      name: name.trim(),
      type: workoutType,
      durationMinutes: durationMinutes || null,
      caloriesBurned: caloriesBurned || null,
      notes: notes ? notes.trim() : null,
      date: date,
      createdAt: now,
      updatedAt: now
    };

    const newWorkout = await db.insert(workouts)
      .values(insertData)
      .returning();

    return NextResponse.json(newWorkout[0], { status: 201 });

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
    // Authentication check
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    // Check if workout exists and belongs to user
    const existingWorkout = await db.select()
      .from(workouts)
      .where(and(
        eq(workouts.id, parseInt(id)),
        eq(workouts.userId, user.id)
      ))
      .limit(1);

    if (existingWorkout.length === 0) {
      return NextResponse.json({ 
        error: 'Workout not found',
        code: 'NOT_FOUND' 
      }, { status: 404 });
    }

    const requestBody = await request.json();
    const { name, type, durationMinutes, caloriesBurned, notes, date } = requestBody;

    const updates: any = {
      updatedAt: new Date().toISOString()
    };

    // Validate and update fields if provided
    if (name !== undefined) {
      if (!name) {
        return NextResponse.json({ 
          error: "name cannot be empty",
          code: "INVALID_NAME" 
        }, { status: 400 });
      }
      updates.name = name.trim();
    }

    if (type !== undefined) {
      const validTypes = ['cardio', 'strength', 'flexibility', 'sports', 'other'];
      if (!validTypes.includes(type)) {
        return NextResponse.json({ 
          error: "type must be one of: cardio, strength, flexibility, sports, other",
          code: "INVALID_TYPE" 
        }, { status: 400 });
      }
      updates.type = type;
    }

    if (durationMinutes !== undefined) {
      if (durationMinutes !== null && (!Number.isInteger(durationMinutes) || durationMinutes < 0)) {
        return NextResponse.json({ 
          error: "durationMinutes must be a positive integer or null",
          code: "INVALID_DURATION" 
        }, { status: 400 });
      }
      updates.durationMinutes = durationMinutes;
    }

    if (caloriesBurned !== undefined) {
      if (caloriesBurned !== null && (!Number.isInteger(caloriesBurned) || caloriesBurned < 0)) {
        return NextResponse.json({ 
          error: "caloriesBurned must be a positive integer or null",
          code: "INVALID_CALORIES" 
        }, { status: 400 });
      }
      updates.caloriesBurned = caloriesBurned;
    }

    if (notes !== undefined) {
      updates.notes = notes ? notes.trim() : null;
    }

    if (date !== undefined) {
      if (!date) {
        return NextResponse.json({ 
          error: "date cannot be empty",
          code: "INVALID_DATE" 
        }, { status: 400 });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ 
          error: "date must be in ISO date format (YYYY-MM-DD)",
          code: "INVALID_DATE_FORMAT" 
        }, { status: 400 });
      }
      updates.date = date;
    }

    const updatedWorkout = await db.update(workouts)
      .set(updates)
      .where(and(
        eq(workouts.id, parseInt(id)),
        eq(workouts.userId, user.id)
      ))
      .returning();

    return NextResponse.json(updatedWorkout[0]);

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
    // Authentication check
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    // Check if workout exists and belongs to user before deleting
    const existingWorkout = await db.select()
      .from(workouts)
      .where(and(
        eq(workouts.id, parseInt(id)),
        eq(workouts.userId, user.id)
      ))
      .limit(1);

    if (existingWorkout.length === 0) {
      return NextResponse.json({ 
        error: 'Workout not found',
        code: 'NOT_FOUND' 
      }, { status: 404 });
    }

    const deleted = await db.delete(workouts)
      .where(and(
        eq(workouts.id, parseInt(id)),
        eq(workouts.userId, user.id)
      ))
      .returning();

    return NextResponse.json({
      message: 'Workout deleted successfully',
      deletedWorkout: deleted[0]
    });

  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}