import { ApiProperty } from "@nestjs/swagger";
import type { HealthStatus, HealthResponse } from "@peopleops/shared-types";

export class HealthCheckDto {
  @ApiProperty({ enum: ["up", "down"] })
  status!: "up" | "down";

  @ApiProperty({ type: Number, nullable: true, description: "Round-trip time of the database probe" })
  latencyMs!: number | null;
}

export class HealthChecksDto {
  @ApiProperty({ type: HealthCheckDto })
  database!: HealthCheckDto;
}

export class HealthResponseDto implements HealthResponse {
  @ApiProperty({ enum: ["ok", "degraded"] })
  status!: HealthStatus;

  @ApiProperty({ example: "peopleops-api" })
  service!: string;

  @ApiProperty({ example: "0.1.0" })
  version!: string;

  @ApiProperty({ example: "development" })
  environment!: string;

  @ApiProperty({ example: "Asia/Jakarta" })
  timezone!: string;

  @ApiProperty({ example: 42 })
  uptimeSeconds!: number;

  @ApiProperty({ example: "2026-11-21T10:00:00.000Z" })
  timestamp!: string;

  @ApiProperty({ type: HealthChecksDto })
  checks!: HealthChecksDto;
}
