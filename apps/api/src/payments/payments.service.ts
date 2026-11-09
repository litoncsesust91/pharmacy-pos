import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ApproveCloseDto,
  CashMovementDto,
  CloseSessionDto,
  CreatePaymentDto,
  CreateRefundDto,
  CreateRegisterDto,
  OpenSessionDto,
  PaymentWebhookDto,
  ReviewRefundDto,
} from './dto/payments.dto.js';

const sessionInclude = {
  register: true,
  branch: true,
  movements: { orderBy: { createdAt: 'desc' as const } },
} satisfies Prisma.CashSessionInclude;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listRegisters(user: AuthenticatedUser) {
    return this.prisma.cashRegister.findMany({
      where: { tenantId: user.tenantId, branchId: { in: user.branchIds }, isActive: true },
      include: { branch: true },
      orderBy: { name: 'asc' },
    });
  }

  async createRegister(user: AuthenticatedUser, input: CreateRegisterDto) {
    this.assertBranch(user, input.branchId);
    try {
      const register = await this.prisma.cashRegister.create({
        data: { tenantId: user.tenantId, branchId: input.branchId, name: input.name.trim(), code: input.code.trim() },
      });
      await this.recordAudit(user, 'cash-register.created', register.id, { code: register.code });
      return register;
    } catch (error) {
      this.throwConflict(error, 'Register code already exists');
    }
  }

  currentSession(user: AuthenticatedUser) {
    return this.prisma.cashSession.findFirst({
      where: { tenantId: user.tenantId, branchId: { in: user.branchIds }, status: 'OPEN' },
      include: sessionInclude,
      orderBy: { openedAt: 'desc' },
    });
  }

  async openSession(user: AuthenticatedUser, input: OpenSessionDto) {
    const register = await this.prisma.cashRegister.findFirst({
      where: { id: input.registerId, tenantId: user.tenantId, branchId: { in: user.branchIds }, isActive: true },
    });
    if (!register) throw new NotFoundException('Cash register not found');
    const existing = await this.prisma.cashSession.findFirst({ where: { registerId: register.id, status: 'OPEN' } });
    if (existing) throw new ConflictException('Cash register already has an open session');
    const session = await this.prisma.cashSession.create({
      data: {
        tenantId: user.tenantId,
        branchId: register.branchId,
        registerId: register.id,
        openedById: user.id,
        openingFloat: input.openingFloat,
      },
      include: sessionInclude,
    });
    await this.recordAudit(user, 'cash-session.opened', session.id, { openingFloat: input.openingFloat });
    return session;
  }

  async cashMovement(user: AuthenticatedUser, sessionId: string, input: CashMovementDto) {
    const session = await this.getOpenSession(user, sessionId);
    try {
      const movement = await this.prisma.cashMovement.create({
        data: {
          tenantId: user.tenantId,
          sessionId: session.id,
          actorId: user.id,
          movementType: input.movementType,
          amount: input.amount,
          reason: input.reason.trim(),
          idempotencyKey: input.idempotencyKey,
        },
      });
      await this.recordAudit(user, `cash.${input.movementType.toLowerCase()}`, movement.id, { amount: input.amount });
      return movement;
    } catch (error) {
      this.throwConflict(error, 'Cash movement idempotency key already exists');
    }
  }

  async closeSession(user: AuthenticatedUser, sessionId: string, input: CloseSessionDto) {
    const session = await this.getOpenSession(user, sessionId);
    const expectedCash = await this.expectedCash(session.id, session.openingFloat);
    const discrepancy = this.money(input.countedCash - expectedCash);
    const status = discrepancy === 0 ? 'CLOSED' : 'PENDING_APPROVAL';
    const closed = await this.prisma.cashSession.update({
      where: { id: session.id },
      data: {
        status,
        expectedCash,
        countedCash: input.countedCash,
        discrepancy,
        closeNote: input.note?.trim(),
        closedById: user.id,
        closedAt: new Date(),
      },
      include: sessionInclude,
    });
    await this.recordAudit(user, 'cash-session.closed', session.id, { expectedCash, countedCash: input.countedCash, discrepancy });
    return closed;
  }

  async approveClose(user: AuthenticatedUser, sessionId: string, input: ApproveCloseDto) {
    const session = await this.prisma.cashSession.findFirst({
      where: { id: sessionId, tenantId: user.tenantId, branchId: { in: user.branchIds } },
    });
    if (!session) throw new NotFoundException('Cash session not found');
    if (session.closedById === user.id) throw new ForbiddenException('Cashier cannot approve their own discrepancy');
    if (session.status !== 'PENDING_APPROVAL') throw new BadRequestException('Session has no discrepancy awaiting approval');
    const updated = await this.prisma.cashSession.update({
      where: { id: session.id },
      data: { status: input.approved ? 'APPROVED' : 'REJECTED', approvedAt: input.approved ? new Date() : null },
      include: sessionInclude,
    });
    await this.recordAudit(user, input.approved ? 'cash-session.discrepancy-approved' : 'cash-session.discrepancy-rejected', session.id, {});
    return updated;
  }

  async createPayment(user: AuthenticatedUser, input: CreatePaymentDto) {
    const sale = await this.prisma.sale.findFirst({
      where: { id: input.saleId, tenantId: user.tenantId, branchId: { in: user.branchIds }, status: 'COMPLETED' },
    });
    if (!sale) throw new NotFoundException('Completed sale not found');
    if (sale.paymentStatus === 'PAID') throw new ConflictException('Sale is already paid');
    if (!new Prisma.Decimal(input.amount).equals(sale.total)) throw new BadRequestException('Payment must equal sale total');
    const method = await this.prisma.tenantPaymentMethod.findFirst({
      where: { settings: { tenantId: user.tenantId }, code: input.method, enabled: true },
    });
    if (!method) throw new BadRequestException('Payment method is not enabled');
    let sessionId: string | undefined;
    if (input.method === 'cash') {
      const session = input.sessionId ? await this.getOpenSession(user, input.sessionId) : await this.currentSession(user);
      if (!session || session.branchId !== sale.branchId) throw new BadRequestException('An open cash session is required');
      sessionId = session.id;
    }
    const existing = await this.prisma.paymentTransaction.findUnique({
      where: { tenantId_idempotencyKey: { tenantId: user.tenantId, idempotencyKey: input.idempotencyKey } },
    });
    if (existing) return existing;
    const payment = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.paymentTransaction.create({
        data: {
          tenantId: user.tenantId,
          saleId: sale.id,
          sessionId,
          initiatedById: user.id,
          method: input.method,
          provider: `local-${input.method}`,
          status: 'CONFIRMED',
          amount: input.amount,
          providerReference: input.providerReference,
          idempotencyKey: input.idempotencyKey,
          confirmedAt: new Date(),
        },
      });
      await transaction.sale.update({ where: { id: sale.id }, data: { paymentStatus: 'PAID', paymentMethod: input.method } });
      if (sessionId) {
        await transaction.cashMovement.create({
          data: {
            tenantId: user.tenantId,
            sessionId,
            actorId: user.id,
            movementType: 'SALE_CASH',
            amount: input.amount,
            reason: `Cash payment for ${sale.saleNumber}`,
            idempotencyKey: `payment:${created.id}`,
          },
        });
      }
      return created;
    });
    await this.recordAudit(user, 'payment.confirmed', payment.id, { saleId: sale.id, method: input.method, amount: input.amount });
    return payment;
  }

  async handleWebhook(signature: string | undefined, input: PaymentWebhookDto) {
    const payload = JSON.stringify(input);
    const secret = process.env.PAYMENT_WEBHOOK_SECRET ?? 'local-payment-webhook-secret';
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    if (!signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      throw new UnauthorizedException('Invalid payment webhook signature');
    }
    const event = await this.prisma.paymentWebhookEvent.create({
      data: { provider: input.provider, eventId: input.eventId, signatureValid: true, payload, processedAt: new Date() },
    }).catch((error: unknown) => {
      this.throwConflict(error, 'Payment webhook already processed');
    });
    const payment = await this.prisma.paymentTransaction.update({
      where: { id: input.paymentId },
      data: { status: input.status, ...(input.status === 'CONFIRMED' ? { confirmedAt: new Date() } : { failureReason: 'Provider reported failure' }) },
    });
    return { eventId: event.id, paymentId: payment.id, status: payment.status };
  }

  async createRefund(user: AuthenticatedUser, input: CreateRefundDto) {
    const sale = await this.prisma.sale.findFirst({ where: { id: input.saleId, tenantId: user.tenantId, branchId: { in: user.branchIds }, paymentStatus: 'PAID' } });
    if (!sale) throw new NotFoundException('Paid sale not found');
    const refunded = await this.prisma.refund.aggregate({ where: { saleId: sale.id, status: { in: ['PENDING_APPROVAL', 'APPROVED', 'COMPLETED'] } }, _sum: { amount: true } });
    const alreadyRefunded = refunded._sum.amount ?? new Prisma.Decimal(0);
    if (new Prisma.Decimal(input.amount).greaterThan(sale.total.sub(alreadyRefunded))) throw new BadRequestException('Refund exceeds refundable amount');
    if (input.sessionId) await this.getOpenSession(user, input.sessionId);
    try {
      const refund = await this.prisma.refund.create({
        data: { tenantId: user.tenantId, saleId: sale.id, sessionId: input.sessionId, requestedById: user.id, amount: input.amount, reason: input.reason.trim(), idempotencyKey: input.idempotencyKey },
      });
      await this.recordAudit(user, 'refund.requested', refund.id, { saleId: sale.id, amount: input.amount });
      return refund;
    } catch (error) {
      this.throwConflict(error, 'Refund idempotency key already exists');
    }
  }

  async reviewRefund(user: AuthenticatedUser, refundId: string, input: ReviewRefundDto) {
    const refund = await this.getRefund(user, refundId);
    if (refund.requestedById === user.id) throw new ForbiddenException('Requester cannot approve their own refund');
    if (refund.status !== 'PENDING_APPROVAL') throw new BadRequestException('Only pending refunds can be reviewed');
    const updated = await this.prisma.refund.update({ where: { id: refund.id }, data: { status: input.approved ? 'APPROVED' : 'REJECTED', approvedById: user.id, approvedAt: new Date() } });
    await this.recordAudit(user, input.approved ? 'refund.approved' : 'refund.rejected', refund.id, {});
    return updated;
  }

  async completeRefund(user: AuthenticatedUser, refundId: string) {
    const refund = await this.getRefund(user, refundId);
    if (refund.status !== 'APPROVED') throw new BadRequestException('Only approved refunds can be completed');
    const result = await this.prisma.$transaction(async (transaction) => {
      const completed = await transaction.refund.update({ where: { id: refund.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
      const totalRefunded = await transaction.refund.aggregate({ where: { saleId: refund.saleId, status: 'COMPLETED' }, _sum: { amount: true } });
      const sale = await transaction.sale.findUniqueOrThrow({ where: { id: refund.saleId } });
      await transaction.sale.update({ where: { id: sale.id }, data: { paymentStatus: (totalRefunded._sum.amount ?? new Prisma.Decimal(0)).greaterThanOrEqualTo(sale.total) ? 'REFUNDED' : 'PARTIALLY_REFUNDED' } });
      if (refund.sessionId) {
        await transaction.cashMovement.create({ data: { tenantId: user.tenantId, sessionId: refund.sessionId, actorId: user.id, movementType: 'REFUND_CASH', amount: refund.amount, reason: `Refund for ${sale.saleNumber}`, idempotencyKey: `refund:${refund.id}` } });
      }
      return completed;
    });
    await this.recordAudit(user, 'refund.completed', refund.id, { amount: refund.amount.toString() });
    return result;
  }

  private async getOpenSession(user: AuthenticatedUser, sessionId: string) {
    const session = await this.prisma.cashSession.findFirst({ where: { id: sessionId, tenantId: user.tenantId, branchId: { in: user.branchIds }, status: 'OPEN' }, include: sessionInclude });
    if (!session) throw new NotFoundException('Open cash session not found');
    return session;
  }

  private async getRefund(user: AuthenticatedUser, refundId: string) {
    const refund = await this.prisma.refund.findFirst({ where: { id: refundId, tenantId: user.tenantId, sale: { branchId: { in: user.branchIds } } } });
    if (!refund) throw new NotFoundException('Refund not found');
    return refund;
  }

  private async expectedCash(sessionId: string, openingFloat: Prisma.Decimal) {
    const movements = await this.prisma.cashMovement.findMany({ where: { sessionId } });
    return this.money(movements.reduce((total, movement) => total + (movement.movementType === 'CASH_OUT' || movement.movementType === 'REFUND_CASH' ? -movement.amount.toNumber() : movement.amount.toNumber()), openingFloat.toNumber()));
  }

  private assertBranch(user: AuthenticatedUser, branchId: string) {
    if (!user.branchIds.includes(branchId)) throw new ForbiddenException('Branch access denied');
  }

  private money(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private async recordAudit(user: AuthenticatedUser, action: string, entityId: string, metadata: Prisma.InputJsonObject) {
    await this.audit.record({ tenantId: user.tenantId, actorId: user.id, action, entityType: 'Payments', entityId, metadata });
  }

  private throwConflict(error: unknown, message: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException(message);
    throw error;
  }
}
