import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { RequestLoggerMiddleware } from './common/request-logger.middleware';
import { NotesModule } from './notes/notes.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGODB_URI ?? 'mongodb://localhost:27017/care-guide',
    ),
    AuthModule,
    NotesModule,
    UsersModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Applied to every route, so rejected (401/403) requests are logged too.
    consumer.apply(RequestLoggerMiddleware).forRoutes('*path');
  }
}
