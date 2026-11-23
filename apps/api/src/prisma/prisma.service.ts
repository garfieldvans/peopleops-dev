import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { PeopleOpsPrismaClient } from "@peopleops/database";
import { ENV, type ServerEnv } from "../config/env";

@Injectable()
export class PrismaService extends PeopleOpsPrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(ENV) env: ServerEnv) {
    super({ connectionString: env.DATABASE_URL });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
