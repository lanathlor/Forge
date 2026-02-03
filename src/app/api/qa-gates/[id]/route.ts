import { NextResponse } from 'next/server';
import { db } from '@/db';
import { qaGateConfigs } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * PUT /api/qa-gates/:id
 * Update QA gate configuration
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await request.json();

    const gate = await db
      .update(qaGateConfigs)
      .set({
        name: data.name,
        enabled: data.enabled,
        command: data.command,
        timeout: data.timeout,
        failOnError: data.failOnError,
        order: data.order,
        updatedAt: new Date(),
      })
      .where(eq(qaGateConfigs.id, id))
      .returning()
      .get();

    return NextResponse.json({ gate });
  } catch (error) {
    console.error('Error updating QA gate:', error);
    return NextResponse.json(
      { error: 'Failed to update QA gate' },
      { status: 500 }
    );
  }
}
