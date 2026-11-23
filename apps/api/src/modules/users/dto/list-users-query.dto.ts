import { ApiPropertyOptional } from "@nestjs/swagger";
import { USER_STATUSES, type UserStatus } from "@peopleops/shared-types";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { PageQueryDto } from "../../../common/dto/page-query.dto";

export class ListUsersQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: "Matches name or email" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: USER_STATUSES })
  @IsOptional()
  @IsIn([...USER_STATUSES])
  status?: UserStatus;
}
