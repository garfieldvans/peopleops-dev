import "reflect-metadata";
import { Logger, ValidationPipe, VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { loadEnv } from "./config/env";
import { loadDotenv } from "./config/load-dotenv";

async function bootstrap(): Promise<void> {
  loadDotenv();
  const env = loadEnv();

  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableCors({
    origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
    credentials: true,
  });
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle("PeopleOps API")
    .setDescription("Single-company HRIS API")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(env.PORT);

  Logger.log(
    `API listening on http://localhost:${env.PORT}/api/v1 (docs: http://localhost:${env.PORT}/api/docs)`,
    "Bootstrap",
  );
}

bootstrap().catch((error: unknown) => {
  Logger.error(
    "API failed to start",
    error instanceof Error ? error.stack : String(error),
    "Bootstrap",
  );
  process.exit(1);
});
