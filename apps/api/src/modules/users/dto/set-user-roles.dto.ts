import { ApiProperty } from "@nestjs/swagger";
import { ArrayUnique, IsArray, IsUUID } from "class-validator";

export class SetUserRolesDto {
  @ApiProperty({ type: [String], description: "Complete set of role IDs for the user" })
  @IsArray()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  roleIds!: string[];
}
