import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger, Injectable, NotFoundException } from '@nestjs/common';

import { BranchEntity } from '@/modules/branches/infrastructure/persistence/relational/entities/branch.entity';
import { ProductEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product.entity';
import { UserEntity } from '@/modules/users/infrastructure/persistence/relational/entities/user.entity';
import { BranchGroupAmountApprovalRuleEntity } from '@/modules/branch-groups/infrastructure/persistence/relational/entities/branch-group-amount-approval-rule.entity';
import {
  CategoryFlag,
  BranchGroupCategoryApprovalRuleEntity,
} from '@/modules/branch-groups/infrastructure/persistence/relational/entities/branch-group-category-approval-rule.entity';

import { PurchaseOrderEntity } from './infrastructure/persistence/relational/entities/purchase-order.entity';
import { PurchaseOrderItemEntity } from './infrastructure/persistence/relational/entities/purchase-order-item.entity';

/**
 * Resultado de evaluar quién puede aprobar una OC.
 *
 * - `requiredApproverRoles`: lista de roles que DEBEN firmar.
 *   Si la OC tiene N categorías especiales, hay N roles especiales + 1 rol por
 *   monto. Para que la OC se apruebe, un mismo usuario debe satisfacer TODOS
 *   (o múltiples usuarios firman secuencialmente — fase futura).
 * - `bypassed`: true cuando el grupo no tiene reglas configuradas o la OC es
 *   una consignación. El comportamiento legacy (cualquier user con permiso
 *   `PURCHASE_APPROVE`) aplica.
 * - `reason`: explicación legible para el frontend ("Pendiente aprobación de Supervisor").
 */
export interface ApprovalRequirement {
  bypassed: boolean;
  requiredApproverRoles: Array<{ id: string; name: string; reason: 'amount' | CategoryFlag }>;
  totalUsd: number;
  triggeredCategoryFlags: CategoryFlag[];
  reason: string;
}

export interface ApprovalCheck {
  canApprove: boolean;
  requirement: ApprovalRequirement;
  /** Si false, este es el mensaje a mostrar al usuario. */
  denialReason?: string;
}

@Injectable()
export class ApprovalEngineService {
  private readonly logger = new Logger(ApprovalEngineService.name);

  constructor(
    @InjectRepository(PurchaseOrderEntity)
    private readonly orderRepo: Repository<PurchaseOrderEntity>,
    @InjectRepository(PurchaseOrderItemEntity)
    private readonly orderItemRepo: Repository<PurchaseOrderItemEntity>,
    @InjectRepository(BranchEntity)
    private readonly branchRepo: Repository<BranchEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(BranchGroupAmountApprovalRuleEntity)
    private readonly amountRuleRepo: Repository<BranchGroupAmountApprovalRuleEntity>,
    @InjectRepository(BranchGroupCategoryApprovalRuleEntity)
    private readonly categoryRuleRepo: Repository<BranchGroupCategoryApprovalRuleEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /**
   * Calcula los roles requeridos para aprobar una OC dada.
   *
   * Reglas:
   *   1. Consignaciones (orderType='consignment') NO pasan por el motor —
   *      cualquier usuario con permiso de aprobar firma (PDF Política OC §3).
   *   2. La OC pertenece a una sucursal → grupo. Si la sucursal no tiene grupo
   *      o el grupo no tiene reglas, el motor "bypassa" y delega a la lógica
   *      legacy (cualquier user con permiso aprueba).
   *   3. Si hay reglas de monto: encuentra el rol cuyo rango cubre `total_usd`.
   *   4. Si hay productos con bandera especial (controlled, antibiotic,
   *      cold_chain, imported) Y existe regla de categoría para esa bandera
   *      en el grupo: agrega ese rol como requerido.
   *   5. Si en el paso 3 no hay match (ningún rol cubre el monto), se reporta
   *      "Sin aprobador configurado para este monto" → la OC queda bloqueada
   *      hasta que un admin agregue la regla.
   */
  async getRequirement(orderId: string): Promise<ApprovalRequirement> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Orden de compra no encontrada');

    // Consignaciones: bypass total.
    if (order.orderType === 'consignment') {
      return {
        bypassed: true,
        requiredApproverRoles: [],
        totalUsd: Number(order.totalUsd),
        triggeredCategoryFlags: [],
        reason: 'Consignación: aprobación abierta a cualquier usuario con permiso de compras.',
      };
    }

    const branch = await this.branchRepo.findOne({ where: { id: order.branchId } });
    if (!branch?.branchGroupId) {
      return {
        bypassed: true,
        requiredApproverRoles: [],
        totalUsd: Number(order.totalUsd),
        triggeredCategoryFlags: [],
        reason: 'Sucursal sin grupo asignado: aprobación abierta a cualquier usuario con permiso.',
      };
    }

    const branchGroupId = branch.branchGroupId;
    const totalUsd = Number(order.totalUsd);

    // Reglas de monto del grupo
    const amountRules = await this.amountRuleRepo.find({
      where: { branchGroupId },
      relations: ['role'],
      order: { minUsd: 'ASC' },
    });

    if (amountRules.length === 0) {
      return {
        bypassed: true,
        requiredApproverRoles: [],
        totalUsd,
        triggeredCategoryFlags: [],
        reason: 'Grupo sin matriz de aprobación: aprobación abierta a cualquier usuario con permiso.',
      };
    }

    const required: ApprovalRequirement['requiredApproverRoles'] = [];
    const matchedAmountRule = amountRules.find((r) => {
      const min = Number(r.minUsd);
      const max = r.maxUsd === null ? Number.POSITIVE_INFINITY : Number(r.maxUsd);
      return totalUsd >= min && totalUsd <= max;
    });

    if (!matchedAmountRule) {
      return {
        bypassed: false,
        requiredApproverRoles: [],
        totalUsd,
        triggeredCategoryFlags: [],
        reason: `Sin aprobador configurado en este grupo para el monto $${totalUsd.toFixed(2)}. Pide a un administrador que agregue la regla.`,
      };
    }

    required.push({
      id: matchedAmountRule.role.id,
      name: matchedAmountRule.role.name,
      reason: 'amount',
    });

    // Categorías especiales: cargamos los productos de la OC y vemos qué flags tienen.
    const triggeredFlags = await this.detectTriggeredCategoryFlags(orderId);
    if (triggeredFlags.length > 0) {
      const categoryRules = await this.categoryRuleRepo.find({
        where: { branchGroupId },
        relations: ['role'],
      });
      const flagToRule = new Map(categoryRules.map((r) => [r.categoryFlag, r]));
      for (const flag of triggeredFlags) {
        const rule = flagToRule.get(flag);
        if (rule) {
          // Evita duplicar si el rol ya está en la lista por monto.
          if (!required.some((r) => r.id === rule.role.id)) {
            required.push({ id: rule.role.id, name: rule.role.name, reason: flag });
          }
        }
        // Si no hay regla configurada para esa flag, simplemente no se agrega
        // un requisito adicional (el grupo no la considera sensible).
      }
    }

    return {
      bypassed: false,
      requiredApproverRoles: required,
      totalUsd,
      triggeredCategoryFlags: triggeredFlags,
      reason: this.formatReason(required, totalUsd, triggeredFlags),
    };
  }

  /**
   * Verifica si un usuario específico puede aprobar la OC.
   * Las OCs bypassadas las puede aprobar cualquier user con permiso (controlado
   * por el guard de permisos en el controller — el engine no es responsable).
   */
  async checkUserCanApprove(orderId: string, userId: string): Promise<ApprovalCheck> {
    const requirement = await this.getRequirement(orderId);

    if (requirement.bypassed) {
      return { canApprove: true, requirement };
    }

    if (requirement.requiredApproverRoles.length === 0) {
      // Caso "sin aprobador configurado para este monto"
      return {
        canApprove: false,
        requirement,
        denialReason: requirement.reason,
      };
    }

    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['role'],
    });
    if (!user) {
      return {
        canApprove: false,
        requirement,
        denialReason: 'Usuario no encontrado.',
      };
    }

    const userRoleId = user.role?.id;
    const matches = requirement.requiredApproverRoles.find((r) => r.id === userRoleId);

    if (matches) {
      // Caso simple: el usuario satisface al menos un requisito. Si hay
      // múltiples roles requeridos (monto + categoría) y el usuario solo
      // cumple uno, se aprueba aquí. La aprobación multi-rol con firmas
      // separadas es trabajo de una fase futura — por ahora una sola firma
      // basta si el usuario está en la lista de roles requeridos.
      return { canApprove: true, requirement };
    }

    const expected = requirement.requiredApproverRoles.map((r) => r.name).join(' o ');
    return {
      canApprove: false,
      requirement,
      denialReason: `Tu rol "${user.role?.name ?? '—'}" no puede aprobar esta OC. Requiere: ${expected}.`,
    };
  }

  private async detectTriggeredCategoryFlags(orderId: string): Promise<CategoryFlag[]> {
    const items = await this.orderItemRepo.find({ where: { orderId } });
    if (items.length === 0) return [];
    const productIds = [...new Set(items.map((i) => i.productId))];
    const products = await this.productRepo.find({ where: productIds.map((id) => ({ id })) });

    const flags = new Set<CategoryFlag>();
    for (const p of products) {
      if (p.isControlled) flags.add('controlled');
      if (p.isAntibiotic) flags.add('antibiotic');
      if (p.conservationType === 'cold_chain') flags.add('cold_chain');
      if (p.isImported) flags.add('imported');
    }
    return Array.from(flags);
  }

  private formatReason(
    required: ApprovalRequirement['requiredApproverRoles'],
    totalUsd: number,
    flags: CategoryFlag[],
  ): string {
    if (required.length === 0) return 'Sin aprobador configurado.';
    const names = required.map((r) => r.name).join(' o ');
    const parts = [`Requiere aprobación de ${names} (monto $${totalUsd.toFixed(2)})`];
    if (flags.length > 0) {
      const flagLabels: Record<CategoryFlag, string> = {
        controlled: 'controlados',
        antibiotic: 'antibióticos',
        cold_chain: 'cadena de frío',
        imported: 'importados',
      };
      parts.push(`incluye categorías especiales: ${flags.map((f) => flagLabels[f]).join(', ')}`);
    }
    return parts.join('; ') + '.';
  }
}
