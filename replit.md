# Overview

Doorway is a Danish property management B2B SaaS application built with a full-stack TypeScript architecture. The application focuses on simplicity with a minimal feature set for managing real estate properties. It provides a clean, modern interface for property administrators to track and manage their property portfolios with support for different property types including individual apartments (ejerlejlighed) and complete real estate (samlet fast ejendom).

## Recent Changes (January 2025)

- **Multi-Tenant Architecture Implemented**: Each business now has completely separate accounts and data isolation
- **Organization-Based Data Model**: Added organizations table with proper foreign key relationships and cascade delete
- **Enhanced Setup Flow**: Setup wizard now creates both organization and admin user, with improved Danish UI text
- **Live Danish Number Formatting**: Comprehensive real-time formatting system for all monetary input fields using Danish thousand separators (1.000.000 kr) and comma decimal separator (21.551,16)
- **Improved Authentication Flow**: Fixed redirect issues after account creation, users now properly navigate to dashboard
- **Complete Company Relations System**: Implemented parent/subsidiary company relationships with ownership percentages and full CRUD operations
- **Visual Corporate Structure Chart**: Created tree-diagram style visualization showing company hierarchy with SVG-based stamtræ layout, circular company nodes, connecting lines, and ownership percentages displayed on connections
- **Interactive Ownership Management**: Added clickable ownership percentage boxes in corporate structure diagram allowing real-time editing and deletion of ownership relationships with immediate visual updates
- **Role-Based Access Control**: Implemented comprehensive permission system where regular users have read-only access to properties and companies, while administrators can create, edit, and delete all data
- **Weighted Portfolio Calculations**: Implemented dashboard toggle between "total portefølje" and "vægtet andel" with persistent user preferences. Calculates weighted property counts and acquisition values based on corporate ownership hierarchy from user's assigned company as root. Default view mode is weighted for regular users and total for administrators
- **Enhanced Company Structure Visualization**: Polished corporate structure chart with optimized property placement (centered under single-property companies, horizontally distributed for multiple properties), 60% transparent connection lines for better readability, clickable property boxes with smooth navigation using Wouter routing, and improved spacing with 400px node width and dynamic height calculations

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The frontend is built using React 18 with TypeScript, leveraging modern React patterns and libraries:
- **UI Framework**: Radix UI components with Tailwind CSS for styling and shadcn/ui component library
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state management and caching
- **Forms**: React Hook Form with Zod validation for type-safe form handling
- **Build Tool**: Vite for fast development and optimized production builds

## Backend Architecture
The backend follows a REST API pattern built on Node.js:
- **Framework**: Express.js with TypeScript for type safety
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: Session-based authentication with express-session and bcrypt for password hashing
- **Validation**: Shared Zod schemas between frontend and backend for consistent validation

## Data Storage Architecture
- **Database**: PostgreSQL using Neon serverless hosting
- **Schema Management**: Drizzle Kit for database migrations and schema management
- **Multi-Tenant Data Model**: 
  - Organizations table for business separation
  - Users table with organizationId foreign key for tenant isolation
  - Properties table linked to organizations (not users) for proper data segregation
  - Proper foreign key relationships with cascade delete ensuring data integrity across tenants

## Authentication & Authorization
- **Session Management**: Memory-based session store for development with HTTP-only cookies
- **Password Security**: Bcrypt with salt rounds for secure password hashing
- **Route Protection**: Middleware-based authentication checking for protected API endpoints
- **Initial Setup**: First-time setup wizard for creating the initial administrator account
- **Role-Based Interface**: Dynamic UI elements that show/hide create, edit, and delete buttons based on user role (admin vs regular user)

## Application Structure
The application uses a monorepo structure with clear separation of concerns:
- **Client Directory**: React frontend application with organized component structure
- **Server Directory**: Express backend with modular route handlers and business logic
- **Shared Directory**: Common TypeScript types and Zod schemas used by both frontend and backend

## Key Design Patterns
- **Form Handling**: Consistent pattern using React Hook Form with Zod resolvers for validation
- **Error Handling**: Centralized error handling with toast notifications for user feedback
- **Data Fetching**: TanStack Query for caching, background updates, and optimistic updates
- **Component Architecture**: Reusable UI components with proper TypeScript interfaces
- **Empty States**: Thoughtful empty state handling to guide users through first-time setup
- **Multi-Tenant Data Isolation**: All API endpoints and database queries filtered by organizationId
- **Danish Number Formatting Pattern**: Standardized implementation for all monetary fields with live formatting during input and proper parsing when loading from database

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting for scalable database management
- **Drizzle ORM**: Type-safe database toolkit with PostgreSQL dialect

## UI and Styling
- **Radix UI**: Headless component library for accessible UI primitives
- **Tailwind CSS**: Utility-first CSS framework for styling
- **shadcn/ui**: Pre-built component library built on Radix UI and Tailwind
- **Lucide React**: Icon library for consistent iconography

## Development Tools
- **Vite**: Build tool with hot module replacement and optimized bundling
- **TypeScript**: Static type checking across the entire application
- **React Hook Form**: Form library with validation integration
- **Zod**: Schema validation library for runtime type checking

## Geographic Data
- **Danish Postal Codes**: Local JSON reference file for postal code to city mapping, enabling automatic city population based on postal code input

## Danish Number Formatting Implementation Pattern
For consistent monetary field handling across the application:

### Helper Functions
```typescript
// Format numbers with Danish thousand separators (.) and decimal comma (,)
const formatDanishNumber = (value: string | number): string => {
  if (typeof value === 'number') {
    return new Intl.NumberFormat('da-DK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value);
  }
  // Handle string input with live formatting logic
  // Remove existing formatting, validate input, apply thousand separators
}

// Parse Danish formatted strings back to numbers
const parseDanishNumber = (value: string): number => {
  const cleanValue = value.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleanValue) || 0;
}
```

### Input Field Pattern
```typescript
// For all monetary input fields
<Input 
  type="text"
  value={field.value !== undefined ? (typeof field.value === 'number' ? formatDanishNumber(field.value) : field.value) : ""}
  onChange={(e) => {
    const inputValue = e.target.value;
    if (inputValue === "" || /^[\d.,]*$/.test(inputValue)) {
      const formatted = formatDanishNumber(inputValue);
      field.onChange(formatted);
    }
  }}
/>
```

### Form Initialization Pattern
```typescript
// Default values: use null for empty fields, not empty strings
defaultValues: {
  monetaryField: existingData?.monetaryField ? parseFloat(existingData.monetaryField.toString()) : null,
}

// Loading existing data: parse strings from database to numbers
useEffect(() => {
  if (isEditing && existingData?.monetaryField) {
    const value = parseFloat(existingData.monetaryField.toString());
    form.setValue("monetaryField", value);
  }
}, [isEditing, existingData, form]);
```

### Data Submission Pattern
```typescript
// Convert formatted strings back to numbers before API submission
const cleanData = {
  ...formData,
  monetaryField: typeof formData.monetaryField === 'string' 
    ? parseDanishNumber(formData.monetaryField) 
    : formData.monetaryField
};
```

This pattern ensures consistent Danish number formatting (1.000.000,50) across all monetary fields while maintaining proper data types for database storage and calculations.

## Authentication Libraries
- **bcrypt**: Password hashing library for secure credential storage
- **express-session**: Session management middleware for Express
- **memorystore**: Memory-based session store for development environments