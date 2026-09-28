import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { ListOrdersQuery } from './dto/list-orders.query.js';
import { OrdersService } from './orders.service.js';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /**
   * Places an order. It is accepted as PENDING and completed asynchronously by the saga;
   * poll `GET /orders/{id}` or listen to the notifications stream for the outcome.
   */
  @Post()
  @HttpCode(202)
  @ApiAcceptedResponse({ description: 'Order accepted, saga started' })
  @ApiBadRequestResponse({ description: 'Invalid payload or unknown SKU' })
  @ApiServiceUnavailableResponse({ description: 'Inventory service is down' })
  create(@Body() dto: CreateOrderDto) {
    return this.orders.create(dto);
  }

  /** Latest orders, newest first. */
  @Get()
  findAll(@Query() query: ListOrdersQuery) {
    return this.orders.findAll(query);
  }

  /** One order with its items and saga timeline. */
  @Get(':id')
  @ApiNotFoundResponse()
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.findOne(id);
  }
}
