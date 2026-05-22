#!/bin/bash

echo "🚀 Setting up Skylink database..."

# 1. Push schema
echo "Pushing database schema..."
npx prisma db push --accept-data-loss

# 2. Run main seed
echo "Running seed script..."
if [ -f "prisma/seed.ts" ]; then
  npx tsx prisma/seed.ts
else
  echo "⚠️  Main seed script not found"
fi

# 3. Run individual seeds
echo "Running individual seeds..."
if [ -f "prisma/seeds/seed-admin.ts" ]; then
  npx tsx prisma/seeds/seed-admin.ts
fi

if [ -f "prisma/seeds/seed-permissions.ts" ]; then
  npx tsx prisma/seeds/seed-permissions.ts
fi

if [ -f "prisma/seeds/seed-keuangan-categories.ts" ]; then
  npx tsx prisma/seeds/seed-keuangan-categories.ts
fi

echo ""
echo "✅ Database setup complete!"
echo "Start the app: npm run dev"
echo "Login with: cyberwiz / ennexica"