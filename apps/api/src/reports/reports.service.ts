import { BadRequestException, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { JobsService } from '../jobs/jobs.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ExportReportDto, ReportQueryDto, ReportType } from './dto/reports.dto.js';

type ReportResult = { type: ReportType; generatedAt: string; filters: Record<string, unknown>; total: number; summary: Record<string, number>; rows: Record<string, unknown>[] };

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly jobs: JobsService,
  ) {}

  async run(user: AuthenticatedUser, query: ReportQueryDto): Promise<ReportResult> {
    const branchIds = this.allowedBranches(user, query.branchId);
    const range = this.dateRange(query);
    const filters = Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined));
    if (query.type === 'INVENTORY' || query.type === 'LOW_STOCK' || query.type === 'EXPIRY') {
      return this.inventory(user, query, branchIds, filters);
    }
    if (query.type === 'CASH') return this.cash(user, query, branchIds, range, filters);
    if (query.type === 'REFUNDS') return this.refunds(user, query, branchIds, range, filters);
    return this.sales(user, query, branchIds, range, filters);
  }

  async export(user: AuthenticatedUser, query: ExportReportDto, response: Response) {
    const result = await this.run(user, query);
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    if (result.total > 5000) {
      const job = await this.jobs.enqueue(user, {
        jobType: 'REPORT_EXPORT',
        dedupeKey: `report-export:${query.type}:${user.id}:${Date.now()}`,
        payload: { ...query },
      });
      await this.prisma.reportExport.create({ data: { tenantId: user.tenantId, requestedById: user.id, reportType: query.type, format: query.format, status: 'QUEUED', filters: query as unknown as Prisma.InputJsonValue, tokenHash: this.hash(token), expiresAt } });
      return response.status(202).json({ status: 'QUEUED', jobId: job.id, token, expiresAt, total: result.total });
    }
    const filename = `${query.type.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.${query.format}`;
    const body = query.format === 'csv' ? this.csv(result) : this.pdf(result);
    const content = typeof body === 'string' ? Buffer.from(body) : body;
    await this.prisma.reportExport.create({ data: { tenantId: user.tenantId, requestedById: user.id, reportType: query.type, format: query.format, filters: query as unknown as Prisma.InputJsonValue, tokenHash: this.hash(token), content, expiresAt } });
    await this.audit.record({ tenantId: user.tenantId, actorId: user.id, action: 'report.export.created', entityType: 'ReportExport', metadata: { reportType: query.type, format: query.format } });
    return response.json({ status: 'READY', token, downloadUrl: `/api/reports/exports/${token}`, expiresAt, filename });
  }

  async download(user: AuthenticatedUser, token: string, response: Response) {
    const exportRecord = await this.prisma.reportExport.findFirst({ where: { tenantId: user.tenantId, tokenHash: this.hash(token), expiresAt: { gt: new Date() }, status: 'READY' } });
    if (!exportRecord?.content) throw new BadRequestException('Export link is invalid or expired');
    await this.prisma.reportExport.update({ where: { id: exportRecord.id }, data: { downloadedAt: new Date() } });
    response.setHeader('Content-Type', exportRecord.format === 'csv' ? 'text/csv; charset=utf-8' : 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${exportRecord.reportType.toLowerCase()}.${exportRecord.format}"`);
    return response.send(exportRecord.content);
  }

  private async sales(user: AuthenticatedUser, query: ReportQueryDto, branchIds: string[], range: { gte?: Date; lt?: Date }, filters: Record<string, unknown>): Promise<ReportResult> {
    const sales = await this.prisma.sale.findMany({
      where: {
        tenantId: user.tenantId,
        branchId: { in: branchIds },
        status: query.type === 'VOIDS' ? { in: ['VOID', 'CANCELLED'] } : 'COMPLETED',
        ...(range.gte || range.lt ? { createdAt: range } : {}),
        ...(query.cashierId ? { cashierId: query.cashierId } : {}),
        ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
      },
      include: { branch: true, cashier: true, lines: { include: { product: { include: { company: true, group: true, suppliers: { where: query.supplierId ? { supplierId: query.supplierId } : undefined } } }, batch: true } }, payments: true },
      orderBy: { createdAt: 'desc' },
    });
    const rows = sales.flatMap((sale) => sale.lines.filter((line) => {
      const product = line.product;
      return (!query.productId || product.id === query.productId) && (!query.companyId || product.companyId === query.companyId) && (!query.groupId || product.groupId === query.groupId) && (!query.batchId || line.batchId === query.batchId) && (!query.supplierId || product.suppliers.some((supplier) => supplier.supplierId === query.supplierId));
    }).map((line) => ({
      saleId: sale.id, saleNumber: sale.saleNumber, date: sale.createdAt.toISOString(), period: this.period(sale.createdAt, query.type), branch: sale.branch.code, cashier: `${sale.cashier.firstName} ${sale.cashier.lastName}`.trim(), paymentMethod: sale.paymentMethod ?? '', product: line.productName, sku: line.sku, batch: line.batch?.batchNumber ?? '', quantity: line.quantity, revenue: this.number(line.lineTotal), tax: this.number(line.taxAmount), cost: this.number(line.batch?.purchaseCost ?? line.product.purchasePrice) * line.quantity, profit: this.number(line.lineTotal) - this.number(line.batch?.purchaseCost ?? line.product.purchasePrice) * line.quantity,
    })));
    const paged = this.page(rows, query);
    const summary = rows.reduce((sum, row) => ({ quantity: sum.quantity + Number(row.quantity), revenue: sum.revenue + Number(row.revenue), tax: sum.tax + Number(row.tax), cost: sum.cost + Number(row.cost), profit: sum.profit + Number(row.profit) }), { quantity: 0, revenue: 0, tax: 0, cost: 0, profit: 0 });
    return { type: query.type, generatedAt: new Date().toISOString(), filters, total: rows.length, summary: this.roundSummary(summary), rows: paged };
  }

  private async cash(user: AuthenticatedUser, query: ReportQueryDto, branchIds: string[], range: { gte?: Date; lt?: Date }, filters: Record<string, unknown>): Promise<ReportResult> {
    const sessions = await this.prisma.cashSession.findMany({ where: { tenantId: user.tenantId, branchId: { in: branchIds }, ...(query.branchId ? { branchId: query.branchId } : {}), ...(range.gte || range.lt ? { openedAt: range } : {}) }, include: { branch: true, movements: true, payments: true } });
    const rows = sessions.map((session) => ({ sessionId: session.id, branch: session.branch.code, openedAt: session.openedAt.toISOString(), closedAt: session.closedAt?.toISOString() ?? '', status: session.status, openingFloat: this.number(session.openingFloat), payments: session.payments.filter((payment) => !query.paymentMethod || payment.method === query.paymentMethod).reduce((sum, payment) => sum + this.number(payment.amount), 0), movements: session.movements.reduce((sum, movement) => sum + this.number(movement.amount), 0), discrepancy: this.number(session.discrepancy ?? 0) }));
    const summary = rows.reduce((sum, row) => ({ openingFloat: sum.openingFloat + Number(row.openingFloat), payments: sum.payments + Number(row.payments), movements: sum.movements + Number(row.movements), discrepancy: sum.discrepancy + Number(row.discrepancy) }), { openingFloat: 0, payments: 0, movements: 0, discrepancy: 0 });
    return { type: 'CASH', generatedAt: new Date().toISOString(), filters, total: rows.length, summary: this.roundSummary(summary), rows: this.page(rows, query) };
  }

  private async refunds(user: AuthenticatedUser, query: ReportQueryDto, branchIds: string[], range: { gte?: Date; lt?: Date }, filters: Record<string, unknown>): Promise<ReportResult> {
    const refunds = await this.prisma.refund.findMany({ where: { tenantId: user.tenantId, sale: { branchId: { in: branchIds }, ...(query.branchId ? { branchId: query.branchId } : {}), ...(query.cashierId ? { cashierId: query.cashierId } : {}) }, ...(range.gte || range.lt ? { createdAt: range } : {}) }, include: { sale: { include: { branch: true } } }, orderBy: { createdAt: 'desc' } });
    const rows = refunds.map((refund) => ({ refundId: refund.id, saleId: refund.saleId, saleNumber: refund.sale.saleNumber, date: refund.createdAt.toISOString(), branch: refund.sale.branch.code, amount: this.number(refund.amount), status: refund.status, reason: refund.reason }));
    const summary = { amount: rows.reduce((sum, row) => sum + Number(row.amount), 0) };
    return { type: 'REFUNDS', generatedAt: new Date().toISOString(), filters, total: rows.length, summary: this.roundSummary(summary), rows: this.page(rows, query) };
  }

  private async inventory(user: AuthenticatedUser, query: ReportQueryDto, branchIds: string[], filters: Record<string, unknown>): Promise<ReportResult> {
    const batches = await this.prisma.inventoryBatch.findMany({ where: { tenantId: user.tenantId, branchId: { in: branchIds }, ...(query.productId ? { productId: query.productId } : {}), ...(query.batchId ? { id: query.batchId } : {}), ...(query.branchId ? { branchId: query.branchId } : {}), ...(query.type === 'EXPIRY' ? { expiryDate: { lte: new Date(Date.now() + 90 * 86400000) } } : {}) }, include: { product: { include: { company: true, group: true, suppliers: true } }, branch: true }, orderBy: { expiryDate: 'asc' } });
    const rows = batches.filter((batch) => (!query.companyId || batch.product.companyId === query.companyId) && (!query.groupId || batch.product.groupId === query.groupId) && (!query.supplierId || batch.product.suppliers.some((supplier) => supplier.supplierId === query.supplierId)) && (query.type !== 'LOW_STOCK' || batch.quantity <= batch.product.minimumStock)).map((batch) => ({ batchId: batch.id, batchNumber: batch.batchNumber, branch: batch.branch.code, product: batch.product.name, sku: batch.product.sku, expiryDate: batch.expiryDate.toISOString(), quantity: batch.quantity, unitCost: this.number(batch.purchaseCost), valuation: this.number(batch.purchaseCost) * batch.quantity, minimumStock: batch.product.minimumStock }));
    const summary = { quantity: rows.reduce((sum, row) => sum + Number(row.quantity), 0), valuation: rows.reduce((sum, row) => sum + Number(row.valuation), 0) };
    return { type: query.type, generatedAt: new Date().toISOString(), filters, total: rows.length, summary: this.roundSummary(summary), rows: this.page(rows, query) };
  }

  private allowedBranches(user: AuthenticatedUser, branchId?: string) {
    if (branchId && !user.branchIds.includes(branchId)) throw new BadRequestException('Branch is outside your access scope');
    return branchId ? [branchId] : user.branchIds;
  }

  private dateRange(query: ReportQueryDto) { const range: { gte?: Date; lt?: Date } = {}; if (query.from) range.gte = new Date(query.from); if (query.to) { const end = new Date(query.to); end.setUTCDate(end.getUTCDate() + 1); range.lt = end; } return range; }
  private hash(token: string) { return createHash('sha256').update(token).digest('hex'); }
  private period(date: Date, type: ReportType) { if (type === 'DAILY_SALES') return date.toISOString().slice(0, 10); if (type === 'MONTHLY_SALES') return date.toISOString().slice(0, 7); if (type === 'YEARLY_SALES') return date.toISOString().slice(0, 4); return ''; }
  private page(rows: Record<string, unknown>[], query: ReportQueryDto) { return rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize); }
  private number(value: Prisma.Decimal | number) { return typeof value === 'number' ? value : value.toNumber(); }
  private roundSummary(summary: Record<string, number>) { return Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, Math.round(value * 100) / 100])); }
  private csv(result: ReportResult) {
    const first = result.rows[0];
    const columns = first ? Object.keys(first) : ['result'];
    const stringify = (value: unknown) => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'string') return /^[=+\-@]/.test(value) ? `'${value}` : value;
      if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return value.toString();
      return JSON.stringify(value);
    };
    const line = (values: unknown[]) => values.map((value) => `"${stringify(value).replaceAll('"', '""')}"`).join(',');
    return [line(columns), ...result.rows.map((row) => line(columns.map((column) => row[column]))), '', line(Object.keys(result.summary)), line(Object.values(result.summary))].join('\n');
  }
  private pdf(result: ReportResult) { const text = `${result.type} report\nGenerated: ${result.generatedAt}\nRows: ${result.total}\n${result.rows.slice(0, 40).map((row) => Object.values(row).join(' | ')).join('\n')}`.replace(/[()\\]/g, (value) => `\\${value}`); const stream = `BT /F1 9 Tf 40 760 Td (${text.replaceAll('\n', ') Tj 0 -12 Td (')}) Tj ET`; const objects = [`<< /Type /Catalog /Pages 2 0 R >>`, `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`]; let pdf = '%PDF-1.4\n'; const offsets: number[] = []; objects.forEach((object, index) => { offsets[index + 1] = pdf.length; pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; }); const xref = pdf.length; pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`; return Buffer.from(pdf); }
}
