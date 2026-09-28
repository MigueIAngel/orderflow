import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderLineDto {
  @ApiProperty({ example: 'KB-001' })
  @IsString()
  @Length(1, 40)
  sku: string;

  @ApiProperty({ example: 1, minimum: 1, maximum: 50 })
  @IsInt()
  @Min(1)
  @Max(50)
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'ada@example.com' })
  @IsEmail()
  customerEmail: string;

  @ApiProperty({ type: [OrderLineDto] })
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  items: OrderLineDto[];

  @ApiPropertyOptional({
    description: 'Demo switch: the payments service will decline the charge.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  simulatePaymentFailure?: boolean;
}
