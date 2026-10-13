# Project guidance

QuantJournal uses Next.js App Router, React, TypeScript and SQLite with Prisma.
Run npm run setup for local database initialization, npm run dev for development and npm run build for a production build.
AI and market settings live in ignored .local files. Never commit databases, keys, user reports, logs or runtime environments.
Use the unified AI and MarketDataProvider interfaces when adding integrations. Treat all external prices as provider data with explicit coverage and adjustment metadata.
