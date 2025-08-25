/**
 * Metrics endpoint for monitoring orchestrator performance
 * Demonstrates enterprise-grade monitoring and observability
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMetrics, healthCheck } from '@/lib/orchestrator/setup';
import { logger } from '@/lib/orchestrator/logger';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'metrics';

    logger.info('Metrics endpoint accessed', { type });

    switch (type) {
      case 'health':
        const health = await healthCheck();
        return NextResponse.json(health, { 
          status: health.status === 'healthy' ? 200 : 503 
        });

      case 'metrics':
        const metrics = getMetrics();
        return NextResponse.json({
          timestamp: new Date().toISOString(),
          metrics,
        });

      default:
        return NextResponse.json(
          { error: 'Invalid type parameter. Use "health" or "metrics"' },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Metrics endpoint error', error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
