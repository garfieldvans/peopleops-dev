import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/[A-Za-z]/, { message: "newPassword must contain at least one letter" })
  @Matches(/[0-9]/, { message: "newPassword must contain at least one digit" })
  newPassword!: string;
}
