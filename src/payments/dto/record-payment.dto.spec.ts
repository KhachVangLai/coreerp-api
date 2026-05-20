import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

import { RecordPaymentDto } from './record-payment.dto';

describe('RecordPaymentDto', () => {
  it.each(['0', '0.00', '-1.00'])('rejects non-positive amount %s', async (amount) => {
    const dto = plainToInstance(RecordPaymentDto, {
      amount,
      method: PaymentMethod.CASH,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'amount')).toBe(true);
  });

  it('accepts positive decimal amount', async () => {
    const dto = plainToInstance(RecordPaymentDto, {
      amount: '0.01',
      method: PaymentMethod.CASH,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
