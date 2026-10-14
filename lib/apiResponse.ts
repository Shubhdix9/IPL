import { NextResponse } from 'next/server';
import { checkRateLimit } from './rateLimit';

export function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export function handleOptions() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

export function jsonResponse(data: any, status: number = 200) {
  return NextResponse.json(data, {
    status,
    headers: corsHeaders(),
  });
}

export function errorResponse(error: any, defaultStatus: number = 400) {
  const status = error.statusCode || error.status || defaultStatus;
  const message = error.message || 'An unexpected error occurred.';
  return NextResponse.json(
    { error: message, success: false },
    { status, headers: corsHeaders() }
  );
}

export function enforceRateLimit(request: Request, limit: number = 120): NextResponse | null {
  const ip = request.headers.get('x-forwarded-for') || 'local-client';
  const result = checkRateLimit(ip, limit);
  if (!result.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.', success: false },
      { status: 429, headers: corsHeaders() }
    );
  }
  return null;
}
