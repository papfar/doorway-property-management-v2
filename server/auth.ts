import bcrypt from "bcrypt";
import { storage } from "./storage";
import type { User } from "@shared/schema";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export async function authenticateUser(email: string, password: string): Promise<User | null> {
  const user = await storage.getUserByEmail(email);
  if (!user) {
    return null;
  }

  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    return null;
  }

  return user;
}

export function requireAuth(req: any, res: any, next: any) {
  console.log(`RequireAuth middleware for ${req.method} ${req.path}:`, {
    sessionId: req.sessionID,
    hasSession: !!req.session,
    userId: req.session?.userId
  });
  
  if (!req.session?.userId) {
    console.log(`Auth failed for ${req.method} ${req.path} - no userId in session`);
    return res.status(401).json({ message: "Ikke autoriseret" });
  }
  
  console.log(`Auth passed for ${req.method} ${req.path}`);
  next();
}

export async function getCurrentUser(req: any): Promise<User | null> {
  console.log("getCurrentUser called with session:", {
    sessionId: req.sessionID,
    hasSession: !!req.session,
    userId: req.session?.userId
  });
  
  if (!req.session?.userId) {
    console.log("No userId in session");
    return null;
  }
  
  const user = await storage.getUser(req.session.userId);
  console.log("Found user:", user ? { id: user.id, email: user.email, role: user.role } : 'not found');
  return user || null;
}

// Helper functions for role-based permissions
export function canWrite(user: User): boolean {
  return user.role === "admin" || user.role === "user";
}

export function isBroker(user: User): boolean {
  return user.role === "broker";
}

export function requireWriteAccess(req: any, res: any, next: any) {
  requireAuth(req, res, async () => {
    const user = await getCurrentUser(req);
    if (!user || !canWrite(user)) {
      return res.status(403).json({ message: "Kun læseadgang (Mægler)" });
    }
    next();
  });
}

// Anonymize tenant data for broker users
export function anonymizeTenantData(tenant: any, user: User) {
  if (!isBroker(user)) {
    return tenant; // Return original data for non-broker users
  }

  return {
    ...tenant,
    name: "Anonymiseret",
    cvrNumber: tenant.cvrNumber ? "********" : null,
    contactPerson: tenant.contactPerson ? "Anonymiseret" : null,
    phone: "*******",
    email: tenant.email ? `${tenant.email[0]}*****@*****` : null,
    invoiceEmail: tenant.invoiceEmail ? `${tenant.invoiceEmail[0]}*****@*****` : null,
    notes: tenant.notes ? "(Anonymiseret)" : null,
  };
}
