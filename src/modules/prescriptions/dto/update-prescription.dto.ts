import { OmitType, PartialType } from '@nestjs/mapped-types';

import { CreatePrescriptionDto } from './create-prescription.dto';

/**
 * No se permite mutar `items` ni `customerId` desde update; los items se
 * editan vía endpoints específicos. customerId no cambia: si se equivocaron
 * de cliente, se anula y crea uno nuevo.
 */
export class UpdatePrescriptionDto extends PartialType(
  OmitType(CreatePrescriptionDto, ['items', 'customerId'] as const),
) {}
