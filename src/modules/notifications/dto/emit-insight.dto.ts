import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Matches, Min } from 'class-validator';

/**
 * A client-computed monthly insight digest. Insights are derived on-device, so
 * the app posts the summary here; the backend persists + dedupes it (one per
 * [periodKey] per user) and pushes it.
 */
export class EmitInsightDto {
  @ApiProperty({
    example: '2026-07',
    description: 'YYYY-MM the insight covers',
  })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'periodKey must be in YYYY-MM format',
  })
  periodKey!: string;

  @ApiProperty({ description: 'Total expense in riel for the period' })
  @IsInt()
  @Min(0)
  spentKhr!: number;

  @ApiProperty({ description: 'Number of transactions in the period' })
  @IsInt()
  @Min(0)
  count!: number;
}
