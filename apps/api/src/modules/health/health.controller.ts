import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";
import type { HealthResponse } from "@peopleops/shared-types";
import { Public } from "../../common/decorators/public.decorator";
import { HealthResponseDto } from "./health.dto";
import { HealthService } from "./health.service";

@ApiTags("health")
@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({
    summary: "Service and database health",
    description: "Returns 200 when the API can reach PostgreSQL, 503 otherwise.",
  })
  @ApiOkResponse({ type: HealthResponseDto })
  @ApiServiceUnavailableResponse({ type: HealthResponseDto })
  async check(@Res({ passthrough: true }) response: Response): Promise<HealthResponse> {
    const { status, body } = await this.health.check();
    response.status(status === "ok" ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return body;
  }
}
