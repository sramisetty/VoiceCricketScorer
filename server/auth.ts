import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { users, userSessions } from '@shared/schema';
import { db } from './db';
import { eq } from 'drizzle-orm';

// JWT Secret - in production this should be from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

// Verify password
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

// Generate JWT token
export function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
}

// Verify JWT token
export function verifyToken(token: string): { userId: number } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number };
  } catch {
    return null;
  }
}

// Authentication middleware
export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(403).json({ error: 'Invalid or expired token' });
    return;
  }

  try {
    // Get user from database
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (!user || !user.isActive) {
      res.status(403).json({ error: 'User not found or inactive' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

// Optional authentication middleware (doesn't fail if no token)
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      try {
        const [user] = await db
          .select({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            role: users.role,
            isActive: users.isActive,
          })
          .from(users)
          .where(eq(users.id, decoded.userId))
          .limit(1);

        if (user && user.isActive) {
          req.user = user;
        }
      } catch (error) {
        console.error('Optional auth error:', error);
      }
    }
  }

  next();
}

// Role-based authorization middleware
export function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Map old roles to new roles for backward compatibility
    const normalizedRoles = roles.map(role => {
      if (role === 'admin') return 'global_admin';
      if (role === 'coach') return 'franchise_admin';
      if (role === 'user') return 'viewer';
      return role;
    });

    if (!normalizedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

// Check if user owns resource or has admin role
export function requireOwnershipOrAdmin(getResourceUserId: (req: AuthenticatedRequest) => number | Promise<number>) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    try {
      const resourceUserId = await getResourceUserId(req);
      
      if (req.user.role === 'global_admin' || req.user.role === 'admin' || req.user.id === resourceUserId) {
        next();
      } else {
        res.status(403).json({ error: 'Access denied' });
      }
    } catch (error) {
      console.error('Ownership check error:', error);
      res.status(500).json({ error: 'Authorization check failed' });
    }
  };
}