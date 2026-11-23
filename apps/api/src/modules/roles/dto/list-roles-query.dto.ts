import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { PageQueryDto } from "../../../common/dto/page-query.dto";

export class ListRolesQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: "Matches name or code" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;
}
