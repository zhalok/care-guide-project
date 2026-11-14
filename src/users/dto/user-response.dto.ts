import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../schemas/user.schema';

export class UserResponseDto {
  @ApiProperty({ example: '6af7ff784447a60ab6c98fa1' })
  _id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ example: 'ann@example.com' })
  email: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class UsersPageDto {
  @ApiProperty({ type: [UserResponseDto] })
  items: UserResponseDto[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Pass as `cursor` for the next page; null on the last page.',
  })
  nextCursor: string | null;
}
