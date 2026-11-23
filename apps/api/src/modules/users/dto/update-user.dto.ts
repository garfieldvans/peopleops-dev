import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateUserDto {
  @ApiProperty({ example: "Ayu Lestari" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: "ayu@peopleops.local" })
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
