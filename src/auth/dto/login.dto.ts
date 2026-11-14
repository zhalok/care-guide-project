import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'ann@example.com' })
  email: string;

  @ApiProperty({ example: 's3cret-pw', format: 'password' })
  password: string;
}
