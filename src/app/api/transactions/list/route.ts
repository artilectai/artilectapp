import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { transactions } from '@/db/schema';
import { eq, like, and, or, desc, asc, gte, lte } from 'drizzle-orm';
import { auth } from '@/lib/auth';

// Authentication using better-auth
async function authenticateRequest(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers
  });
  
  if (!session) {
    return null;
  }
  
  return session.user;
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // Single transaction by ID
    if (id) {
      if (isNaN(parseInt(id))) {
        return NextResponse.json({ 
          error: "Valid ID is required",
          code: "INVALID_ID" 
        }, { status: 400 });
      }

      const transaction = await db.select()
        .from(transactions)
        .where(and(
          eq(transactions.id, parseInt(id)),
          eq(transactions.userId, user.id)
        ))
        .limit(1);

      if (transaction.length === 0) {
        return NextResponse.json({ 
          error: 'Transaction not found' 
        }, { status: 404 });
      }

      return NextResponse.json(transaction[0]);
    }

    // List transactions with filters
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const sortField = searchParams.get('sort') || 'createdAt';
    const sortOrder = searchParams.get('order') || 'desc';

  const baseQuery = db.select().from(transactions);
  const conditions: any[] = [eq(transactions.userId, user.id)];

    // Filter by type
    if (type && (type === 'income' || type === 'expense')) {
      conditions.push(eq(transactions.type, type));
    }

    // Filter by category
    if (category) {
      conditions.push(eq(transactions.category, category));
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

    // Apply filters
    const filteredQuery = conditions.length > 0
      ? (baseQuery as any).where(and(...conditions) as any)
      : baseQuery;

    // Apply sorting
    const sortColumn = (transactions as any)[sortField] || transactions.createdAt;
    const orderedQuery = (filteredQuery as any).orderBy(
      sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn)
    );

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
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    const requestBody = await request.json();
    const { amount, type, category, description, date, account } = requestBody;

    // Validate required fields
    if (!amount && amount !== 0) {
      return NextResponse.json({ 
        error: "Amount is required",
        code: "MISSING_AMOUNT" 
      }, { status: 400 });
    }

    if (typeof amount !== 'number') {
      return NextResponse.json({ 
        error: "Amount must be a number",
        code: "INVALID_AMOUNT" 
      }, { status: 400 });
    }

    if (!type) {
      return NextResponse.json({ 
        error: "Type is required",
        code: "MISSING_TYPE" 
      }, { status: 400 });
    }

    if (type !== 'income' && type !== 'expense') {
      return NextResponse.json({ 
        error: "Type must be 'income' or 'expense'",
        code: "INVALID_TYPE" 
      }, { status: 400 });
    }

    if (!category) {
      return NextResponse.json({ 
        error: "Category is required",
        code: "MISSING_CATEGORY" 
      }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({ 
        error: "Date is required",
        code: "MISSING_DATE" 
      }, { status: 400 });
    }

    // Sanitize inputs
    const sanitizedData = {
      userId: user.id, // Use authenticated user's ID
      amount: Number(amount),
      type: String(type).trim().toLowerCase(),
      category: String(category).trim(),
      description: description ? String(description).trim() : null,
      date: String(date).trim(),
      account: account ? String(account).trim() : 'main',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const newTransaction = await db.insert(transactions)
      .values(sanitizedData)
      .returning();

    return NextResponse.json(newTransaction[0], { status: 201 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
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

    // Check if transaction exists and belongs to user
    const existing = await db.select()
      .from(transactions)
      .where(and(
        eq(transactions.id, parseInt(id)),
        eq(transactions.userId, user.id)
      ))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ 
        error: 'Transaction not found' 
      }, { status: 404 });
    }

    const requestBody = await request.json();
    const { amount, type, category, description, date, account } = requestBody;

    // Validate type if provided
    if (type && type !== 'income' && type !== 'expense') {
      return NextResponse.json({ 
        error: "Type must be 'income' or 'expense'",
        code: "INVALID_TYPE" 
      }, { status: 400 });
    }

    // Validate amount if provided
    if (amount !== undefined && typeof amount !== 'number') {
      return NextResponse.json({ 
        error: "Amount must be a number",
        code: "INVALID_AMOUNT" 
      }, { status: 400 });
    }

    // Build update object with only provided fields
    const updates: any = {
      updatedAt: new Date().toISOString()
    };

    if (amount !== undefined) updates.amount = Number(amount);
    if (type !== undefined) updates.type = String(type).trim().toLowerCase();
    if (category !== undefined) updates.category = String(category).trim();
    if (description !== undefined) updates.description = description ? String(description).trim() : null;
    if (date !== undefined) updates.date = String(date).trim();
    if (account !== undefined) updates.account = String(account).trim();

    const updated = await db.update(transactions)
      .set(updates)
      .where(and(
        eq(transactions.id, parseInt(id)),
        eq(transactions.userId, user.id)
      ))
      .returning();

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
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

    // Check if transaction exists and belongs to user before deleting
    const existing = await db.select()
      .from(transactions)
      .where(and(
        eq(transactions.id, parseInt(id)),
        eq(transactions.userId, user.id)
      ))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ 
        error: 'Transaction not found' 
      }, { status: 404 });
    }

    const deleted = await db.delete(transactions)
      .where(and(
        eq(transactions.id, parseInt(id)),
        eq(transactions.userId, user.id)
      ))
      .returning();

    return NextResponse.json({
      message: 'Transaction deleted successfully',
      transaction: deleted[0]
    });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}