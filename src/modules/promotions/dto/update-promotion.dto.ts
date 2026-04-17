import { OmitType, PartialType } from '@nestjs/swagger';

import { CreatePromotionDto } from './create-promotion.dto';

/**
 * Actualizar una promoción. `type` no es editable (recrea la promo si cambias
 * la semántica). Los scopes se manejan con endpoints dedicados.
 */
export class UpdatePromotionDto extends PartialType(OmitType(CreatePromotionDto, ['type', 'scopes'] as const)) {}
