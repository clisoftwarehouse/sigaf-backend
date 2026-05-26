import * as bcrypt from 'bcryptjs';
import { IsNull, Repository } from 'typeorm';
import { randomInt, randomBytes } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';

import { TerminalEntity } from './infrastructure/persistence/relational/entities/terminal.entity';
import { TerminalApiKeyEntity } from './infrastructure/persistence/relational/entities/terminal-api-key.entity';
import { TerminalPairingCodeEntity } from './infrastructure/persistence/relational/entities/terminal-pairing-code.entity';

const PAIRING_CODE_TTL_MIN = 10;
const API_KEY_PREFIX = 'sgft';
const BCRYPT_ROUNDS = 10;

export interface PairingTokenIssue {
  code: string;
  expiresAt: Date;
}

export interface PairResult {
  terminalId: string;
  branchId: string;
  terminalCode: string;
  apiKey: string; // sólo se entrega una vez
  apiKeyId: string;
}

export interface ValidatedTerminal {
  terminalId: string;
  branchId: string;
  apiKeyId: string;
}

function generatePairingCode(): string {
  // Formato XXX-XXX-XXX, alfanumérico con caracteres legibles.
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = () => Array.from({ length: 3 }, () => alpha.charAt(randomInt(0, alpha.length))).join('');
  return `${seg()}-${seg()}-${seg()}`;
}

function generateApiKey(): { full: string; prefix: string } {
  const random = randomBytes(32).toString('base64url');
  const full = `${API_KEY_PREFIX}_${random}`;
  return { full, prefix: full.slice(0, 12) };
}

@Injectable()
export class TerminalPairingService {
  constructor(
    @InjectRepository(TerminalEntity)
    private readonly terminalRepo: Repository<TerminalEntity>,
    @InjectRepository(TerminalPairingCodeEntity)
    private readonly codeRepo: Repository<TerminalPairingCodeEntity>,
    @InjectRepository(TerminalApiKeyEntity)
    private readonly apiKeyRepo: Repository<TerminalApiKeyEntity>,
  ) {}

  /**
   * Admin genera un código de pairing para un terminal específico.
   * Sólo puede haber un código activo por terminal a la vez (los anteriores
   * vivos se invalidan al emitir uno nuevo).
   */
  async issuePairingCode(terminalId: string, userId: string): Promise<PairingTokenIssue> {
    const terminal = await this.terminalRepo.findOne({
      where: { id: terminalId, isActive: true },
    });
    if (!terminal) throw new NotFoundException('Terminal no encontrado o inactivo');

    // Invalidar códigos previos no consumidos.
    await this.codeRepo
      .createQueryBuilder()
      .update()
      .set({ consumedAt: () => 'now()' })
      .where('terminal_id = :tid AND consumed_at IS NULL', { tid: terminalId })
      .execute();

    const code = generatePairingCode();
    const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MIN * 60_000);
    await this.codeRepo.save(
      this.codeRepo.create({
        code,
        terminalId,
        expiresAt,
        createdByUserId: userId,
      }),
    );
    return { code, expiresAt };
  }

  /**
   * El PC instalador envía el código y recibe la apiKey (en claro, una sola vez).
   * Se persiste solo el hash bcrypt + prefix para validación posterior.
   */
  async pair(code: string): Promise<PairResult> {
    const record = await this.codeRepo.findOne({
      where: { code: code.trim().toUpperCase() },
      relations: ['terminal'],
    });
    if (!record) throw new BadRequestException('Código inválido');
    if (record.consumedAt) throw new BadRequestException('Código ya utilizado');
    if (record.expiresAt < new Date()) {
      throw new BadRequestException('Código vencido');
    }
    if (!record.terminal.isActive) {
      throw new BadRequestException('El terminal asociado está inactivo');
    }

    // Revocar TODAS las apiKeys activas previas del mismo terminal: un
    // terminal puede estar emparejado con UN solo PC físico a la vez. Si
    // alguien redime un código nuevo, asumimos que el PC anterior se perdió/
    // cambió y revocamos el viejo apiKey. El operador admin ve ambos en
    // historial (activa vs revocada).
    await this.apiKeyRepo
      .createQueryBuilder()
      .update()
      .set({ revokedAt: () => 'now()', revokedByUserId: record.createdByUserId })
      .where('terminal_id = :tid AND revoked_at IS NULL', { tid: record.terminalId })
      .execute();

    const { full, prefix } = generateApiKey();
    const hash = await bcrypt.hash(full, BCRYPT_ROUNDS);

    const apiKey = await this.apiKeyRepo.save(
      this.apiKeyRepo.create({
        terminalId: record.terminalId,
        keyPrefix: prefix,
        keyHash: hash,
        label: 'pairing',
        createdByUserId: record.createdByUserId,
      }),
    );

    record.consumedAt = new Date();
    await this.codeRepo.save(record);

    return {
      terminalId: record.terminalId,
      branchId: record.terminal.branchId,
      terminalCode: record.terminal.code,
      apiKey: full,
      apiKeyId: apiKey.id,
    };
  }

  /**
   * Validar header `X-Terminal-API-Key`. Devuelve el terminalId si es válido,
   * o lanza Unauthorized. Actualiza `last_used_at` para auditoría.
   */
  async validateApiKey(rawKey: string | undefined | null): Promise<ValidatedTerminal> {
    if (!rawKey || typeof rawKey !== 'string') {
      throw new UnauthorizedException('Falta header X-Terminal-API-Key');
    }
    const trimmed = rawKey.trim();
    if (!trimmed.startsWith(`${API_KEY_PREFIX}_`)) {
      throw new UnauthorizedException('apiKey con formato inválido');
    }
    const prefix = trimmed.slice(0, 12);
    const candidates = await this.apiKeyRepo.find({
      where: { keyPrefix: prefix, revokedAt: IsNull() },
      relations: ['terminal'],
    });
    for (const candidate of candidates) {
      const ok = await bcrypt.compare(trimmed, candidate.keyHash);
      if (ok) {
        candidate.lastUsedAt = new Date();
        await this.apiKeyRepo.save(candidate);
        return {
          terminalId: candidate.terminalId,
          branchId: candidate.terminal.branchId,
          apiKeyId: candidate.id,
        };
      }
    }
    throw new UnauthorizedException('apiKey inválida o revocada');
  }

  async revokeApiKey(apiKeyId: string, userId: string): Promise<void> {
    const key = await this.apiKeyRepo.findOne({ where: { id: apiKeyId } });
    if (!key) throw new NotFoundException('apiKey no encontrada');
    if (key.revokedAt) throw new ConflictException('apiKey ya estaba revocada');
    key.revokedAt = new Date();
    key.revokedByUserId = userId;
    await this.apiKeyRepo.save(key);
  }

  async listApiKeysByTerminal(terminalId: string): Promise<TerminalApiKeyEntity[]> {
    return this.apiKeyRepo.find({
      where: { terminalId },
      order: { createdAt: 'DESC' },
    });
  }
}
