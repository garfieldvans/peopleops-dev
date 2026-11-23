import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import type { ApiErrorResponse } from "@peopleops/shared-types";

const CODE_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: "BAD_REQUEST",
  [HttpStatus.UNAUTHORIZED]: "UNAUTHORIZED",
  [HttpStatus.FORBIDDEN]: "FORBIDDEN",
  [HttpStatus.NOT_FOUND]: "NOT_FOUND",
  [HttpStatus.CONFLICT]: "CONFLICT",
  [HttpStatus.UNPROCESSABLE_ENTITY]: "UNPROCESSABLE_ENTITY",
  [HttpStatus.TOO_MANY_REQUESTS]: "RATE_LIMITED",
  [HttpStatus.INTERNAL_SERVER_ERROR]: "INTERNAL_ERROR",
  [HttpStatus.SERVICE_UNAVAILABLE]: "SERVICE_UNAVAILABLE",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const traceId = randomUUID();

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL_ERROR";
    let message = "An unexpected error occurred";
    let details: unknown;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      code = CODE_BY_STATUS[statusCode] ?? "HTTP_ERROR";

      const payload = exception.getResponse();
      if (typeof payload === "string") {
        message = payload;
      } else if (isRecord(payload)) {
        if (typeof payload["code"] === "string") {
          code = payload["code"];
        }

        const rawMessage = payload["message"];
        if (Array.isArray(rawMessage)) {
          message = "Request validation failed";
          details = rawMessage;
          code = "VALIDATION_FAILED";
        } else if (typeof rawMessage === "string") {
          message = rawMessage;
        } else if (typeof payload["error"] === "string") {
          message = payload["error"];
        }
      }
    } else {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`${request.method} ${request.url} -> ${statusCode} (trace ${traceId})`);
    }

    const body: ApiErrorResponse = {
      statusCode,
      code,
      message,
      ...(details === undefined ? {} : { details }),
      traceId,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    };

    response.status(statusCode).json(body);
  }
}
