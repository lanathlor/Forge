import { db } from './index';
import { qaGateConfigs } from './schema';

const defaultGates = [
  {
    name: 'eslint',
    enabled: true,
    command: 'pnpm eslint . --ext .ts,.tsx,.js,.jsx',
    timeout: 60000,
    failOnError: true,
    order: 1,
  },
  {
    name: 'typescript',
    enabled: true,
    command: 'pnpm tsc --noEmit',
    timeout: 120000,
    failOnError: true,
    order: 2,
  },
  {
    name: 'tests',
    enabled: false,
    command: 'pnpm test --run',
    timeout: 300000,
    failOnError: false,
    order: 3,
  },
];

async function upsertGate(gate: typeof defaultGates[0]) {
  await db
    .insert(qaGateConfigs)
    .values(gate)
    .onConflictDoUpdate({
      target: qaGateConfigs.name,
      set: {
        command: gate.command,
        timeout: gate.timeout,
        failOnError: gate.failOnError,
        order: gate.order,
        updatedAt: new Date(),
      },
    });
}

async function seed() {
  console.log('🌱 Seeding database...');

  // Insert or update QA gate configurations
  for (const gate of defaultGates) {
    await upsertGate(gate);
  }

  console.log('✅ Seed complete!');
  console.log('   - 3 QA gate configurations added/updated');

  process.exit(0);
}

seed().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
