// Must stay first: patches http/express/mongodb before they are loaded.
import './tracing/tracing';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Behind a reverse proxy (nginx), trust its X-Forwarded-For so req.ip (and the
  // request log) show the real client. Off by default: only enable it when a
  // proxy you control is in front, because clients can send that header too.
  // TRUST_PROXY accepts what Express accepts: a hop count ("1") or "loopback".
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    app.set(
      'trust proxy',
      /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy,
    );
  }

  const config = new DocumentBuilder()
    .setTitle('Care Guide API')
    .setDescription(
      'Call `POST /auth/login` to get an access token, then use **Authorize** to send it as a bearer token.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
