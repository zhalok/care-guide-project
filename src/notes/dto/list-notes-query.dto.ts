export class ListNotesQueryDto {
  /** Opaque cursor returned as `nextCursor` by the previous page. */
  cursor?: string;
  /** Page size, 1-100. Defaults to 20. */
  limit?: string;
}
