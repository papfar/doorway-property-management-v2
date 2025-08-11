import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { hashPassword, authenticateUser, requireAuth, getCurrentUser, requireWriteAccess, anonymizeTenantData, isBroker } from "./auth";
import { insertUserSchema, insertPropertySchema, insertCompanySchema, insertCompanyRelationSchema, insertLeaseSchema, insertLeaseTenantSchema, insertTenantSchema, loginSchema, setupSchema, changePasswordSchema, userInviteSchema, type User, type Property, type Lease, type Tenant, type Company, type CompanyRelation, type UserInvitation, type LeaseTenant } from "@shared/schema";
import { verifyPassword } from "./auth";
import bcrypt from "bcrypt";
import session from "express-session";
import MemoryStore from "memorystore";
import { DANISH_POSTAL_CODES } from "./postal-codes";

const MemoryStoreSession = MemoryStore(session);

export async function registerRoutes(app: Express): Promise<Server> {
  // Session middleware
  app.use(session({
    store: new MemoryStoreSession({
      checkPeriod: 86400000 // 24 hours
    }),
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Use imported Danish postal codes data
  const postalCodesData = DANISH_POSTAL_CODES;

  // Postal code lookup
  app.get('/api/postal-codes/:code', (req, res) => {
    const { code } = req.params;
    const city = postalCodesData[code];
    
    if (city) {
      res.json({ city });
    } else {
      res.json({ city: null });
    }
  });

  // Check if setup is needed - always allow new organizations
  app.get('/api/setup/needed', async (req, res) => {
    try {
      res.json({ needed: true }); // Always allow new organizations
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Initial setup - create new organization and admin user
  app.post('/api/setup', async (req, res) => {
    try {
      const parsed = setupSchema.parse(req.body);
      const hashedPassword = await hashPassword(parsed.password);
      
      // Create organization first
      const organization = await storage.createOrganization({
        name: parsed.organizationName,
      });
      
      // Then create the admin user
      const user = await storage.createUser({
        name: parsed.name,
        email: parsed.email,
        password: hashedPassword,
        organizationId: organization.id,
      });

      (req.session as any).userId = user.id;
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Authentication routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const parsed = loginSchema.parse(req.body);
      const user = await authenticateUser(parsed.email, parsed.password);
      
      if (!user) {
        return res.status(401).json({ message: "Ugyldig e-mail eller adgangskode" });
      }

      (req.session as any).userId = user.id;
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Kunne ikke logge ud" });
      }
      res.json({ success: true });
    });
  });

  app.get('/api/auth/me', async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }
      
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // User preferences
  app.put("/api/user/preferences", requireAuth, async (req, res) => {
    try {
      const { dashboardViewMode } = req.body;
      
      if (!dashboardViewMode || !["total", "weighted"].includes(dashboardViewMode)) {
        return res.status(400).json({ message: "Ugyldig visningsform" });
      }

      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const updatedUser = await storage.updateUserPreferences(user.id, { dashboardViewMode });
      if (!updatedUser) {
        return res.status(404).json({ message: "Bruger ikke fundet" });
      }

      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating user preferences:", error);
      res.status(500).json({ message: "Server fejl" });
    }
  });

  // User routes
  app.put('/api/user/profile', requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const { name, email } = req.body;
      const updatedUser = await storage.updateUser(user.id, {});
      
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post('/api/user/change-password', requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const parsed = changePasswordSchema.parse(req.body);
      
      const isCurrentPasswordValid = await verifyPassword(parsed.currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "Nuværende adgangskode er forkert" });
      }

      const hashedNewPassword = await hashPassword(parsed.newPassword);
      await storage.updateUser(user.id, {});
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Property routes
  app.get('/api/properties', requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      // Brokers can see all properties, admins can see all properties, regular users only see properties they have ownership in
      const userId = (user.role === 'admin' || user.role === 'broker') ? undefined : user.id;
      const properties = await storage.getProperties(user.organizationId, userId);
      res.json(properties);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/properties/:id', requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const property = await storage.getProperty(req.params.id, user.organizationId);
      if (!property) {
        return res.status(404).json({ message: "Ejendom ikke fundet" });
      }

      res.json(property);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/properties', requireWriteAccess, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const parsed = insertPropertySchema.parse(req.body);
      const property = await storage.createProperty({ ...parsed, organizationId: user.organizationId });
      
      res.json(property);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put('/api/properties/:id', requireWriteAccess, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const parsed = insertPropertySchema.parse(req.body);
      const property = await storage.updateProperty(req.params.id, user.organizationId, parsed);
      
      res.json(property);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete('/api/properties/:id', requireWriteAccess, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      await storage.deleteProperty(req.params.id, user.organizationId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get leases for a specific property
  app.get('/api/properties/:id/leases', requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const leases = await storage.getLeasesByProperty(req.params.id, user.organizationId);
      res.json(leases);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Dashboard stats
  app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const isWeighted = user.dashboardViewMode === "weighted";
      
      let stats;
      if (isWeighted) {
        stats = await storage.calculateWeightedStats(user.organizationId, user.id);
      } else {
        stats = await storage.getPropertyStats(user.organizationId);
      }
      
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Recent activities
  app.get('/api/dashboard/recent', requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const isWeighted = user.dashboardViewMode === "weighted";
      let recentProperties;
      
      if (isWeighted && user.role === "user") {
        // For regular users in weighted mode, only show properties they have ownership in
        recentProperties = await storage.getRecentPropertiesWeighted(user.organizationId, user.id, 5);
      } else {
        // For admins, brokers, or total mode, show all properties
        recentProperties = await storage.getRecentProperties(user.organizationId, 5);
      }
      
      res.json(recentProperties);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Company endpoints
  app.get('/api/companies', requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const companies = await storage.getCompanies(user.organizationId);
      res.json(companies);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/companies/:id', requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const company = await storage.getCompany(req.params.id, user.organizationId);
      if (!company) {
        return res.status(404).json({ message: "Selskab ikke fundet" });
      }

      res.json(company);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/companies', requireWriteAccess, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const parsed = insertCompanySchema.parse(req.body);
      const company = await storage.createCompany({ ...parsed, organizationId: user.organizationId });
      
      console.log('Created company:', company);
      res.json(company);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put('/api/companies/:id', requireWriteAccess, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const parsed = insertCompanySchema.parse(req.body);
      const company = await storage.updateCompany(req.params.id, user.organizationId, parsed);
      
      res.json(company);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete('/api/companies/:id', requireWriteAccess, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      await storage.deleteCompany(req.params.id, user.organizationId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Company relations endpoints
  app.get('/api/company-relations', requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const relations = await storage.getCompanyRelations(user.organizationId);
      res.json(relations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/companies/:id/relations', requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const parentRelations = await storage.getParentRelations(req.params.id);
      const childRelations = await storage.getChildRelations(req.params.id);
      
      res.json({ parentRelations, childRelations });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/company-relations', requireWriteAccess, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      // Simple validation without complex schema
      const { parentCompanyId, childCompanyId, ownershipPercentage } = req.body;
      
      console.log('Company relation data:', JSON.stringify({ parentCompanyId, childCompanyId, ownershipPercentage }, null, 2));
      
      if (!parentCompanyId || !childCompanyId || ownershipPercentage === undefined) {
        return res.status(400).json({ 
          message: "Manglende påkrævede felter",
          received: { parentCompanyId, childCompanyId, ownershipPercentage }
        });
      }

      if (ownershipPercentage < 0.01 || ownershipPercentage > 100) {
        return res.status(400).json({ message: "Ejerskabsprocent skal være mellem 0.01 og 100" });
      }
      
      // Verify both companies belong to the user's organization
      const parentCompany = await storage.getCompany(parentCompanyId, user.organizationId);
      const childCompany = await storage.getCompany(childCompanyId, user.organizationId);
      
      if (!parentCompany || !childCompany) {
        return res.status(404).json({ message: "Selskab ikke fundet" });
      }

      // Check if adding this ownership would exceed 100% for the child company
      const existingParentRelations = await storage.getParentRelations(childCompanyId);
      const currentTotalPercentage = existingParentRelations.reduce((sum, rel) => 
        sum + parseFloat(rel.ownershipPercentage), 0);
      const newTotalPercentage = currentTotalPercentage + parseFloat(ownershipPercentage);
      
      console.log('Current total percentage for child:', currentTotalPercentage);
      console.log('New total percentage would be:', newTotalPercentage);
      
      if (newTotalPercentage > 100) {
        return res.status(400).json({ 
          message: `Den samlede ejerskabsprocent vil blive ${newTotalPercentage.toFixed(1)}%, hvilket overskrider 100%. Der er allerede ${currentTotalPercentage.toFixed(1)}% ejerskab registreret.`
        });
      }

      const relationData = {
        parentCompanyId,
        childCompanyId,
        ownershipPercentage: parseFloat(ownershipPercentage).toString()
      };

      const relation = await storage.createCompanyRelation(relationData);
      res.json(relation);
    } catch (error: any) {
      console.error('Error creating company relation:', error);
      res.status(400).json({ message: error.message });
    }
  });

  app.put('/api/company-relations/:id', requireWriteAccess, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const { ownershipPercentage } = req.body;
      
      if (!ownershipPercentage || ownershipPercentage < 0.01 || ownershipPercentage > 100) {
        return res.status(400).json({ message: "Ejerskabsprocent skal være mellem 0.01 og 100" });
      }

      const relation = await storage.updateCompanyRelation(req.params.id, { ownershipPercentage: ownershipPercentage.toString() });
      res.json(relation);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete('/api/company-relations/:id', requireWriteAccess, async (req, res) => {
    try {
      await storage.deleteCompanyRelation(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // User management endpoints
  app.get('/api/users', requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      if (!user || (user.role !== 'admin' && user.role !== 'broker')) {
        return res.status(403).json({ message: "Kun administratorer og mæglere kan se brugere" });
      }

      const users = await storage.getUsersInOrganization(user.organizationId);
      const usersWithCompany = await Promise.all(
        users.map(async (u) => {
          let assignedCompany = null;
          if (u.assignedCompanyId) {
            assignedCompany = await storage.getCompany(u.assignedCompanyId, user.organizationId);
          }
          return { ...u, assignedCompany };
        })
      );

      res.json(usersWithCompany);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/users/invite', requireWriteAccess, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      // Write access middleware already checked this

      const { email, role, assignedCompanyId } = req.body;

      // Check if email already exists as a user
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "En bruger med denne e-mail eksisterer allerede" });
      }

      // Check if there's already a pending invitation for this email
      const existingInvitation = await storage.getUserInvitationByEmail(email);
      if (existingInvitation) {
        return res.status(400).json({ message: "Der er allerede sendt en invitation til denne e-mail" });
      }

      // Generate unique token and expiration date
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

      const invitation = await storage.createUserInvitation({
        email,
        role,
        assignedCompanyId,
        organizationId: user.organizationId,
        invitedBy: user.id,
        token,
        expiresAt,
      });

      // In a real app, you would send an email here with the invitation link
      console.log(`Invitation created for ${email} with token: ${token}`);
      
      res.json({ 
        invitation,
        invitationLink: `${req.protocol}://${req.headers.host}/invitation?token=${token}`
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get('/api/users/invitations', requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      if (!user || (user.role !== 'admin' && user.role !== 'broker')) {
        return res.status(403).json({ message: "Kun administratorer og mæglere kan se invitationer" });
      }

      const invitations = await storage.getUserInvitations(user.organizationId);
      res.json(invitations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/users/invitations/:id', requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Kun administratorer kan slette invitationer" });
      }

      await storage.deleteUserInvitation(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Verify invitation token
  app.get('/api/users/invitation/verify/:token', async (req, res) => {
    try {
      const { token } = req.params;
      const invitation = await storage.getUserInvitation(token);
      
      if (!invitation || invitation.expiresAt < new Date()) {
        return res.status(404).json({ message: "Invitation ikke fundet eller udløbet" });
      }

      res.json(invitation);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Accept invitation and create user account
  app.post('/api/users/invitation/accept', async (req, res) => {
    try {
      const { token, name, password } = req.body;
      
      if (!token || !name || !password) {
        return res.status(400).json({ message: "Token, navn og adgangskode er påkrævet" });
      }

      const invitation = await storage.getUserInvitation(token);
      
      if (!invitation || invitation.expiresAt < new Date()) {
        return res.status(404).json({ message: "Invitation ikke fundet eller udløbet" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(invitation.email);
      if (existingUser) {
        return res.status(400).json({ message: "En bruger med denne email eksisterer allerede" });
      }

      // Create new user
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await storage.createUser({
        name,
        email: invitation.email,
        password: hashedPassword,
        role: invitation.role,
        organizationId: invitation.organizationId,
        assignedCompanyId: invitation.assignedCompanyId,
      });

      // Delete the invitation after successful account creation
      await storage.deleteUserInvitation(invitation.id);

      res.json({ 
        message: "Konto oprettet succesfuldt",
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put('/api/users/:id', requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Kun administratorer kan redigere brugere" });
      }

      const { role, assignedCompanyId } = req.body;
      const targetUserId = req.params.id;

      // Prevent admin from changing their own role to user if they're the only admin
      if (targetUserId === user.id && role === 'user') {
        const allUsers = await storage.getUsersInOrganization(user.organizationId);
        const adminCount = allUsers.filter(u => u.role === 'admin').length;
        if (adminCount === 1) {
          return res.status(400).json({ message: "Du kan ikke ændre din egen rolle når du er den eneste administrator" });
        }
      }

      const updatedUser = await storage.updateUser(targetUserId, {
        role,
        assignedCompanyId: assignedCompanyId || null
      });

      res.json(updatedUser);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete('/api/users/:id', requireWriteAccess, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Kun administratorer kan slette brugere" });
      }

      const targetUserId = req.params.id;

      // Prevent admin from deleting themselves if they're the only admin
      if (targetUserId === user.id) {
        const allUsers = await storage.getUsersInOrganization(user.organizationId);
        const adminCount = allUsers.filter(u => u.role === 'admin').length;
        if (adminCount === 1) {
          return res.status(400).json({ message: "Du kan ikke slette dig selv når du er den eneste administrator" });
        }
      }

      await storage.deleteUser(targetUserId, user.organizationId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Company relations endpoints
  app.get('/api/companies/:id/parents', requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const relations = await storage.getParentRelations(req.params.id);
      res.json(relations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/companies/:id/children', requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const relations = await storage.getChildRelations(req.params.id);
      res.json(relations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Lease endpoints
  app.get('/api/leases', requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      // Brokers and admins can see all leases, regular users only see leases for properties they have ownership in
      const userId = (user.role === 'admin' || user.role === 'broker') ? undefined : user.id;
      const leases = await storage.getLeases(user.organizationId, userId);
      res.json(leases);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/leases/:id', requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const lease = await storage.getLease(req.params.id, user.organizationId);
      if (!lease) {
        return res.status(404).json({ message: "Lejemål ikke fundet" });
      }
      
      res.json(lease);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/leases', requireWriteAccess, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const parsed = insertLeaseSchema.parse(req.body);
      const lease = await storage.createLease({ 
        ...parsed, 
        organizationId: user.organizationId 
      });
      
      res.json(lease);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch('/api/leases/:id', requireWriteAccess, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const parsed = insertLeaseSchema.partial().parse(req.body);
      const lease = await storage.updateLease(req.params.id, user.organizationId, parsed);
      
      res.json(lease);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete('/api/leases/:id', requireWriteAccess, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      await storage.deleteLease(req.params.id, user.organizationId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Lease tenant endpoints
  app.get('/api/leases/:leaseId/tenants', requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      // Verify lease belongs to user's organization
      const lease = await storage.getLease(req.params.leaseId, user.organizationId);
      if (!lease) {
        return res.status(404).json({ message: "Lejemål ikke fundet" });
      }

      const tenants = await storage.getLeaseTenants(req.params.leaseId);
      
      // Anonymize tenant data for broker users
      const processedTenants = tenants.map(tenant => {
        if (tenant.tenant) {
          const anonymizedTenant = anonymizeTenantData(tenant.tenant, user);
          return { ...tenant, tenant: anonymizedTenant };
        }
        return tenant;
      });
      
      res.json(processedTenants);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/lease-tenants', requireWriteAccess, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const parsed = insertLeaseTenantSchema.parse(req.body);
      
      // Verify lease belongs to user's organization
      const lease = await storage.getLease(parsed.leaseId, user.organizationId);
      if (!lease) {
        return res.status(404).json({ message: "Lejemål ikke fundet" });
      }

      const leaseTenant = await storage.createLeaseTenant({ 
        ...parsed, 
        organizationId: user.organizationId 
      });
      
      res.json(leaseTenant);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });



  app.delete('/api/lease-tenants/:id', requireWriteAccess, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      await storage.deleteLeaseTenant(req.params.id, user.organizationId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Tenant routes
  app.get("/api/tenants", requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const tenants = await storage.getTenants(user.organizationId);
      
      // Anonymize tenant data for broker users
      const processedTenants = tenants.map(tenant => anonymizeTenantData(tenant, user));
      
      res.json(processedTenants);
    } catch (error: any) {
      console.error("Error fetching tenants:", error);
      res.status(500).json({ message: "Fejl ved hentning af lejere" });
    }
  });

  app.get("/api/tenants/:id", requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const tenant = await storage.getTenant(req.params.id, user.organizationId);
      if (!tenant) {
        return res.status(404).json({ message: "Lejer ikke fundet" });
      }
      
      // Anonymize tenant data for broker users
      const processedTenant = anonymizeTenantData(tenant, user);
      
      res.json(processedTenant);
    } catch (error: any) {
      console.error("Error fetching tenant:", error);
      res.status(500).json({ message: "Fejl ved hentning af lejer" });
    }
  });

  app.post("/api/tenants", requireWriteAccess, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const parsedData = insertTenantSchema.parse(req.body);
      const tenant = await storage.createTenant({ ...parsedData, organizationId: user.organizationId });
      res.json(tenant);
    } catch (error: any) {
      console.error("Error creating tenant:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ message: error.errors });
      } else {
        res.status(500).json({ message: "Fejl ved oprettelse af lejer" });
      }
    }
  });

  app.put("/api/tenants/:id", requireWriteAccess, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const parsedData = insertTenantSchema.parse(req.body);
      const tenant = await storage.updateTenant(req.params.id, user.organizationId, parsedData);
      res.json(tenant);
    } catch (error: any) {
      console.error("Error updating tenant:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ message: error.errors });
      } else {
        res.status(500).json({ message: "Fejl ved opdatering af lejer" });
      }
    }
  });

  app.delete("/api/tenants/:id", requireWriteAccess, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      await storage.deleteTenant(req.params.id, user.organizationId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting tenant:", error);
      res.status(500).json({ message: "Fejl ved sletning af lejer" });
    }
  });

  // Tenant routes
  app.get("/api/tenants", requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const tenants = await storage.getTenants(user.organizationId);
      res.json(tenants);
    } catch (error) {
      console.error("Error fetching tenants:", error);
      res.status(500).json({ message: "Der opstod en fejl ved hentning af lejere" });
    }
  });

  app.post("/api/tenants", requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Kun administratorer kan oprette lejere" });
      }

      const data = insertTenantSchema.parse(req.body);
      
      const tenant = await storage.createTenant({
        ...data,
        organizationId: user.organizationId,
      });
      
      res.json(tenant);
    } catch (error) {
      console.error("Error creating tenant:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Ugyldige data", errors: error.errors });
      } else {
        res.status(500).json({ message: (error as any).message || "Der opstod en fejl ved oprettelse af lejer" });
      }
    }
  });

  app.patch("/api/tenants/:id", requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Kun administratorer kan redigere lejere" });
      }

      const data = insertTenantSchema.partial().parse(req.body);
      
      const tenant = await storage.updateTenant(req.params.id, user.organizationId, data);
      res.json(tenant);
    } catch (error) {
      console.error("Error updating tenant:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Ugyldige data", errors: error.errors });
      } else {
        res.status(500).json({ message: (error as any).message || "Der opstod en fejl ved opdatering af lejer" });
      }
    }
  });

  app.delete("/api/tenants/:id", requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Kun administratorer kan slette lejere" });
      }

      await storage.deleteTenant(req.params.id, user.organizationId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting tenant:", error);
      res.status(500).json({ message: (error as any).message || "Der opstod en fejl ved sletning af lejer" });
    }
  });



  // Lease tenant routes
  // Get all lease tenants for overview
  app.get('/api/all-lease-tenants', requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const allLeaseTenants = await storage.getAllLeaseTenants(user.organizationId);
      res.json(allLeaseTenants);
    } catch (error) {
      console.error("Error fetching all lease tenants:", error);
      res.status(500).json({ message: "Kunne ikke hente lejekontakter" });
    }
  });

  app.get("/api/leases/:leaseId/tenants", requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const leaseTenants = await storage.getLeaseTenants(req.params.leaseId);
      res.json(leaseTenants);
    } catch (error) {
      console.error("Error fetching lease tenants:", error);
      res.status(500).json({ message: "Der opstod en fejl ved hentning af lejekontakter" });
    }
  });

  app.post("/api/lease-tenants", requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      const data = insertLeaseTenantSchema.parse(req.body);
      
      const leaseTenant = await storage.createLeaseTenant({
        ...data,
        organizationId: user.organizationId,
      });
      
      res.json(leaseTenant);
    } catch (error) {
      console.error("Error creating lease tenant:", error);
      console.error("Request body:", JSON.stringify(req.body, null, 2));
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", JSON.stringify(error.errors, null, 2));
        // Show all validation errors
        const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        res.status(400).json({ 
          message: `Valideringsfejl: ${errorMessages.join(', ')}`,
          details: error.errors 
        });
      } else {
        res.status(500).json({ message: (error as any).message || "Der opstod en fejl ved oprettelse af lejekontrakt" });
      }
    }
  });

  app.patch("/api/lease-tenants/:id", requireAuth, async (req: any, res) => {
    console.log("=== PATCH HANDLER START ===");
    console.log("PATCH request received for lease tenant:", req.params.id);
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    
    try {
      
      const user = await getCurrentUser(req);
      if (!user) {
        console.log("No user found in request");
        return res.status(401).json({ message: "Ikke autoriseret" });
      }
      
      console.log("User found:", user.id, user.role);

      // Parse using the shared schema - it handles the transformations correctly
      console.log("Before validation - request body:", JSON.stringify(req.body, null, 2));
      
      try {
        const data = insertLeaseTenantSchema.parse(req.body);
        console.log("Validation successful, parsed data:", JSON.stringify(data, null, 2));
      } catch (validationError) {
        console.log("Validation failed with error:", validationError);
        if (validationError instanceof z.ZodError) {
          console.log("Detailed validation errors:", JSON.stringify(validationError.errors, null, 2));
        }
        throw validationError;
      }
      
      const data = insertLeaseTenantSchema.parse(req.body);
      
      const leaseTenant = await storage.updateLeaseTenant(req.params.id, user.organizationId, data);
      res.json(leaseTenant);
    } catch (error: any) {
      console.error("=== ERROR IN PATCH HANDLER ===");
      console.error("Error updating lease tenant:", error);
      console.error("Error stack:", error.stack);
      console.error("Request body:", JSON.stringify(req.body, null, 2));
      
      if (error instanceof z.ZodError) {
        console.error("Zod validation errors:", JSON.stringify(error.errors, null, 2));
        const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        const response = { 
          message: `Valideringsfejl: ${errorMessages.join(', ')}`,
          details: error.errors 
        };
        console.error("Sending 400 response:", response);
        res.status(400).json(response);
      } else {
        console.error("Non-Zod error, sending 500");
        res.status(500).json({ message: error.message || "Der opstod en fejl ved opdatering af lejekontrakt" });
      }
    }
    console.log("=== PATCH HANDLER END ===");
  });

  app.delete("/api/lease-tenants/:id", requireAuth, async (req: any, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Ikke autoriseret" });
      }

      await storage.deleteLeaseTenant(req.params.id, user.organizationId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting lease tenant:", error);
      res.status(500).json({ message: error.message || "Der opstod en fejl ved sletning af lejekontrakt" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
