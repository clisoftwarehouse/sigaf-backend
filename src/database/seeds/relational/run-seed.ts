import { NestFactory } from '@nestjs/core';

import { SeedModule } from './seed.module';
import { RoleSeedService } from './role/role-seed.service';
import { UserSeedService } from './user/user-seed.service';
import { DemoSeedService } from './demo/demo-seed.service';
import { ConfigSeedService } from './config/config-seed.service';
import { PermissionSeedService } from './permission/permission-seed.service';

const runSeed = async () => {
  const app = await NestFactory.create(SeedModule);

  console.log('Running seeds...');

  // 1. Roles (required for users)
  await app.get(RoleSeedService).run();

  // 2. Permissions
  await app.get(PermissionSeedService).run();

  // 3. Users (requires roles)
  await app.get(UserSeedService).run();

  // 4. Global config
  await app.get(ConfigSeedService).run();

  // 5. Demo data: catálogos + lotes (idempotente). Usa SKIP_DEMO_SEED=1 para omitir.
  if (process.env.SKIP_DEMO_SEED !== '1') {
    await app.get(DemoSeedService).run();
  }

  console.log('Seeds completed!');
  await app.close();
};

void runSeed();
