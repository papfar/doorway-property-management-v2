# Doorway - Property Management System

Doorway er en dansk ejendomsadministrationsplatform bygget som B2B SaaS løsning. Systemet fokuserer på simplicitet og giver en moderne grænseflade til ejendomsadministratorer til at spore og administrere deres ejendomsporteføljer.

## Features

- **Multi-tenant arkitektur** - Separat data for hver virksomhed
- **Rollebaseret adgangskontrol** - Admin, bruger og mægler roller
- **Ejendomsstyring** - Administrer forskellige ejendomstyper
- **Lejemålsadministration** - Håndter lejemål og lejekontrakter
- **Lejerstyring** - Komplet lejerdatabase med anonymisering for mæglere
- **Virksomhedsrelationer** - Moderselskab/datterselskab forhold
- **Dashboard analytics** - Porteføljeoversigt med vægtede beregninger
- **Dansk nummerformatering** - Konsistent valutaformatering

## Teknologi Stack

### Frontend
- React 18 med TypeScript
- Vite build tool
- Tailwind CSS + shadcn/ui komponenter
- Wouter routing
- TanStack Query til state management

### Backend
- Node.js + Express.js
- TypeScript
- Drizzle ORM
- PostgreSQL database
- Session-baseret authentication

## Installation

1. Clone repository:
```bash
git clone https://github.com/your-username/doorway.git
cd doorway
```

2. Installer dependencies:
```bash
npm install
```

3. Opsæt environment variabler:
```bash
cp .env.example .env
```

4. Kør database migrations:
```bash
npm run db:push
```

5. Start development server:
```bash
npm run dev
```

Applikationen kører på `http://localhost:5000`

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build til produktion
- `npm start` - Start production server
- `npm run db:push` - Push database schema changes

## Deployment

Projektet er konfigureret til Digital Ocean App Platform. Se `deploy-guide.md` for detaljerede instruktioner.

## License

MIT License