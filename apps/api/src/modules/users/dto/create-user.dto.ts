import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsEmail, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from "class-validator";

export class CreateUserDto {
  @ApiProperty({ example: "Ayu Lestari" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: "ayu@peopleops.local" })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    minLength: 12,
    description: "Initial password, at least 12 characters with a letter and a digit",
  })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/[A-Za-z]/, { message: "password must contain at least one letter" })
  @Matches(/[0-9]/, { message: "password must contain at least one digit" })
  password!: string;

  @ApiPropertyOptional({ type: [String], description: "Role IDs to assign" })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  roleIds?: string[];
}
