import { users, properties, organizations, companies, companyRelations, userInvitations, leases, leaseTenants, tenants, type User, type InsertUser, type Property, type InsertProperty, type Organization, type InsertOrganization, type Company, type InsertCompany, type CompanyRelation, type InsertCompanyRelation, type UserInvitation, type InsertUserInvitation, type Lease, type InsertLease, type LeaseTenant, type InsertLeaseTenant, type Tenant, type InsertTenant } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sum, count, and, inArray } from "drizzle-orm";

export interface IStorage {
  // Organization methods
  createOrganization(org: InsertOrganization): Promise<Organization>;
  
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser & { organizationId: string }): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;
  hasAnyUsers(): Promise<boolean>;
  
  // Property methods
  getProperties(organizationId: string, userId?: string): Promise<Property[]>;
  getProperty(id: string, organizationId: string): Promise<Property | undefined>;
  createProperty(property: InsertProperty & { organizationId: string }): Promise<Property>;
  updateProperty(id: string, organizationId: string, updates: Partial<InsertProperty>): Promise<Property>;
  deleteProperty(id: string, organizationId: string): Promise<void>;
  
  // Company methods
  getCompanies(organizationId: string): Promise<Company[]>;
  getCompany(id: string, organizationId: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany & { organizationId: string }): Promise<Company>;
  updateCompany(id: string, organizationId: string, updates: Partial<InsertCompany>): Promise<Company>;
  deleteCompany(id: string, organizationId: string): Promise<void>;
  
  // Company relation methods
  getCompanyRelations(organizationId: string): Promise<CompanyRelation[]>;
  getParentRelations(companyId: string): Promise<CompanyRelation[]>;
  getChildRelations(companyId: string): Promise<CompanyRelation[]>;
  createCompanyRelation(relation: InsertCompanyRelation): Promise<CompanyRelation>;
  updateCompanyRelation(id: string, updates: Partial<InsertCompanyRelation>): Promise<CompanyRelation>;
  deleteCompanyRelation(id: string): Promise<void>;
  
  // User invitation methods
  createUserInvitation(invitation: InsertUserInvitation & { organizationId: string, invitedBy: string, token: string, expiresAt: Date }): Promise<UserInvitation>;
  getUserInvitation(token: string): Promise<UserInvitation | undefined>;
  getUserInvitationByEmail(email: string): Promise<UserInvitation | undefined>;
  getUserInvitations(organizationId: string): Promise<UserInvitation[]>;
  deleteUserInvitation(id: string): Promise<void>;
  
  // User management methods
  getUsersInOrganization(organizationId: string): Promise<User[]>;
  getUserByEmail(email: string): Promise<User | undefined>;
  updateUser(id: string, updates: Partial<{ role: "admin" | "user", assignedCompanyId: string | null }>): Promise<User>;
  deleteUser(id: string, organizationId: string): Promise<void>;
  
  // Lease methods
  getLeases(organizationId: string, userId?: string): Promise<(Lease & { property: Property })[]>;
  getLeasesByProperty(propertyId: string, organizationId: string): Promise<(Lease & { property: Property })[]>;
  getLease(id: string, organizationId: string): Promise<Lease | undefined>;
  createLease(lease: InsertLease & { organizationId: string }): Promise<Lease>;
  updateLease(id: string, organizationId: string, updates: Partial<InsertLease>): Promise<Lease>;
  deleteLease(id: string, organizationId: string): Promise<void>;
  
  // Tenant methods
  getTenants(organizationId: string): Promise<Tenant[]>;
  getTenant(id: string, organizationId: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant & { organizationId: string }): Promise<Tenant>;
  updateTenant(id: string, organizationId: string, updates: Partial<InsertTenant>): Promise<Tenant>;
  deleteTenant(id: string, organizationId: string): Promise<void>;
  
  // Lease tenant methods  
  getAllLeaseTenants(organizationId: string): Promise<(LeaseTenant & { tenant: Tenant })[]>;
  getLeaseTenants(leaseId: string): Promise<(LeaseTenant & { tenant: Tenant })[]>;
  getLeaseTenant(id: string): Promise<LeaseTenant | undefined>;
  createLeaseTenant(leaseTenant: InsertLeaseTenant & { organizationId: string }): Promise<LeaseTenant>;
  updateLeaseTenant(id: string, organizationId: string, updates: Partial<InsertLeaseTenant>): Promise<LeaseTenant>;
  deleteLeaseTenant(id: string, organizationId: string): Promise<void>;
  
  // Dashboard methods
  getPropertyStats(organizationId: string): Promise<{
    count: number;
    totalValue: string;
    latestProperty: Property | null;
    leaseStats: { count: number; totalRentCapacity: string };
  }>;
  getRecentProperties(organizationId: string, limit?: number): Promise<Property[]>;
  getRecentPropertiesWeighted(organizationId: string, userId: string, limit?: number): Promise<Property[]>;
  calculateWeightedStats(organizationId: string, userId: string): Promise<{
    count: number;
    totalValue: string;
    latestProperty: Property | null;
    leaseStats: { count: number; totalRentCapacity: string };
  }>;
}

