import { ApiProperty } from '@nestjs/swagger';

export class NoteResponseDto {
  @ApiProperty({ example: '6af7ff784447a60ab6c98fc9' })
  _id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  content: string;

  @ApiProperty({
    description: 'Id of the user who owns the note.',
    example: '6af7ff784447a60ab6c98fa1',
  })
  createdBy: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class NotesPageDto {
  @ApiProperty({ type: [NoteResponseDto] })
  items: NoteResponseDto[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Pass as `cursor` for the next page; null on the last page.',
  })
  nextCursor: string | null;
}
