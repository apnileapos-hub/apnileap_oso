import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configure global CORS headers to allow UI interaction
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Enable OpenAPI / Swagger document generator
  const config = new DocumentBuilder()
    .setTitle('APNILEAP Open-Source Platform API')
    .setDescription('NestJS API specifications for the self-hosted agile dashboard migration.')
    .setVersion('2.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);

  const port = process.env.PORT || 5000;
  await app.listen(port);
  console.log(`\n🚀 APNILEAP NestJS application is running on: http://localhost:${port}`);
  console.log(`📖 Swagger documentation is available at: http://localhost:${port}/swagger\n`);
}
bootstrap();
