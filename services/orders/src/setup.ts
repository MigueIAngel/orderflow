import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Shared by main.ts and the e2e tests. */
export function configureApp(app: INestApplication) {
  app.enableCors();
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('OrderFlow · Orders service')
      .setDescription(
        'Order lifecycle. Orders are accepted as PENDING and completed by the saga ' +
          '(stock reservation, then payment) through Redis Streams events.',
      )
      .setVersion('1.0.0')
      .build(),
  );
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'openapi.json',
  });
}
