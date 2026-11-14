import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  const service = { login: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: service }],
    }).compile();
    controller = moduleRef.get(AuthController);
  });

  it('passes only email and password to the service and returns the token', async () => {
    service.login.mockResolvedValue({ accessToken: 't' });

    const result = await controller.login({
      email: 'a@x.com',
      password: 'pw',
      role: 'admin',
    } as never);

    expect(service.login).toHaveBeenCalledWith({
      email: 'a@x.com',
      password: 'pw',
    });
    expect(result).toEqual({ accessToken: 't' });
  });
});
