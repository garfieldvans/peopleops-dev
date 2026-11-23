import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "admin@peopleops.local" })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: "your-password" })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
