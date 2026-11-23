import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { PERMISSIONS } from "@peopleops/shared-types";
import { ENV, type ServerEnv } from "../../config/env";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { OriginGuard } from "../../common/guards/origin.guard";
import { requestMeta } from "../../common/http/request-meta";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { AuthService } from "./auth.service";
import { REFRESH_COOKIE_NAME } from "./auth.constants";
import { clearRefreshCookie, setRefreshCookie } from "./cookie.util";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { LoginDto } from "./dto/login.dto";

function readRefreshCookie(request: Request): string | undefined {
  const token = (request.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE_NAME];
  return typeof token === "string" ? token : undefined;
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: ServerEnv,
  ) {}

  @Post("login")
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Sign in with email and password" })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(dto, requestMeta(request));
    setRefreshCookie(response, result.refreshToken, result.refreshExpiresAt, {
      secure: this.env.COOKIE_SECURE,
    });
    return result.response;
  }

  @Post("refresh")
  @Public()
  @UseGuards(OriginGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rotate the refresh token and issue a new access token" })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.refresh(readRefreshCookie(request), requestMeta(request));
    setRefreshCookie(response, result.refreshToken, result.refreshExpiresAt, {
      secure: this.env.COOKIE_SECURE,
    });
    return result.response;
  }

  @Post("logout")
  @Public()
  @UseGuards(OriginGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Revoke the current session and clear the refresh cookie" })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(readRefreshCookie(request), requestMeta(request));
    clearRefreshCookie(response, { secure: this.env.COOKIE_SECURE });
  }

  @Get("me")
  @RequirePermissions(PERMISSIONS.AUTH_ME)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Current user with roles, permissions and session details" })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.currentUser(user);
  }

  @Post("change-password")
  @RequirePermissions(PERMISSIONS.AUTH_CHANGE_PASSWORD)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Change the password and sign out other devices" })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.changePassword(user, dto, requestMeta(request));
  }
}
