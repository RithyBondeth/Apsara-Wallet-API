import { BadRequestException } from '@nestjs/common';
import { transfers, wallets } from '../../database/schema';
import { FakeDb, render } from '../../../test/support/fake-db';
import { TransfersService } from './transfers.service';

const USER = '11111111-1111-4111-8111-111111111111';
const FROM = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TO = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function dto(over: Partial<{ amountKhr: number; toWalletId: string }> = {}) {
  return {
    fromWalletId: FROM,
    toWalletId: TO,
    amountKhr: 50_000,
    date: '2024-05-20T09:00:00.000Z',
    ...over,
  };
}

describe('TransfersService.create', () => {
  let fake: FakeDb;
  let service: TransfersService;

  beforeEach(() => {
    fake = new FakeDb();
    service = new TransfersService(fake.db);
  });

  it('rejects a transfer to the same wallet before touching the database', async () => {
    await expect(
      service.create(USER, dto({ toWalletId: FROM })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fake.calls).toHaveLength(0);
  });

  it('rejects when either wallet is not owned by the user', async () => {
    // Only the source wallet comes back from the ownership query.
    fake.onSelect(wallets, [{ id: FROM, balanceKhr: 1_000_000 }]);

    await expect(service.create(USER, dto())).rejects.toThrow(
      'Both wallets must be your own',
    );
    expect(fake.inserted(transfers)).toHaveLength(0);
    expect(fake.updated(wallets)).toHaveLength(0);
  });

  it('rejects when the source wallet cannot cover the amount', async () => {
    fake.onSelect(wallets, [
      { id: FROM, balanceKhr: 49_999 },
      { id: TO, balanceKhr: 0 },
    ]);

    await expect(service.create(USER, dto())).rejects.toThrow(
      'Insufficient balance in source wallet',
    );
    expect(fake.transactions).toBe(0);
  });

  it('allows a transfer that drains the source wallet to exactly zero', async () => {
    fake.onSelect(wallets, [
      { id: FROM, balanceKhr: 50_000 },
      { id: TO, balanceKhr: 0 },
    ]);
    fake.onInsert(transfers, [{ id: 't1' }]);

    await expect(service.create(USER, dto())).resolves.toEqual({ id: 't1' });
  });

  it('records the transfer and moves both balances inside one transaction', async () => {
    fake.onSelect(wallets, [
      { id: FROM, balanceKhr: 1_000_000 },
      { id: TO, balanceKhr: 0 },
    ]);
    fake.onInsert(transfers, [{ id: 't1', amountKhr: 50_000 }]);

    const row = await service.create(USER, dto());

    expect(row).toEqual({ id: 't1', amountKhr: 50_000 });
    expect(fake.transactions).toBe(1);

    // The ownership check scopes to the user AND both wallet ids.
    const [ownership] = fake.selected(wallets);
    expect(ownership.params).toEqual([USER, FROM, TO]);

    const [inserted] = fake.inserted(transfers);
    expect(inserted).toMatchObject({
      userId: USER,
      fromWalletId: FROM,
      toWalletId: TO,
      amountKhr: 50_000,
      date: new Date('2024-05-20T09:00:00.000Z'),
    });

    const updates = fake.updated(wallets);
    expect(updates).toHaveLength(2);
    expect(updates.every((u) => u.inTransaction)).toBe(true);

    const [debit, credit] = updates;
    expect(render(debit.set.balanceKhr as never)).toMatchObject({
      sql: expect.stringContaining('- $1') as string,
      params: [50_000],
    });
    expect(debit.where.params).toEqual([FROM]);

    expect(render(credit.set.balanceKhr as never)).toMatchObject({
      sql: expect.stringContaining('+ $1') as string,
      params: [50_000],
    });
    expect(credit.where.params).toEqual([TO]);
  });
});
