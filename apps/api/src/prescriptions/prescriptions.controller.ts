import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import {
  CreatePrescriptionDocumentDto,
  CreatePrescriptionDto,
  PrescriptionQueryDto,
  ReviewPrescriptionDto,
} from './dto/prescriptions.dto.js';
import { PrescriptionsService } from './prescriptions.service.js';

@ApiTags('prescriptions')
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptions: PrescriptionsService) {}

  @Get()
  @RequirePermissions('prescription.read')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: PrescriptionQueryDto) {
    return this.prescriptions.list(user, query);
  }

  @Post()
  @RequirePermissions('prescription.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() input: CreatePrescriptionDto) {
    return this.prescriptions.create(user, input);
  }

  @Post(':prescriptionId/review')
  @RequirePermissions('prescription.approve')
  review(
    @CurrentUser() user: AuthenticatedUser,
    @Param('prescriptionId') prescriptionId: string,
    @Body() input: ReviewPrescriptionDto,
  ) {
    return this.prescriptions.review(user, prescriptionId, input);
  }

  @Get(':prescriptionId/documents')
  @RequirePermissions('prescription.document')
  listDocuments(@CurrentUser() user: AuthenticatedUser, @Param('prescriptionId') prescriptionId: string) {
    return this.prescriptions.listDocuments(user, prescriptionId);
  }

  @Post(':prescriptionId/documents')
  @RequirePermissions('prescription.document')
  addDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('prescriptionId') prescriptionId: string,
    @Body() input: CreatePrescriptionDocumentDto,
  ) {
    return this.prescriptions.addDocument(user, prescriptionId, input);
  }

  @Get(':prescriptionId/documents/:documentId/access')
  @RequirePermissions('prescription.document')
  accessDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('prescriptionId') prescriptionId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.prescriptions.accessDocument(user, prescriptionId, documentId);
  }

  @Delete(':prescriptionId/documents/:documentId')
  @RequirePermissions('prescription.document')
  deleteDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('prescriptionId') prescriptionId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.prescriptions.deleteDocument(user, prescriptionId, documentId);
  }
}
