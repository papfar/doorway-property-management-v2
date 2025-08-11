# Deployment Guide til Digital Ocean App Platform

## Forudsætninger
1. Digital Ocean konto
2. Git repository med dit kode (GitHub, GitLab, etc.)

## Deployment Steps

### 1. Forbered dit repository
- Sørg for at alle filer er committed til git
- Push til din main branch på GitHub/GitLab

### 2. Opret app på Digital Ocean
1. Gå til Digital Ocean Control Panel
2. Klik på "Apps" i sidebar
3. Klik "Create App"
4. Vælg dit Git repository
5. Vælg branch: `main`

### 3. Konfigurer build settings
- **Run Command**: `npm start`
- **HTTP Port**: `5000`  
- **Environment**: Node.js

### 4. Tilføj database
1. Vælg "Add Database" 
2. Vælg PostgreSQL
3. Vælg størrelse (Dev Database for test, eller Production for live)

### 5. Environment variabler
Disse bliver automatisk sat:
- `NODE_ENV=production`
- `DATABASE_URL` (fra database)

### 6. Deploy
Klik "Create Resources" - Digital Ocean vil:
- Bygge dit projekt
- Opsætte PostgreSQL database  
- Starte din app
- Give dig en URL

## Efter deployment
1. Din app vil være tilgængelig på `https://your-app-name.ondigitalocean.app`
2. Kør database migrations hvis nødvendigt
3. Test funktionalitet

## Automatisk re-deployment
Hver gang du pusher til main branch, vil appen automatisk re-deployes.

## Fejlfinding
- Check "Runtime Logs" i Digital Ocean console
- Database connection string bliver automatisk konfigureret
- Kontakt mig hvis der er problemer