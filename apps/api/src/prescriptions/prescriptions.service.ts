import { createHmac, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreatePrescriptionDocumentDto,
  CreatePrescriptionDto,
  PrescriptionQueryDto,
  ReviewPrescriptionDto,
} from './dto/prescriptions.dto.js';

const prescriptionInclude = {
  customer: true,
  lines: { include: { product: true } },
  documents: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' as const } },
} satisfies Prisma.PrescriptionInclude;

@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(user: AuthenticatedUser, query: PrescriptionQueryDto) {
    return this.prisma.prescription.findMany({
      where: {
        tenantId: user.tenantId,
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: prescriptionInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async create(user: AuthenticatedUser, input: CreatePrescriptionDto) {
    const customer = await this.prisma.customer.findFirst({ where: { id: input.customerId, tenantId: user.tenantId } });
    if (!customer) throw new NotFoundException('Customer not found');
    if (new Set(input.lines.map((line) => line.productId)).size !== input.lines.length) {
      throw new BadRequestException('Prescription products must be unique');
    }
    const products = await this.prisma.product.findMany({
      where: { id: { in: input.lines.map((line) => line.productId) }, tenantId: user.tenantId, isActive: true },
      select: { id: true },
    });
    if (products.length !== input.lines.length) throw new NotFoundException('Product not found');
    const issuedAt = new Date(input.issuedAt);
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : undefined;
    if (issuedAt > new Date()) throw new BadRequestException('Prescription issue date cannot be in the future');
    if (expiresAt && expiresAt <= issuedAt) throw new BadRequestException('Prescription expiry must follow issue date');
    try {
      const prescription = await this.prisma.prescription.create({
        data: {
          tenantId: user.tenantId,
          customerId: customer.id,
          referenceNumber: input.referenceNumber.trim(),
          prescriberName: input.prescriberName.trim(),
          prescriberLicense: input.prescriberLicense?.trim(),
          issuedAt,
          expiresAt,
          notes: input.notes?.trim(),
          createdById: user.id,
          lines: { create: input.lines.map((line) => ({ productId: line.productId, authorizedQuantity: line.authorizedQuantity, instructions: line.instructions?.trim() })) },
        },
        include: prescriptionInclude,
      });
      await this.recordAudit(user, 'prescription.created', prescription.id, { customerId: customer.id });
      return prescription;
    } catch (error) {
      this.throwConflict(error, 'Prescription reference already exists');
    }
  }

  async review(user: AuthenticatedUser, prescriptionId: string, input: ReviewPrescriptionDto) {
    const prescription = await this.getPrescription(user, prescriptionId);
    if (prescription.createdById === user.id) throw new ForbiddenException('Prescription creator cannot approve it');
    if (prescription.status !== 'PENDING_APPROVAL') throw new BadRequestException('Only pending prescriptions can be reviewed');
    const updated = await this.prisma.prescription.update({
      where: { id: prescription.id },
      data: {
        status: input.approved ? 'APPROVED' : 'REJECTED',
        approvedById: user.id,
        approvedAt: new Date(),
        rejectionReason: input.approved ? null : input.reason?.trim(),
      },
      include: prescriptionInclude,
    });
    await this.recordAudit(user, input.approved ? 'prescription.approved' : 'prescription.rejected', prescription.id, { reason: input.reason });
    return updated;
  }

  async listDocuments(user: AuthenticatedUser, prescriptionId: string) {
    await this.getPrescription(user, prescriptionId);
    await this.recordAudit(user, 'prescription.documents.listed', prescriptionId, {});
    return this.prisma.prescriptionDocument.findMany({
      where: { tenantId: user.tenantId, prescriptionId, deletedAt: null },
      select: { id: true, fileName: true, mimeType: true, sizeBytes: true, sha256: true, encrypted: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addDocument(user: AuthenticatedUser, prescriptionId: string, input: CreatePrescriptionDocumentDto) {
    await this.getPrescription(user, prescriptionId);
    const document = await this.prisma.prescriptionDocument.create({
      data: {
        tenantId: user.tenantId,
        prescriptionId,
        uploadedById: user.id,
        objectKey: `${user.tenantId}/prescriptions/${prescriptionId}/${randomUUID()}`,
        fileName: input.fileName.trim(),
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        sha256: input.sha256.toLowerCase(),
        encrypted: true,
      },
      select: { id: true, fileName: true, mimeType: true, sizeBytes: true, sha256: true, encrypted: true, createdAt: true },
    });
    await this.recordAudit(user, 'prescription.document.uploaded', document.id, { prescriptionId, sizeBytes: input.sizeBytes });
    return document;
  }

  async accessDocument(user: AuthenticatedUser, prescriptionId: string, documentId: string) {
    await this.getPrescription(user, prescriptionId);
    const document = await this.prisma.prescriptionDocument.findFirst({ where: { id: documentId, tenantId: user.tenantId, prescriptionId, deletedAt: null } });
    if (!document) throw new NotFoundException('Prescription document not found');
    const expiresAt = Date.now() + 5 * 60 * 1000;
    const value = `${document.id}.${expiresAt}`;
    const secret = process.env.DOCUMENT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? 'local-document-secret';
    const accessToken = createHmac('sha256', secret).update(value).digest('hex');
    await this.recordAudit(user, 'prescription.document.accessed', document.id, { expiresAt });
    return { documentId: document.id, objectKey: document.objectKey, expiresAt, accessToken };
  }

  async deleteDocument(user: AuthenticatedUser, prescriptionId: string, documentId: string) {
    await this.getPrescription(user, prescriptionId);
    const document = await this.prisma.prescriptionDocument.findFirst({ where: { id: documentId, tenantId: user.tenantId, prescriptionId, deletedAt: null } });
    if (!document) throw new NotFoundException('Prescription document not found');
    const deleted = await this.prisma.prescriptionDocument.update({ where: { id: document.id }, data: { deletedAt: new Date() }, select: { id: true, deletedAt: true } });
    await this.recordAudit(user, 'prescription.document.deleted', document.id, {});
    return deleted;
  }

  private async getPrescription(user: AuthenticatedUser, prescriptionId: string) {
    const prescription = await this.prisma.prescription.findFirst({ where: { id: prescriptionId, tenantId: user.tenantId }, include: prescriptionInclude });
    if (!prescription) throw new NotFoundException('Prescription not found');
    return prescription;
  }

  private async recordAudit(user: AuthenticatedUser, action: string, entityId: string, metadata: Prisma.InputJsonObject) {
    await this.audit.record({ tenantId: user.tenantId, actorId: user.id, action, entityType: 'Prescription', entityId, metadata });
  }

  private throwConflict(error: unknown, message: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException(message);
    throw error;
  }
}
