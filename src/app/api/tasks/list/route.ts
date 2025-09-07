import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tasks } from '@/db/schema';
import { eq, like, and, or, desc, asc } from 'drizzle-orm';
import { auth } from "@/lib/auth";

// Better-auth session authentication
async function authenticateRequest(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers
    });
    
    if (!session || !session.user) {
      return null;
    }
    
    return session.user;
  } catch (error) {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authentication check with better-auth
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
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

      const task = await db.select()
        .from(tasks)
        .where(eq(tasks.id, parseInt(id)))
        .limit(1);

      if (task.length === 0) {
        return NextResponse.json({ 
          error: 'Task not found',
          code: 'TASK_NOT_FOUND' 
        }, { status: 404 });
      }

      return NextResponse.json(task[0], { status: 200 });
    }

    // List with filtering, search, and pagination
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const userId = searchParams.get('user_id');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const category = searchParams.get('category');
    const sort = searchParams.get('sort') || 'createdAt';
    const order = searchParams.get('order') || 'desc';

    // Build where conditions
    const conditions = [];

    if (userId) {
      conditions.push(eq(tasks.userId, userId));
    }

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
      conditions.push(
        or(
          like(tasks.title, `%${search}%`),
          like(tasks.description, `%${search}%`)
        )
      );
    }

    let queryBuilder = db.select().from(tasks).$dynamic();

    if (conditions.length > 0) {
      queryBuilder = queryBuilder.where(and(...conditions));
    }

    // Add sorting
    const sortColumn = sort === 'title' ? tasks.title :
                      sort === 'status' ? tasks.status :
                      sort === 'priority' ? tasks.priority :
                      sort === 'dueDate' ? tasks.dueDate :
                      sort === 'updatedAt' ? tasks.updatedAt :
                      tasks.createdAt;

    queryBuilder = order === 'asc' ? queryBuilder.orderBy(asc(sortColumn)) : queryBuilder.orderBy(desc(sortColumn));

    const results = await queryBuilder.limit(limit).offset(offset);

    return NextResponse.json(results, { status: 200 });

  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication check with better-auth
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      }, { status: 401 });
    }

    const requestBody = await request.json();

    // Use authenticated user ID if not provided
    const userId = requestBody.userId || user.id;

    if (!requestBody.title || requestBody.title.trim() === '') {
      return NextResponse.json({ 
        error: "Title is required",
        code: "MISSING_TITLE" 
      }, { status: 400 });
    }

    // Prepare data with defaults and validation
    const now = new Date().toISOString();
    const taskData = {
      userId: userId,
      title: requestBody.title.toString().trim(),
      description: requestBody.description ? requestBody.description.toString().trim() : null,
      status: requestBody.status || 'pending',
      priority: requestBody.priority || 'medium',
      category: requestBody.category ? requestBody.category.toString().trim() : null,
      dueDate: requestBody.dueDate || null,
      completedAt: requestBody.completedAt || null,
      createdAt: now,
      updatedAt: now
    };

    const newTask = await db.insert(tasks)
      .values(taskData)
      .returning();

    return NextResponse.json(newTask[0], { status: 201 });

  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Authentication check with better-auth
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
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

    // Check if task exists
    const existingTask = await db.select()
      .from(tasks)
      .where(eq(tasks.id, parseInt(id)))
      .limit(1);

    if (existingTask.length === 0) {
      return NextResponse.json({ 
        error: 'Task not found',
        code: 'TASK_NOT_FOUND' 
      }, { status: 404 });
    }

    const requestBody = await request.json();

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date().toISOString()
    };

    if (requestBody.title !== undefined) {
      if (!requestBody.title || requestBody.title.trim() === '') {
        return NextResponse.json({ 
          error: "Title cannot be empty",
          code: "INVALID_TITLE" 
        }, { status: 400 });
      }
      updateData.title = requestBody.title.toString().trim();
    }

    if (requestBody.description !== undefined) {
      updateData.description = requestBody.description ? requestBody.description.toString().trim() : null;
    }

    if (requestBody.status !== undefined) {
      updateData.status = requestBody.status;
    }

    if (requestBody.priority !== undefined) {
      updateData.priority = requestBody.priority;
    }

    if (requestBody.category !== undefined) {
      updateData.category = requestBody.category ? requestBody.category.toString().trim() : null;
    }

    if (requestBody.dueDate !== undefined) {
      updateData.dueDate = requestBody.dueDate;
    }

    if (requestBody.completedAt !== undefined) {
      updateData.completedAt = requestBody.completedAt;
    }

    const updated = await db.update(tasks)
      .set(updateData)
      .where(eq(tasks.id, parseInt(id)))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ 
        error: 'Task not found',
        code: 'TASK_NOT_FOUND' 
      }, { status: 404 });
    }

    return NextResponse.json(updated[0], { status: 200 });

  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Authentication check with better-auth
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
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

    // Check if task exists before deleting
    const existingTask = await db.select()
      .from(tasks)
      .where(eq(tasks.id, parseInt(id)))
      .limit(1);

    if (existingTask.length === 0) {
      return NextResponse.json({ 
        error: 'Task not found',
        code: 'TASK_NOT_FOUND' 
      }, { status: 404 });
    }

    const deleted = await db.delete(tasks)
      .where(eq(tasks.id, parseInt(id)))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ 
        error: 'Task not found',
        code: 'TASK_NOT_FOUND' 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      message: 'Task deleted successfully',
      task: deleted[0]
    }, { status: 200 });

  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}