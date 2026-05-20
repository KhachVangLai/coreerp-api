import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateSalesOrderDto } from './create-sales-order.dto';

describe('CreateSalesOrderDto', () => {
  const validDto = {
    customerId: 'customer-1',
    warehouseId: 'warehouse-1',
    discountAmount: '0.00',
    taxAmount: '0.00',
    lines: [
      {
        productId: 'product-1',
        quantity: 5,
        unitPrice: '120000.00',
      },
    ],
  };

  it('rejects empty lines', async () => {
    const dto = plainToInstance(CreateSalesOrderDto, {
      ...validDto,
      lines: [],
    });

    const errors = await validate(dto);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'lines',
          constraints: expect.objectContaining({
            arrayNotEmpty: expect.any(String),
          }),
        }),
      ]),
    );
  });

  it('rejects quantity <= 0', async () => {
    const dto = plainToInstance(CreateSalesOrderDto, {
      ...validDto,
      lines: [{ ...validDto.lines[0], quantity: 0 }],
    });

    const errors = await validate(dto);
    const lineErrors = errors.find((error) => error.property === 'lines');

    expect(JSON.stringify(lineErrors)).toContain('quantity');
  });

  it('rejects unitPrice < 0', async () => {
    const dto = plainToInstance(CreateSalesOrderDto, {
      ...validDto,
      lines: [{ ...validDto.lines[0], unitPrice: '-1.00' }],
    });

    const errors = await validate(dto);
    const lineErrors = errors.find((error) => error.property === 'lines');

    expect(JSON.stringify(lineErrors)).toContain('unitPrice');
  });
});
