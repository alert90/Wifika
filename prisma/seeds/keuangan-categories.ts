import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

export async function seedKeuanganCategories() {
  console.log('🌱 Seeding Keuangan Categories...');

  const categories = [
    // INCOME Categories
    {
      id: nanoid(),
      name: 'PPPoE Payment',
      type: 'INCOME',
      description: 'Revenue from monthly PPPoE customer payments',
    },
    {
      id: nanoid(),
      name: 'Hotspot Payment',
      type: 'INCOME',
      description: 'Revenue from hotspot voucher sales',
    },
    {
      id: nanoid(),
      name: 'Installation Fee',
      type: 'INCOME',
      description: 'Revenue from new customer installation fees',
    },
    {
      id: nanoid(),
      name: 'Other Income',
      type: 'INCOME',
      description: 'Revenue from other sources',
    },

    // EXPENSE Categories
    {
      id: nanoid(),
      name: 'Bandwidth & Upstream',
      type: 'EXPENSE',
      description: 'Bandwith and upstream connection costs',
    },
    {
      id: nanoid(),
      name: 'Employee Salaries',
      type: 'EXPENSE',
      description: 'Employee salary and wage expenses',
    },
    {
      id: nanoid(),
      name: 'Electricity',
      type: 'EXPENSE',
      description: 'Electricity costs for operations',
    },
    {
      id: nanoid(),
      name: 'Maintenance & Repair',
      type: 'EXPENSE',
      description: 'Device maintenance and repair costs',
    },
    {
      id: nanoid(),
      name: 'Equipment & Hardware',
      type: 'EXPENSE',
      description: 'Network equipment and hardware purchases',
    },
    {
      id: nanoid(),
      name: 'Rent',
      type: 'EXPENSE',
      description: 'Office or operational space rental',
    },
    {
      id: nanoid(),
      name: 'Agent Commission',
      type: 'EXPENSE',
      description: 'BCommission fees for voucher agents',
    },
    {
      id: nanoid(),
      name: 'Marketing & Promosion',
      type: 'EXPENSE',
      description: 'Marketing, advertising, and promotion costs',
    },
    {
      id: nanoid(),
      name: 'Other Operational',
      type: 'EXPENSE',
      description: 'Other operational expenses',
    },
  ];

  for (const category of categories) {
    const existing = await prisma.transactionCategory.findUnique({
      where: { name: category.name },
    });

    if (!existing) {
      await prisma.transactionCategory.create({
        data: category as any,
      });
      console.log(`  ✓ Created category: ${category.name}`);
    } else {
      console.log(`  ⊙ Category already exists: ${category.name}`);
    }
  }

  console.log('✅ Financial Categories seeding completed!\n');
}

// Run if called directly
if (require.main === module) {
  seedKeuanganCategories()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
