import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, date, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["admin", "user", "broker"] }).notNull().default("user"),
  assignedCompanyId: varchar("assigned_company_id").references(() => companies.id, { onDelete: "set null" }),
  dashboardViewMode: text("dashboard_view_mode", { enum: ["total", "weighted"] }).notNull().default("weighted"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  cvrNumber: integer("cvr_number"),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const companyRelations = pgTable("company_relations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parentCompanyId: varchar("parent_company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  childCompanyId: varchar("child_company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  ownershipPercentage: decimal("ownership_percentage", { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// User invitations table for pending user invites
export const userInvitations = pgTable("user_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  invitedBy: varchar("invited_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  assignedCompanyId: varchar("assigned_company_id").references(() => companies.id, { onDelete: "set null" }),
  role: text("role", { enum: ["admin", "user", "broker"] }).notNull().default("user"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const properties = pgTable("properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address").notNull(),
  postalCode: text("postal_code").notNull(),
  city: text("city").notNull(),
  acquisitionPrice: decimal("acquisition_price", { precision: 12, scale: 2 }).notNull(),
  acquisitionDate: date("acquisition_date"),
  propertyType: text("property_type").notNull(), // 'ejerlejlighed' | 'samlet_fast_ejendom'
  shareNumerator: integer("share_numerator"),
  shareDenominator: integer("share_denominator"),
  ownerCompanyId: varchar("owner_company_id").references(() => companies.id, { onDelete: "set null" }),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tenants (Lejere)
export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  internalNumber: integer("internal_number").notNull().unique(), // Auto-incrementing from 1001
  name: text("name").notNull(),
  type: text("type", { enum: ["privat", "erhverv"] }).notNull(),
  cvrNumber: text("cvr_number"), // Only for "erhverv"
  contactPerson: text("contact_person"), // Only for "erhverv"
  email: text("email").notNull(),
  invoiceEmail: text("invoice_email"), // Optional
  phone: text("phone").notNull(),
  notes: text("notes"), // Optional
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Leases (Lejemål)
export const leases = pgTable("leases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g. "Vesterbrogade 97, 3.th"
  registeredArea: integer("registered_area").notNull(), // tinglyst_areal (heltal)
  totalArea: integer("total_area").notNull(), // samlet_areal (heltal)
  vatRegistered: boolean("vat_registered").notNull().default(false), // momsregisteret
  type: text("type", { 
    enum: ["Bolig", "Detail", "Kontor", "Lager", "Garage", "Industri"] 
  }).notNull().default("Bolig"),
  maxRentPerSqm: decimal("max_rent_per_sqm", { precision: 8, scale: 2 }), // max_leje_pr_m2
  yieldRequirementPct: decimal("yield_requirement_pct", { precision: 5, scale: 2 }), // afkastkrav_pct
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Lease Tenants (relation between leases and tenants with contract details)
export const leaseTenants = pgTable("lease_tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leaseId: varchar("lease_id").notNull().references(() => leases.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  rentAmount: decimal("rent_amount", { precision: 10, scale: 2 }).notNull(), // leje_beloeb
  advanceWater: decimal("advance_water", { precision: 8, scale: 2 }), // aconto_vand (optional)
  advanceHeating: decimal("advance_heating", { precision: 8, scale: 2 }), // aconto_varme (optional)
  advanceElectricity: decimal("advance_electricity", { precision: 8, scale: 2 }), // aconto_el (optional)
  advanceOther: decimal("advance_other", { precision: 8, scale: 2 }), // aconto_oevrig (optional)
  periodStart: date("period_start").notNull(), // periode_start
  periodEnd: date("period_end"), // periode_slut (optional)
  depositType: text("deposit_type", { 
    enum: ["none", "1_month", "2_months", "3_months", "4_months", "5_months", "6_months", "amount"] 
  }).notNull().default("none"), // depositum_type
  depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }), // depositum_beloeb
  prepaidType: text("prepaid_type", { 
    enum: ["none", "1_month", "2_months", "3_months", "4_months", "5_months", "6_months", "amount"] 
  }).notNull().default("none"), // forudbetalt_type
  prepaidAmount: decimal("prepaid_amount", { precision: 10, scale: 2 }), // forudbetalt_beloeb
  regulationType: text("regulation_type", { 
    enum: ["none", "NPI", "NPI_min_1", "NPI_min_2", "NPI_min_3"] 
  }).notNull().default("none"), // regulering
  note: text("note"), // optional note
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  organizationId: true,
  createdAt: true,
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  organizationId: true,
  createdAt: true,
}).extend({
  cvrNumber: z.coerce.number().int().min(10000000).max(99999999).optional().or(z.literal(null)),
}).refine((data) => {
  if (data.cvrNumber !== null && data.cvrNumber !== undefined) {
    const cvrStr = data.cvrNumber.toString();
    return cvrStr.length === 8;
  }
  return true;
}, {
  message: "CVR-nummer skal være præcis 8 cifre",
  path: ["cvrNumber"],
});

export const insertCompanyRelationSchema = createInsertSchema(companyRelations).omit({
  id: true,
  createdAt: true,
});

export const insertUserInvitationSchema = createInsertSchema(userInvitations).omit({
  id: true,
  token: true,
  organizationId: true,
  invitedBy: true,
  expiresAt: true,
  createdAt: true,
});

export const userInviteSchema = z.object({
  email: z.string().email("Ugyldig e-mail adresse"),
  role: z.enum(["admin", "user", "broker"], { required_error: "Rolle skal vælges" }),
  assignedCompanyId: z.string().optional().or(z.literal(null)),
});

export const insertPropertySchema = createInsertSchema(properties).omit({
  id: true,
  organizationId: true,
  createdAt: true,
}).extend({
  postalCode: z.string().regex(/^\d{4}$/, "Postnummer skal være 4 cifre"),
  acquisitionPrice: z.coerce.number().min(0, "Anskaffelsessum skal være 0 eller højere"),
  shareNumerator: z.coerce.number().int().min(1).optional(),
  shareDenominator: z.coerce.number().int().min(1).optional(),
  ownerCompanyId: z.string().optional().or(z.literal(null)),
}).refine((data) => {
  if (data.propertyType === 'ejerlejlighed') {
    return data.shareNumerator && data.shareDenominator;
  }
  return true;
}, {
  message: "Fordelingstal (tæller og nævner) er påkrævet for ejerlejligheder",
  path: ["shareNumerator"],
});

export const loginSchema = z.object({
  email: z.string().email("Ugyldig e-mail adresse"),
  password: z.string().min(1, "Adgangskode påkrævet"),
});

export const setupSchema = insertUserSchema.extend({
  organizationName: z.string().min(1, "Virksomhedsnavn påkrævet"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Adgangskoder stemmer ikke overens",
  path: ["confirmPassword"],
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Nuværende adgangskode påkrævet"),
  newPassword: z.string().min(8, "Ny adgangskode skal være mindst 8 tegn"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Nye adgangskoder stemmer ikke overens",
  path: ["confirmPassword"],
});

// Helper function to parse Danish decimal format
const danishDecimal = () => z.string().optional().transform((val) => {
  if (!val) return undefined;
  // Convert Danish comma to English decimal point
  const normalized = val.replace(',', '.');
  const parsed = parseFloat(normalized);
  if (isNaN(parsed)) return undefined;
  return parsed;
});

export const insertLeaseSchema = createInsertSchema(leases).omit({
  id: true,
  organizationId: true,
  createdAt: true,
}).extend({
  registeredArea: z.coerce.number().int().min(0, "Tinglyst areal skal være 0 eller højere"),
  totalArea: z.coerce.number().int().min(0, "Samlet areal skal være 0 eller højere"),
  maxRentPerSqm: z.coerce.number().min(0, "Max leje pr. m² skal være 0 eller højere").optional(),
  yieldRequirementPct: z.coerce.number().min(0, "Afkastkrav skal være 0 eller højere").optional(),
});

export const insertLeaseTenantSchema = createInsertSchema(leaseTenants).omit({
  id: true,
  organizationId: true,
  createdAt: true,
}).extend({
  periodEnd: z.union([z.string(), z.null()]).optional().transform((val) => {
    if (val === null || val === undefined || val === "") return null;
    return val;
  }),
  rentAmount: z.coerce.number().min(0, "Lejebeløb skal være 0 eller højere"),
  advanceWater: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => {
    if (val === null || val === undefined || val === "" || val === "0" || val === 0) return null;
    const num = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val;
    return isNaN(num) ? null : num;
  }),
  advanceHeating: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => {
    if (val === null || val === undefined || val === "" || val === "0" || val === 0) return null;
    const num = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val;
    return isNaN(num) ? null : num;
  }),
  advanceElectricity: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => {
    if (val === null || val === undefined || val === "" || val === "0" || val === 0) return null;
    const num = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val;
    return isNaN(num) ? null : num;
  }),
  advanceOther: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => {
    if (val === null || val === undefined || val === "" || val === "0" || val === 0) return null;
    const num = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val;
    return isNaN(num) ? null : num;
  }),
  depositAmount: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => {
    if (val === null || val === undefined || val === "" || val === "0" || val === 0) return null;
    const num = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val;
    return isNaN(num) ? null : num;
  }),
  prepaidAmount: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => {
    if (val === null || val === undefined || val === "" || val === "0" || val === 0) return null;
    const num = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val;
    return isNaN(num) ? null : num;
  }),
}).refine((data) => {
  if (data.periodEnd && data.periodEnd !== "" && data.periodStart) {
    return new Date(data.periodEnd) >= new Date(data.periodStart);
  }
  return true;
}, {
  message: "Slutdato skal være efter eller lig med startdato",
  path: ["periodEnd"],
});

export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  internalNumber: true,
  organizationId: true,
  createdAt: true,
});

// Type exports
export type User = typeof users.$inferSelect;
export type Property = typeof properties.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type CompanyRelation = typeof companyRelations.$inferSelect;
export type UserInvitation = typeof userInvitations.$inferSelect;
export type Tenant = typeof tenants.$inferSelect;
export type Lease = typeof leases.$inferSelect;
export type LeaseTenant = typeof leaseTenants.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type InsertCompanyRelation = z.infer<typeof insertCompanyRelationSchema>;
export type InsertUserInvitation = z.infer<typeof insertUserInvitationSchema>;
export type InsertLease = z.infer<typeof insertLeaseSchema>;
export type InsertLeaseTenant = z.infer<typeof insertLeaseTenantSchema>;
export type UserInviteData = z.infer<typeof userInviteSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type SetupData = z.infer<typeof setupSchema>;
export type ChangePasswordData = z.infer<typeof changePasswordSchema>;