export class DatabaseStorage implements IStorage {
  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [organization] = await db
      .insert(organizations)
      .values(org)
      .returning();
    return organization;
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser & { organizationId: string }): Promise<User> {
    // Set default dashboard view mode based on role
    const dashboardViewMode = insertUser.role === "admin" ? "total" : "weighted";
    
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        dashboardViewMode,
      })
      .returning();
    return user;
  }



  async hasAnyUsers(): Promise<boolean> {
    const [result] = await db.select({ count: count() }).from(users);
    return result.count > 0;
  }

  async getProperties(organizationId: string, userId?: string): Promise<Property[]> {
    // If no userId provided, return all properties (for admin access)
    if (!userId) {
      return await db
        .select()
        .from(properties)
        .where(eq(properties.organizationId, organizationId))
        .orderBy(desc(properties.createdAt));
    }

    // Get user and their assigned company
    const user = await this.getUser(userId);
    if (!user || !user.assignedCompanyId) {
      return []; // User has no assigned company, no access to properties
    }

    // Get all companies that the user's assigned company has ownership in (including transitive ownership)
    const accessibleCompanyIds = await this.getAccessibleCompanyIds(user.assignedCompanyId);
    
    if (accessibleCompanyIds.length === 0) {
      return []; // User has no ownership stake in any companies
    }

    // Get properties owned by companies the user has access to
    return await db
      .select()
      .from(properties)
      .where(
        and(
          eq(properties.organizationId, organizationId),
          inArray(properties.ownerCompanyId, accessibleCompanyIds)
        )
      )
      .orderBy(desc(properties.createdAt));
  }

  async getProperty(id: string, organizationId: string): Promise<Property | undefined> {
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, id));
    return property?.organizationId === organizationId ? property : undefined;
  }

  async createProperty(property: InsertProperty & { organizationId: string }): Promise<Property> {
    const propertyData = {
      ...property,
      acquisitionPrice: property.acquisitionPrice.toString(),
    };
    const [newProperty] = await db
      .insert(properties)
      .values(propertyData)
      .returning();
    return newProperty;
  }

  async updateProperty(id: string, organizationId: string, updates: Partial<InsertProperty>): Promise<Property> {
    const updateData: Record<string, any> = { ...updates };
    if (updates.acquisitionPrice !== undefined) {
      updateData.acquisitionPrice = updates.acquisitionPrice.toString();
    }
    
    const [property] = await db
      .update(properties)
      .set(updateData)
      .where(eq(properties.id, id))
      .returning();
    if (property?.organizationId !== organizationId) {
      throw new Error("Property not found");
    }
    return property;
  }

  async deleteProperty(id: string, organizationId: string): Promise<void> {
    const [property] = await db
      .select({ organizationId: properties.organizationId })
      .from(properties)
      .where(eq(properties.id, id));
    
    if (!property || property.organizationId !== organizationId) {
      throw new Error("Property not found");
    }
    
    await db
      .delete(properties)
      .where(eq(properties.id, id));
  }

  async getRecentProperties(organizationId: string, limit: number = 5): Promise<Property[]> {
    return await db
      .select()
      .from(properties)
      .where(eq(properties.organizationId, organizationId))
      .orderBy(desc(properties.acquisitionDate))
      .limit(limit);
  }

  async getRecentPropertiesWeighted(organizationId: string, userId: string, limit: number = 5): Promise<Property[]> {
    // Get user to find their assigned company (root company)
    const user = await this.getUser(userId);
    if (!user || !user.assignedCompanyId) {
      return [];
    }

    // Get all properties with owner companies
    const allProperties = await db
      .select({
        property: properties,
        ownerCompany: companies,
      })
      .from(properties)
      .leftJoin(companies, eq(properties.ownerCompanyId, companies.id))
      .where(eq(properties.organizationId, organizationId))
      .orderBy(desc(properties.acquisitionDate));

    // Get all company relations for this organization
    const allRelations = await db
      .select()
      .from(companyRelations)
      .innerJoin(companies, eq(companyRelations.parentCompanyId, companies.id))
      .where(eq(companies.organizationId, organizationId));

    // Filter properties where user has ownership > 0
    const filteredProperties = [];
    for (const { property, ownerCompany } of allProperties) {
      if (!ownerCompany) {
        // Skip properties without owner company
        continue;
      }

      // Calculate ownership weight from user's root company to this property owner
      const ownershipWeight = this.calculateOwnershipFromRoot(user.assignedCompanyId, ownerCompany.id, allRelations);
      
      if (ownershipWeight > 0) {
        filteredProperties.push(property);
      }

      if (filteredProperties.length >= limit) {
        break;
      }
    }

    return filteredProperties;
  }

  // Company methods
  async getCompanies(organizationId: string): Promise<Company[]> {
    return await db
      .select()
      .from(companies)
      .where(eq(companies.organizationId, organizationId))
      .orderBy(desc(companies.createdAt));
  }

  async getCompany(id: string, organizationId: string): Promise<Company | undefined> {
    const [company] = await db
      .select()
      .from(companies)
      .where(and(eq(companies.id, id), eq(companies.organizationId, organizationId)));
    return company || undefined;
  }

  async createCompany(company: InsertCompany & { organizationId: string }): Promise<Company> {
    const [newCompany] = await db
      .insert(companies)
      .values(company)
      .returning();
    return newCompany;
  }

  async updateCompany(id: string, organizationId: string, updates: Partial<InsertCompany>): Promise<Company> {
    const [company] = await db
      .update(companies)
      .set(updates)
      .where(and(eq(companies.id, id), eq(companies.organizationId, organizationId)))
      .returning();
    if (!company) {
      throw new Error("Selskab ikke fundet");
    }
    return company;
  }

  async deleteCompany(id: string, organizationId: string): Promise<void> {
    const result = await db
      .delete(companies)
      .where(and(eq(companies.id, id), eq(companies.organizationId, organizationId)));
    if (result.rowCount === 0) {
      throw new Error("Selskab ikke fundet");
    }
  }

  // Company relation methods
  async getCompanyRelations(organizationId: string): Promise<CompanyRelation[]> {
    const relations = await db
      .select({
        id: companyRelations.id,
        parentCompanyId: companyRelations.parentCompanyId,
        childCompanyId: companyRelations.childCompanyId,
        ownershipPercentage: companyRelations.ownershipPercentage,
        createdAt: companyRelations.createdAt,
      })
      .from(companyRelations)
      .innerJoin(companies, eq(companyRelations.parentCompanyId, companies.id))
      .where(eq(companies.organizationId, organizationId));
    return relations;
  }

  async getParentRelations(companyId: string): Promise<CompanyRelation[]> {
    return await db
      .select()
      .from(companyRelations)
      .where(eq(companyRelations.childCompanyId, companyId));
  }

  async getChildRelations(companyId: string): Promise<CompanyRelation[]> {
    return await db
      .select()
      .from(companyRelations)
      .where(eq(companyRelations.parentCompanyId, companyId));
  }

  async createCompanyRelation(relation: InsertCompanyRelation): Promise<CompanyRelation> {
    const relationData = {
      ...relation,
      ownershipPercentage: relation.ownershipPercentage.toString(),
    };
    const [newRelation] = await db
      .insert(companyRelations)
      .values(relationData)
      .returning();
    return newRelation;
  }

  async updateCompanyRelation(id: string, updates: Partial<InsertCompanyRelation>): Promise<CompanyRelation> {
    const updateData = updates.ownershipPercentage 
      ? { ...updates, ownershipPercentage: updates.ownershipPercentage.toString() }
      : updates;
      
    const [relation] = await db
      .update(companyRelations)
      .set(updateData)
      .where(eq(companyRelations.id, id))
      .returning();
    return relation;
  }

  async deleteCompanyRelation(id: string): Promise<void> {
    await db
      .delete(companyRelations)
      .where(eq(companyRelations.id, id));
  }

  // Lease methods
  async getLeases(organizationId: string, userId?: string): Promise<(Lease & { property: Property })[]> {
    // If no userId provided, return all leases (for admin access)
    if (!userId) {
      const result = await db
        .select({
          id: leases.id,
          propertyId: leases.propertyId,
          name: leases.name,
          registeredArea: leases.registeredArea,
          totalArea: leases.totalArea,
          vatRegistered: leases.vatRegistered,
          type: leases.type,
          maxRentPerSqm: leases.maxRentPerSqm,
          yieldRequirementPct: leases.yieldRequirementPct,
          organizationId: leases.organizationId,
          createdAt: leases.createdAt,
          property: properties
        })
        .from(leases)
        .innerJoin(properties, eq(leases.propertyId, properties.id))
        .where(eq(leases.organizationId, organizationId));
      
      return result.map(row => ({
        id: row.id,
        propertyId: row.propertyId,
        name: row.name,
        registeredArea: row.registeredArea,
        totalArea: row.totalArea,
        vatRegistered: row.vatRegistered,
        type: row.type,
        maxRentPerSqm: row.maxRentPerSqm,
        yieldRequirementPct: row.yieldRequirementPct,
        organizationId: row.organizationId,
        createdAt: row.createdAt,
        property: row.property
      }));
    }

    // Get user and their assigned company
    const user = await this.getUser(userId);
    if (!user || !user.assignedCompanyId) {
      return []; // User has no assigned company, no access to leases
    }

    // Get all companies that the user's assigned company has ownership in (including transitive ownership)
    const accessibleCompanyIds = await this.getAccessibleCompanyIds(user.assignedCompanyId);
    
    if (accessibleCompanyIds.length === 0) {
      return []; // User has no ownership stake in any companies
    }

    // Get leases for properties owned by companies the user has access to
    const result = await db
      .select({
        id: leases.id,
        propertyId: leases.propertyId,
        name: leases.name,
        registeredArea: leases.registeredArea,
        totalArea: leases.totalArea,
        vatRegistered: leases.vatRegistered,
        type: leases.type,
        maxRentPerSqm: leases.maxRentPerSqm,
        yieldRequirementPct: leases.yieldRequirementPct,
        organizationId: leases.organizationId,
        createdAt: leases.createdAt,
        property: properties
      })
      .from(leases)
      .innerJoin(properties, eq(leases.propertyId, properties.id))
      .where(
        and(
          eq(leases.organizationId, organizationId),
          inArray(properties.ownerCompanyId, accessibleCompanyIds)
        )
      );
    
    return result.map(row => ({
      id: row.id,
      propertyId: row.propertyId,
      name: row.name,
      registeredArea: row.registeredArea,
      totalArea: row.totalArea,
      vatRegistered: row.vatRegistered,
      type: row.type,
      maxRentPerSqm: row.maxRentPerSqm,
      yieldRequirementPct: row.yieldRequirementPct,
      organizationId: row.organizationId,
      createdAt: row.createdAt,
      property: row.property
    }));
  }

  // Helper method to get all company IDs that a company has ownership in (including transitive)
  private async getAccessibleCompanyIds(companyId: string): Promise<string[]> {
    const visitedCompanies = new Set<string>();
    const accessibleCompanies = new Set<string>();

    const traverseOwnership = async (currentCompanyId: string, currentOwnership: number = 100) => {
      if (visitedCompanies.has(currentCompanyId)) {
        return; // Prevent infinite loops
      }
      visitedCompanies.add(currentCompanyId);

      // If ownership is greater than 0%, include this company
      if (currentOwnership > 0) {
        accessibleCompanies.add(currentCompanyId);
      }

      // Get child companies (companies this company owns)
      const childRelations = await this.getChildRelations(currentCompanyId);
      
      for (const relation of childRelations) {
        const childOwnership = (currentOwnership * parseFloat(relation.ownershipPercentage)) / 100;
        await traverseOwnership(relation.childCompanyId, childOwnership);
      }
    };

    await traverseOwnership(companyId);
    return Array.from(accessibleCompanies);
  }

  async getLeasesByProperty(propertyId: string, organizationId: string): Promise<(Lease & { property: Property })[]> {
    return await db
      .select({
        id: leases.id,
        name: leases.name,
        propertyId: leases.propertyId,
        organizationId: leases.organizationId,
        type: leases.type,
        registeredArea: leases.registeredArea,
        totalArea: leases.totalArea,
        maxRentPerSqm: leases.maxRentPerSqm,
        yieldRequirementPct: leases.yieldRequirementPct,
        vatRegistered: leases.vatRegistered,
        createdAt: leases.createdAt,
        property: properties
      })
      .from(leases)
      .leftJoin(properties, eq(leases.propertyId, properties.id))
      .where(and(eq(leases.propertyId, propertyId), eq(leases.organizationId, organizationId)))
      .orderBy(desc(leases.createdAt));
  }

  async getLease(id: string, organizationId: string): Promise<(Lease & { property: Property }) | undefined> {
    const [lease] = await db
      .select({
        id: leases.id,
        propertyId: leases.propertyId,
        name: leases.name,
        registeredArea: leases.registeredArea,
        totalArea: leases.totalArea,
        vatRegistered: leases.vatRegistered,
        type: leases.type,
        maxRentPerSqm: leases.maxRentPerSqm,
        yieldRequirementPct: leases.yieldRequirementPct,
        organizationId: leases.organizationId,
        createdAt: leases.createdAt,
        property: {
          id: properties.id,
          name: properties.name,
          address: properties.address,
          postalCode: properties.postalCode,
          city: properties.city,
          acquisitionPrice: properties.acquisitionPrice,
          acquisitionDate: properties.acquisitionDate,
          propertyType: properties.propertyType,
          shareNumerator: properties.shareNumerator,
          shareDenominator: properties.shareDenominator,
          ownerCompanyId: properties.ownerCompanyId,
          organizationId: properties.organizationId,
          createdAt: properties.createdAt,
        }
      })
      .from(leases)
      .leftJoin(properties, eq(leases.propertyId, properties.id))
      .where(and(eq(leases.id, id), eq(leases.organizationId, organizationId)));
    return lease || undefined;
  }

  async createLease(lease: InsertLease & { organizationId: string }): Promise<Lease> {
    const leaseData = {
      ...lease,
      maxRentPerSqm: lease.maxRentPerSqm ? lease.maxRentPerSqm.toString() : null,
      yieldRequirementPct: lease.yieldRequirementPct ? lease.yieldRequirementPct.toString() : null,
    };
    const [newLease] = await db
      .insert(leases)
      .values(leaseData)
      .returning();
    return newLease;
  }

  async updateLease(id: string, organizationId: string, updates: Partial<InsertLease>): Promise<Lease> {
    const updateData = {
      ...updates,
      maxRentPerSqm: updates.maxRentPerSqm ? updates.maxRentPerSqm.toString() : undefined,
      yieldRequirementPct: updates.yieldRequirementPct ? updates.yieldRequirementPct.toString() : undefined,
    };
    
    const [lease] = await db
      .update(leases)
      .set(updateData)
      .where(and(eq(leases.id, id), eq(leases.organizationId, organizationId)))
      .returning();
    
    if (!lease) {
      throw new Error("Lejemål ikke fundet");
    }
    
    return lease;
  }

  async deleteLease(id: string, organizationId: string): Promise<void> {
    await db
      .delete(leases)
      .where(and(eq(leases.id, id), eq(leases.organizationId, organizationId)));
  }

  // Lease tenant methods
  async getAllLeaseTenants(organizationId: string): Promise<(LeaseTenant & { tenant: Tenant })[]> {
    const results = await db
      .select({
        id: leaseTenants.id,
        leaseId: leaseTenants.leaseId,
        tenantId: leaseTenants.tenantId,
        organizationId: leaseTenants.organizationId,
        rentAmount: leaseTenants.rentAmount,
        advanceWater: leaseTenants.advanceWater,
        advanceHeating: leaseTenants.advanceHeating,
        advanceElectricity: leaseTenants.advanceElectricity,
        advanceOther: leaseTenants.advanceOther,
        periodStart: leaseTenants.periodStart,
        periodEnd: leaseTenants.periodEnd,
        depositType: leaseTenants.depositType,
        depositAmount: leaseTenants.depositAmount,
        prepaidType: leaseTenants.prepaidType,
        prepaidAmount: leaseTenants.prepaidAmount,
        regulationType: leaseTenants.regulationType,
        note: leaseTenants.note,
        createdAt: leaseTenants.createdAt,
        tenant: {
          id: tenants.id,
          internalNumber: tenants.internalNumber,
          name: tenants.name,
          type: tenants.type,
          cvrNumber: tenants.cvrNumber,
          contactPerson: tenants.contactPerson,
          email: tenants.email,
          invoiceEmail: tenants.invoiceEmail,
          phone: tenants.phone,
          notes: tenants.notes,
          organizationId: tenants.organizationId,
          createdAt: tenants.createdAt,
        }
      })
      .from(leaseTenants)
      .leftJoin(tenants, eq(leaseTenants.tenantId, tenants.id))
      .where(eq(leaseTenants.organizationId, organizationId))
      .orderBy(desc(leaseTenants.periodStart));

    return results.filter(result => result.tenant && result.tenant.id !== null) as (LeaseTenant & { tenant: Tenant })[];
  }

  async getLeaseTenants(leaseId: string): Promise<(LeaseTenant & { tenant: Tenant })[]> {
    const results = await db
      .select({
        id: leaseTenants.id,
        leaseId: leaseTenants.leaseId,
        tenantId: leaseTenants.tenantId,
        organizationId: leaseTenants.organizationId,
        rentAmount: leaseTenants.rentAmount,
        advanceWater: leaseTenants.advanceWater,
        advanceHeating: leaseTenants.advanceHeating,
        advanceElectricity: leaseTenants.advanceElectricity,
        advanceOther: leaseTenants.advanceOther,
        periodStart: leaseTenants.periodStart,
        periodEnd: leaseTenants.periodEnd,
        depositType: leaseTenants.depositType,
        depositAmount: leaseTenants.depositAmount,
        prepaidType: leaseTenants.prepaidType,
        prepaidAmount: leaseTenants.prepaidAmount,
        regulationType: leaseTenants.regulationType,
        note: leaseTenants.note,
        createdAt: leaseTenants.createdAt,
        tenant: {
          id: tenants.id,
          internalNumber: tenants.internalNumber,
          name: tenants.name,
          type: tenants.type,
          cvrNumber: tenants.cvrNumber,
          contactPerson: tenants.contactPerson,
          email: tenants.email,
          invoiceEmail: tenants.invoiceEmail,
          phone: tenants.phone,
          notes: tenants.notes,
          organizationId: tenants.organizationId,
          createdAt: tenants.createdAt,
        }
      })
      .from(leaseTenants)
      .leftJoin(tenants, eq(leaseTenants.tenantId, tenants.id))
      .where(eq(leaseTenants.leaseId, leaseId))
      .orderBy(desc(leaseTenants.periodStart));

    return results.filter(result => result.tenant && result.tenant.id !== null) as (LeaseTenant & { tenant: Tenant })[];
  }

  async getLeaseTenant(id: string): Promise<LeaseTenant | undefined> {
    const [leaseTenant] = await db
      .select()
      .from(leaseTenants)
      .where(eq(leaseTenants.id, id));
    return leaseTenant || undefined;
  }





  async getPropertyStats(organizationId: string): Promise<{
    count: number;
    totalValue: string;
    latestProperty: Property | null;
    leaseStats: { count: number; totalRentCapacity: string };
  }> {
    const [statsResult] = await db
      .select({
        count: count(),
        totalValue: sum(properties.acquisitionPrice),
      })
      .from(properties)
      .where(eq(properties.organizationId, organizationId));

    const [latestProperty] = await db
      .select()
      .from(properties)
      .where(eq(properties.organizationId, organizationId))
      .orderBy(desc(properties.acquisitionDate))
      .limit(1);

    // Calculate lease statistics - for admin, show all leases
    const allLeases = await this.getLeases(organizationId);
    const leaseCount = allLeases.length;
    const totalArea = allLeases.reduce((sum, lease) => {
      const area = parseInt(lease.totalArea.toString()) || 0;
      return sum + area;
    }, 0);

    return {
      count: statsResult.count,
      totalValue: statsResult.totalValue || "0",
      latestProperty: latestProperty || null,
      leaseStats: {
        count: leaseCount,
        totalRentCapacity: totalArea.toString()
      }
    };
  }



  // User invitation methods
  async createUserInvitation(invitation: InsertUserInvitation & { organizationId: string, invitedBy: string, token: string, expiresAt: Date }): Promise<UserInvitation> {
    const [userInvitation] = await db
      .insert(userInvitations)
      .values(invitation)
      .returning();
    return userInvitation;
  }

  async getUserInvitation(token: string): Promise<UserInvitation | undefined> {
    const [invitation] = await db.select().from(userInvitations).where(eq(userInvitations.token, token));
    return invitation || undefined;
  }

  async getUserInvitationByEmail(email: string): Promise<UserInvitation | undefined> {
    const [invitation] = await db.select().from(userInvitations).where(eq(userInvitations.email, email));
    return invitation || undefined;
  }

  async getUserInvitations(organizationId: string): Promise<UserInvitation[]> {
    return await db
      .select()
      .from(userInvitations)
      .where(eq(userInvitations.organizationId, organizationId));
  }

  async deleteUserInvitation(id: string): Promise<void> {
    await db
      .delete(userInvitations)
      .where(eq(userInvitations.id, id));
  }

  // User management methods
  async getUsersInOrganization(organizationId: string): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.organizationId, organizationId));
  }

  async updateUser(id: string, updates: Partial<{ role: "admin" | "user", assignedCompanyId: string | null, dashboardViewMode: "total" | "weighted" }>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    
    if (!user) {
      throw new Error("Bruger ikke fundet");
    }
    
    return user;
  }

  async updateUserPreferences(userId: string, preferences: { dashboardViewMode: "total" | "weighted" }): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(preferences)
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async calculateWeightedStats(organizationId: string, userId: string): Promise<{
    count: number;
    totalValue: string;
    latestProperty: Property | null;
    leaseStats: { count: number; totalRentCapacity: string };
  }> {
    // Get user to find their assigned company (root company)
    const user = await this.getUser(userId);
    if (!user || !user.assignedCompanyId) {
      console.log('User has no assigned company, using total stats');
      return await this.getPropertyStats(organizationId);
    }

    // Get all properties for the organization
    const allProperties = await db
      .select({
        property: {
          id: properties.id,
          name: properties.name,
          address: properties.address,
          postalCode: properties.postalCode,
          city: properties.city,
          acquisitionPrice: properties.acquisitionPrice,
          acquisitionDate: properties.acquisitionDate,
          propertyType: properties.propertyType,
          shareNumerator: properties.shareNumerator,
          shareDenominator: properties.shareDenominator,
          ownerCompanyId: properties.ownerCompanyId,
          organizationId: properties.organizationId,
          createdAt: properties.createdAt,
        },
        ownerCompany: companies,
      })
      .from(properties)
      .leftJoin(companies, eq(properties.ownerCompanyId, companies.id))
      .where(eq(properties.organizationId, organizationId));

    if (allProperties.length === 0) {
      return { 
        count: 0, 
        totalValue: "0", 
        latestProperty: null,
        leaseStats: { count: 0, totalRentCapacity: "0" }
      };
    }

    // Get all company relations for this organization
    const allRelations = await db
      .select()
      .from(companyRelations)
      .innerJoin(companies, eq(companyRelations.parentCompanyId, companies.id))
      .where(eq(companies.organizationId, organizationId));
    
    // Calculate ownership weights for each property from the user's root company perspective
    let totalWeightedCount = 0;
    let totalWeightedValue = 0;

    for (const { property, ownerCompany } of allProperties) {
      if (!ownerCompany) {
        // Property without owner company - skip in weighted view
        continue;
      }

      // Calculate ownership weight from user's root company to this property owner
      const ownershipWeight = this.calculateOwnershipFromRoot(user.assignedCompanyId, ownerCompany.id, allRelations);
      
      totalWeightedCount += ownershipWeight;
      totalWeightedValue += parseFloat(property.acquisitionPrice) * ownershipWeight;
    }

    // Find latest property where user has ownership > 0
    let latestProperty = null;
    const sortedProperties = allProperties.sort((a, b) => {
      const dateA = a.property.acquisitionDate ? new Date(a.property.acquisitionDate).getTime() : 0;
      const dateB = b.property.acquisitionDate ? new Date(b.property.acquisitionDate).getTime() : 0;
      return dateB - dateA;
    });

    for (const { property, ownerCompany } of sortedProperties) {
      if (!ownerCompany) {
        continue;
      }
      
      const ownershipWeight = this.calculateOwnershipFromRoot(user.assignedCompanyId, ownerCompany.id, allRelations);
      if (ownershipWeight > 0) {
        latestProperty = property;
        break;
      }
    }

    // Calculate weighted lease statistics - filter by ownership
    const allLeases = await this.getLeases(organizationId, userId);
    let totalWeightedLeaseCount = 0;
    let totalWeightedArea = 0;

    for (const lease of allLeases) {
      const ownerCompany = allProperties.find(p => p.property.id === lease.propertyId)?.ownerCompany;
      if (!ownerCompany) continue;

      const ownershipWeight = this.calculateOwnershipFromRoot(user.assignedCompanyId, ownerCompany.id, allRelations);
      if (ownershipWeight > 0) {
        totalWeightedLeaseCount += ownershipWeight;
        
        const area = parseInt(lease.totalArea.toString()) || 0;
        totalWeightedArea += area * ownershipWeight;
      }
    }

    return {
      count: Math.round(totalWeightedCount * 100) / 100,
      totalValue: Math.round(totalWeightedValue).toString(),
      latestProperty,
      leaseStats: {
        count: Math.round(totalWeightedLeaseCount * 100) / 100,
        totalRentCapacity: Math.round(totalWeightedArea).toString()
      }
    };
  }

  private calculateOwnershipFromRoot(rootCompanyId: string, targetCompanyId: string, relations: any[]): number {
    if (rootCompanyId === targetCompanyId) {
      return 1.0;
    }

    // Find all relations where root company is parent (direct ownership)
    const directRelations = relations.filter(r => r.company_relations.parentCompanyId === rootCompanyId);
    
    let totalOwnership = 0;
    for (const relation of directRelations) {
      const childCompanyId = relation.company_relations.childCompanyId;
      const directPercentage = parseFloat(relation.company_relations.ownershipPercentage) / 100;
      
      if (childCompanyId === targetCompanyId) {
        // Direct ownership found
        totalOwnership += directPercentage;
      } else {
        // Recursive ownership through this child
        const indirectOwnership = this.calculateOwnershipFromRoot(childCompanyId, targetCompanyId, relations);
        totalOwnership += directPercentage * indirectOwnership;
      }
    }

    return totalOwnership;
  }

  async deleteUser(id: string, organizationId: string): Promise<void> {
    const [user] = await db
      .select({ organizationId: users.organizationId })
      .from(users)
      .where(eq(users.id, id));
    
    if (!user || user.organizationId !== organizationId) {
      throw new Error("Bruger ikke fundet");
    }
    
    await db
      .delete(users)
      .where(eq(users.id, id));
  }

  // Tenant methods implementation
  async getTenants(organizationId: string): Promise<Tenant[]> {
    return await db
      .select()
      .from(tenants)
      .where(eq(tenants.organizationId, organizationId))
      .orderBy(tenants.internalNumber);
  }

  async getTenant(id: string, organizationId: string): Promise<Tenant | undefined> {
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(and(eq(tenants.id, id), eq(tenants.organizationId, organizationId)));
    
    return tenant;
  }

  async createTenant(tenant: InsertTenant & { organizationId: string }): Promise<Tenant> {
    // Generate next internal number (starts at 1001)
    const lastTenant = await db
      .select({ internalNumber: tenants.internalNumber })
      .from(tenants)
      .where(eq(tenants.organizationId, tenant.organizationId))
      .orderBy(desc(tenants.internalNumber))
      .limit(1);

    const nextInternalNumber = lastTenant.length > 0 ? lastTenant[0].internalNumber + 1 : 1001;

    const [newTenant] = await db
      .insert(tenants)
      .values({
        ...tenant,
        internalNumber: nextInternalNumber,
      })
      .returning();

    return newTenant;
  }

  async updateTenant(id: string, organizationId: string, updates: Partial<InsertTenant>): Promise<Tenant> {
    const [updatedTenant] = await db
      .update(tenants)
      .set(updates)
      .where(and(eq(tenants.id, id), eq(tenants.organizationId, organizationId)))
      .returning();

    if (!updatedTenant) {
      throw new Error("Lejer ikke fundet");
    }

    return updatedTenant;
  }

  async deleteTenant(id: string, organizationId: string): Promise<void> {
    const result = await db
      .delete(tenants)
      .where(and(eq(tenants.id, id), eq(tenants.organizationId, organizationId)));
    
    if (result.rowCount === 0) {
      throw new Error("Lejer ikke fundet");
    }
  }

  // createLeaseTenant method with proper type conversion

  async createLeaseTenant(leaseTenant: InsertLeaseTenant & { organizationId: string }): Promise<LeaseTenant> {
    // Check for overlapping periods
    const existingTenants = await db
      .select()
      .from(leaseTenants)
      .where(eq(leaseTenants.leaseId, leaseTenant.leaseId));

    const newStart = new Date(leaseTenant.periodStart);
    const newEnd = leaseTenant.periodEnd ? new Date(leaseTenant.periodEnd) : null;

    for (const existing of existingTenants) {
      const existingStart = new Date(existing.periodStart);
      const existingEnd = existing.periodEnd ? new Date(existing.periodEnd) : null;

      // Check for overlap
      const startOverlap = newStart <= (existingEnd || new Date('2099-12-31'));
      const endOverlap = (newEnd || new Date('2099-12-31')) >= existingStart;
      
      if (startOverlap && endOverlap) {
        throw new Error("Lejeperioden overlapper med en eksisterende kontrakt");
      }
    }

    // Check for active tenant (only one active at a time)
    const today = new Date();
    const isCurrentContract = newStart <= today && (!newEnd || newEnd >= today);
    
    if (isCurrentContract) {
      const activeTenants = existingTenants.filter(tenant => {
        const start = new Date(tenant.periodStart);
        const end = tenant.periodEnd ? new Date(tenant.periodEnd) : null;
        return start <= today && (!end || end >= today);
      });

      if (activeTenants.length > 0) {
        throw new Error("Der er allerede en aktiv lejer for dette lejemål");
      }
    }

    const leaseTenantData = {
      ...leaseTenant,
      rentAmount: leaseTenant.rentAmount.toString(),
      advanceWater: leaseTenant.advanceWater?.toString() || null,
      advanceHeating: leaseTenant.advanceHeating?.toString() || null,
      advanceElectricity: leaseTenant.advanceElectricity?.toString() || null,
      advanceOther: leaseTenant.advanceOther?.toString() || null,
      depositAmount: leaseTenant.depositAmount?.toString() || null,
      prepaidAmount: leaseTenant.prepaidAmount?.toString() || null,
    };

    const [newLeaseTenant] = await db
      .insert(leaseTenants)
      .values(leaseTenantData)
      .returning();

    return newLeaseTenant;
  }

  async updateLeaseTenant(id: string, organizationId: string, updates: Partial<InsertLeaseTenant>): Promise<LeaseTenant> {
    const updateData = {
      ...updates,
      rentAmount: updates.rentAmount ? updates.rentAmount.toString() : undefined,
      advanceWater: updates.advanceWater ? updates.advanceWater.toString() : undefined,
      advanceHeating: updates.advanceHeating ? updates.advanceHeating.toString() : undefined,
      advanceElectricity: updates.advanceElectricity ? updates.advanceElectricity.toString() : undefined,
      advanceOther: updates.advanceOther ? updates.advanceOther.toString() : undefined,
      depositAmount: updates.depositAmount ? updates.depositAmount.toString() : undefined,
      prepaidAmount: updates.prepaidAmount ? updates.prepaidAmount.toString() : undefined,
    };
    
    const [updatedLeaseTenant] = await db
      .update(leaseTenants)
      .set(updateData)
      .where(and(eq(leaseTenants.id, id), eq(leaseTenants.organizationId, organizationId)))
      .returning();

    if (!updatedLeaseTenant) {
      throw new Error("Lejekontrakt ikke fundet");
    }

    return updatedLeaseTenant;
  }

  async deleteLeaseTenant(id: string, organizationId: string): Promise<void> {
    const result = await db
      .delete(leaseTenants)
      .where(and(eq(leaseTenants.id, id), eq(leaseTenants.organizationId, organizationId)));
    
    if (result.rowCount === 0) {
      throw new Error("Lejekontrakt ikke fundet");
    }
  }
}

export const storage = new DatabaseStorage();
