import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({
    description:
      'JWT to send as `Authorization: Bearer <token>`. Its claims are `sub` (user id), `email` and `role`.',
  })
  accessToken: string;
}
