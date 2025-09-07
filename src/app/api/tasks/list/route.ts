import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const sb = await supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
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
      const { data, error } = await sb.from('tasks').select('*').eq('id', id).eq('user_id', user.id).limit(1).maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      if (!data) {
        return NextResponse.json({ 
          error: 'Task not found',
          code: 'TASK_NOT_FOUND' 
        }, { status: 404 });
      }
      return NextResponse.json(data, { status: 200 });
    }

    // List with filtering, search, and pagination
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const sort = searchParams.get('sort') || 'created_at';
    const order = (searchParams.get('order') || 'desc').toLowerCase() === 'asc' ? { ascending: true } : { ascending: false };

    let q = sb.from('tasks').select('*').eq('user_id', user.id);
    if (status) q = q.eq('status', status);
    if (priority) q = q.eq('priority', priority);
    if (search) q = q.ilike('title', `%${search}%`);
    const { data, error } = await q.order(sort as any, order as any).range(offset, offset + limit - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data ?? [], { status: 200 });

  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sb = await supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      }, { status: 401 });
    }

    const requestBody = await request.json();

    if (!requestBody.title || requestBody.title.trim() === '') {
      return NextResponse.json({ 
        error: "Title is required",
        code: "MISSING_TITLE" 
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    const insert = {
      user_id: user.id,
      title: String(requestBody.title).trim(),
      description: requestBody.description ? String(requestBody.description).trim() : null,
      status: requestBody.status || 'todo',
      priority: requestBody.priority || 'medium',
      due_date: requestBody.dueDate || null,
      created_at: now,
      updated_at: now,
    };
    const { data, error } = await sb.from('tasks').insert(insert).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });

  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const sb = await supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const { data: exists, error: e1 } = await sb.from('tasks').select('id').eq('id', id).eq('user_id', user.id).maybeSingle();
    if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });
    if (!exists) {
      return NextResponse.json({ 
        error: 'Task not found',
        code: 'TASK_NOT_FOUND' 
      }, { status: 404 });
    }

    const requestBody = await request.json();

    const updateData: any = { updated_at: new Date().toISOString() };

    if (requestBody.title !== undefined) {
      if (!requestBody.title || requestBody.title.trim() === '') {
        return NextResponse.json({ 
          error: "Title cannot be empty",
          code: "INVALID_TITLE" 
        }, { status: 400 });
      }
      updateData.title = String(requestBody.title).trim();
    }

    if (requestBody.description !== undefined) {
      updateData.description = requestBody.description ? String(requestBody.description).trim() : null;
    }

    if (requestBody.status !== undefined) {
      updateData.status = requestBody.status;
    }

    if (requestBody.priority !== undefined) {
      updateData.priority = requestBody.priority;
    }

    if (requestBody.dueDate !== undefined) {
      updateData.due_date = requestBody.dueDate;
    }

    if (requestBody.completedAt !== undefined) {
      updateData.completed_at = requestBody.completedAt;
    }

    const { data, error } = await sb.from('tasks').update(updateData).eq('id', id).eq('user_id', user.id).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sb = await supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      return NextResponse.json({
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        error: 'Valid ID is required',
        code: 'INVALID_ID'
      }, { status: 400 });
    }

    // Ensure the task belongs to the user and delete
    const { data: existing, error: e1 } = await sb
      .from('tasks')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });
    if (!existing) {
      return NextResponse.json({
        error: 'Task not found',
        code: 'TASK_NOT_FOUND'
      }, { status: 404 });
    }

    const { error } = await sb
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ message: 'Task deleted successfully' }, { status: 200 });

  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}