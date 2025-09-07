import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { categories } from '@/db/schema';
import { eq, like, and, or, desc, asc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

// Better-auth session validation
async function authenticateRequest(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    
    if (!session) {
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const session = await authenticateRequest(request);
    if (!session) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    // Single record fetch
    if (id) {
      if (!id || isNaN(parseInt(id))) {
        return NextResponse.json({ 
          error: "Valid ID is required",
          code: "INVALID_ID" 
        }, { status: 400 });
      }
      
  const db = getDb();
  const category = await db.select()
        .from(categories)
        .where(eq(categories.id, parseInt(id)))
        .limit(1);
      
      if (category.length === 0) {
        return NextResponse.json({ 
          error: 'Category not found',
          code: 'NOT_FOUND' 
        }, { status: 404 });
      }
      
      return NextResponse.json(category[0]);
    }
    
    // List with filtering, search and pagination
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const userId = searchParams.get('user_id');
    const type = searchParams.get('type');
    const sort = searchParams.get('sort') || 'createdAt';
    const order = searchParams.get('order') || 'desc';
    
  const db = getDb();
  const baseQuery = db.select().from(categories);
  const conditions: any[] = [];
    
    // Filter by user_id
    if (userId) {
      conditions.push(eq(categories.userId, userId));
    }
    
    // Filter by type
    if (type) {
      if (!['task', 'transaction', 'workout'].includes(type)) {
        return NextResponse.json({ 
          error: "Invalid type. Must be 'task', 'transaction', or 'workout'",
          code: "INVALID_TYPE" 
        }, { status: 400 });
      }
      conditions.push(eq(categories.type, type));
    }
    
    // Search by name
    if (search) {
      conditions.push(like(categories.name, `%${search}%`));
    }
    
    // Apply conditions (build filtered query without changing the type)
    const filteredQuery = conditions.length > 0
      ? (baseQuery as any).where(and(...conditions) as any)
      : baseQuery;

    // Apply sorting
    const orderDirection = order === 'asc' ? asc : desc;
    const sortColumn =
      sort === 'name' ? categories.name :
      sort === 'type' ? categories.type :
      categories.createdAt;

    const orderedQuery = (filteredQuery as any).orderBy(orderDirection(sortColumn));
    
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
    // Authentication check
    const session = await authenticateRequest(request);
    if (!session) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

  const db = getDb();
  const requestBody = await request.json();
    const { userId, name, type, color } = requestBody;
    
    // Validate required fields
    if (!userId) {
      return NextResponse.json({ 
        error: "userId is required",
        code: "MISSING_USER_ID" 
      }, { status: 400 });
    }
    
    if (!name) {
      return NextResponse.json({ 
        error: "name is required",
        code: "MISSING_NAME" 
      }, { status: 400 });
    }
    
    if (!type) {
      return NextResponse.json({ 
        error: "type is required",
        code: "MISSING_TYPE" 
      }, { status: 400 });
    }
    
    // Validate type value
    if (!['task', 'transaction', 'workout'].includes(type)) {
      return NextResponse.json({ 
        error: "Invalid type. Must be 'task', 'transaction', or 'workout'",
        code: "INVALID_TYPE" 
      }, { status: 400 });
    }
    
    // Sanitize inputs
    const sanitizedData = {
      userId: userId.toString().trim(),
      name: name.toString().trim(),
      type: type.toString().trim(),
      color: color ? color.toString().trim() : null,
      createdAt: new Date().toISOString()
    };
    
  const newCategory = await db.insert(categories)
      .values(sanitizedData)
      .returning();
    
    return NextResponse.json(newCategory[0], { status: 201 });
    
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Authentication check
    const session = await authenticateRequest(request);
    if (!session) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

  const db = getDb();
  const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }
    
    // Check if record exists
  const existingCategory = await db.select()
      .from(categories)
      .where(eq(categories.id, parseInt(id)))
      .limit(1);
    
    if (existingCategory.length === 0) {
      return NextResponse.json({ 
        error: 'Category not found',
        code: 'NOT_FOUND' 
      }, { status: 404 });
    }
    
    const requestBody = await request.json();
    const { userId, name, type, color } = requestBody;
    
    // Validate type if provided
    if (type && !['task', 'transaction', 'workout'].includes(type)) {
      return NextResponse.json({ 
        error: "Invalid type. Must be 'task', 'transaction', or 'workout'",
        code: "INVALID_TYPE" 
      }, { status: 400 });
    }
    
    // Build update object with only provided fields
    const updates: any = {};
    
    if (userId !== undefined) {
      updates.userId = userId.toString().trim();
    }
    
    if (name !== undefined) {
      if (!name.toString().trim()) {
        return NextResponse.json({ 
          error: "name cannot be empty",
          code: "INVALID_NAME" 
        }, { status: 400 });
      }
      updates.name = name.toString().trim();
    }
    
    if (type !== undefined) {
      updates.type = type.toString().trim();
    }
    
    if (color !== undefined) {
      updates.color = color ? color.toString().trim() : null;
    }
    
  const updatedCategory = await db.update(categories)
      .set(updates)
      .where(eq(categories.id, parseInt(id)))
      .returning();
    
    return NextResponse.json(updatedCategory[0]);
    
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Authentication check
    const session = await authenticateRequest(request);
    if (!session) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

  const db = getDb();
  const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }
    
    // Check if record exists before deleting
  const existingCategory = await db.select()
      .from(categories)
      .where(eq(categories.id, parseInt(id)))
      .limit(1);
    
    if (existingCategory.length === 0) {
      return NextResponse.json({ 
        error: 'Category not found',
        code: 'NOT_FOUND' 
      }, { status: 404 });
    }
    
  const deletedCategory = await db.delete(categories)
      .where(eq(categories.id, parseInt(id)))
      .returning();
    
    return NextResponse.json({
      message: 'Category deleted successfully',
      category: deletedCategory[0]
    });
    
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}