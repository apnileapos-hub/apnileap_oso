"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const swagger_1 = require("@nestjs/swagger");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors({
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
    });
    const config = new swagger_1.DocumentBuilder()
        .setTitle('APNILEAP Open-Source Platform API')
        .setDescription('NestJS API specifications for the self-hosted agile dashboard migration.')
        .setVersion('2.0')
        .addBearerAuth()
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('swagger', app, document);
    const port = process.env.PORT || 5000;
    await app.listen(port);
    console.log(`\n🚀 APNILEAP NestJS application is running on: http://localhost:${port}`);
    console.log(`📖 Swagger documentation is available at: http://localhost:${port}/swagger\n`);
}
bootstrap();
//# sourceMappingURL=main.js.map