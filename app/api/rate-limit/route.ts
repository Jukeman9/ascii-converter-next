import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const RATE_LIMIT = 10; // requests per day
const RATE_LIMIT_FILE = path.join(process.cwd(), 'rate-limits.json');

interface RateLimitEntry {
  ip: string;
  count: number;
  lastReset: string;
}

// Initialize or load rate limit data
function getRateLimits(): Record<string, RateLimitEntry> {
  try {
    if (fs.existsSync(RATE_LIMIT_FILE)) {
      return JSON.parse(fs.readFileSync(RATE_LIMIT_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Error reading rate limit file:', error);
  }
  return {};
}

// Save rate limit data
function saveRateLimits(data: Record<string, RateLimitEntry>) {
  try {
    fs.writeFileSync(RATE_LIMIT_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving rate limit file:', error);
  }
}

// Check and update rate limit for an IP
function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const limits = getRateLimits();
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Clean up old entries
  Object.keys(limits).forEach(key => {
    if (limits[key].lastReset !== today) {
      delete limits[key];
    }
  });

  // Check current IP
  if (!limits[ip] || limits[ip].lastReset !== today) {
    limits[ip] = {
      ip,
      count: 0,
      lastReset: today
    };
  }

  const entry = limits[ip];
  const allowed = entry.count < RATE_LIMIT;
  
  if (allowed) {
    entry.count++;
    saveRateLimits(limits);
  }

  return {
    allowed,
    remaining: Math.max(0, RATE_LIMIT - entry.count)
  };
}

export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const result = checkRateLimit(ip);

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const result = checkRateLimit(ip);

  return NextResponse.json(result);
} 