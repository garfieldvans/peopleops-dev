import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "peopleops:isPublic";

/** Skips JwtAuthGuard. Never use on routes that expose account data. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
