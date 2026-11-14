import { ApiPropertyOptional } from '@nestjs/swagger';

export class PageQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor: the `nextCursor` from the previous page.',
    example: '6af7ff784447a60ab6c98fc9',
  })
  cursor?: string;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 100,
    default: 20,
    description: 'Page size.',
  })
  limit?: string;
}
