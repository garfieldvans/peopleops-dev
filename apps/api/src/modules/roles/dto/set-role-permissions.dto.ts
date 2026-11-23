import { ApiProperty } from "@nestjs/swagger";
import { ArrayUnique, IsArray, IsUUID } from "class-validator";

export class SetRolePermissionsDto {
  @ApiProperty({ type: [String], description: "Complete set of permission IDs" })
  @IsArray()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  permissionIds!: string[];
}
