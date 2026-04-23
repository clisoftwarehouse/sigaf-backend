import { DataSource, Repository } from 'typeorm';
import { Logger, Injectable } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';

import { BrandEntity } from '@/modules/brands/infrastructure/persistence/relational/entities/brand.entity';
import { BranchEntity } from '@/modules/branches/infrastructure/persistence/relational/entities/branch.entity';
import { KardexEntity } from '@/modules/inventory/infrastructure/persistence/relational/entities/kardex.entity';
import { ProductEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product.entity';
import { SupplierEntity } from '@/modules/suppliers/infrastructure/persistence/relational/entities/supplier.entity';
import { TerminalEntity } from '@/modules/terminals/infrastructure/persistence/relational/entities/terminal.entity';
import { CategoryEntity } from '@/modules/categories/infrastructure/persistence/relational/entities/category.entity';
import { InventoryLotEntity } from '@/modules/inventory/infrastructure/persistence/relational/entities/inventory-lot.entity';
import { ProductBarcodeEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product-barcode.entity';
import { ExchangeRateEntity } from '@/modules/exchange-rates/infrastructure/persistence/relational/entities/exchange-rate.entity';
import { WarehouseLocationEntity } from '@/modules/inventory/infrastructure/persistence/relational/entities/warehouse-location.entity';
import { ActiveIngredientEntity } from '@/modules/active-ingredients/infrastructure/persistence/relational/entities/active-ingredient.entity';
import { ProductActiveIngredientEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product-active-ingredient.entity';

// ----------------------------------------------------------------------

const SYSTEM_USER = 'system';

const pickOne = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const daysFromNow = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const round2 = (n: number) => Math.round(n * 100) / 100;

// ----------------------------------------------------------------------

@Injectable()
export class DemoSeedService {
  private readonly logger = new Logger(DemoSeedService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(BranchEntity) private readonly branchRepo: Repository<BranchEntity>,
    @InjectRepository(SupplierEntity) private readonly supplierRepo: Repository<SupplierEntity>,
    @InjectRepository(BrandEntity) private readonly brandRepo: Repository<BrandEntity>,
    @InjectRepository(CategoryEntity) private readonly categoryRepo: Repository<CategoryEntity>,
    @InjectRepository(ActiveIngredientEntity)
    private readonly ingredientRepo: Repository<ActiveIngredientEntity>,
    @InjectRepository(ProductEntity) private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(ProductBarcodeEntity)
    private readonly barcodeRepo: Repository<ProductBarcodeEntity>,
    @InjectRepository(ProductActiveIngredientEntity)
    private readonly productIngRepo: Repository<ProductActiveIngredientEntity>,
    @InjectRepository(TerminalEntity) private readonly terminalRepo: Repository<TerminalEntity>,
    @InjectRepository(WarehouseLocationEntity)
    private readonly locationRepo: Repository<WarehouseLocationEntity>,
    @InjectRepository(ExchangeRateEntity)
    private readonly rateRepo: Repository<ExchangeRateEntity>,
    @InjectRepository(InventoryLotEntity)
    private readonly lotRepo: Repository<InventoryLotEntity>,
    @InjectRepository(KardexEntity)
    private readonly kardexRepo: Repository<KardexEntity>,
  ) {}

  async run(): Promise<void> {
    this.logger.log('Running demo data seed...');

    const branches = await this.seedBranches();
    const suppliers = await this.seedSuppliers();
    const brands = await this.seedBrands();
    const categories = await this.seedCategories();
    const ingredients = await this.seedActiveIngredients();
    const products = await this.seedProducts(categories, brands, ingredients);
    await this.seedTerminals(branches);
    await this.seedLocations(branches);
    await this.seedExchangeRates();
    await this.seedLots(products, branches, suppliers);

    this.logger.log('Demo seed completed.');
  }

  // ── Branches ────────────────────────────────────────────────────────
  private async seedBranches(): Promise<BranchEntity[]> {
    const data = [
      {
        name: 'Farmacia Central Caracas',
        rif: 'J-00000001-0',
        address: 'Av. Francisco de Miranda, Chacao, Caracas',
        phone: '+582122000001',
        email: 'central@sigaf.com',
      },
      {
        name: 'Farmacia Valencia',
        rif: 'J-00000002-0',
        address: 'Av. Bolívar Norte, Valencia, Carabobo',
        phone: '+582412000001',
        email: 'valencia@sigaf.com',
      },
    ];
    const out: BranchEntity[] = [];
    for (const b of data) {
      let existing = await this.branchRepo.findOne({ where: { name: b.name } });
      if (!existing) {
        existing = await this.branchRepo.save(this.branchRepo.create({ ...b, isActive: true }));
        this.logger.log(`Branch "${b.name}" created`);
      }
      out.push(existing);
    }
    return out;
  }

  // ── Suppliers ───────────────────────────────────────────────────────
  private async seedSuppliers(): Promise<SupplierEntity[]> {
    const data = [
      {
        rif: 'J-30000001-0',
        businessName: 'Droguería Central de Venezuela C.A.',
        tradeName: 'Drocenven',
        contactName: 'Pedro González',
        phone: '+582129000001',
        email: 'ventas@drocenven.com',
        address: 'Zona Industrial Los Ruices, Caracas',
        isDrugstore: true,
        paymentTermsDays: 30,
      },
      {
        rif: 'J-30000002-0',
        businessName: 'Distribuidora FarmaPlus S.A.',
        tradeName: 'FarmaPlus',
        contactName: 'María Rodríguez',
        phone: '+582129000002',
        email: 'compras@farmaplus.com',
        address: 'Av. Andrés Bello, Caracas',
        isDrugstore: true,
        paymentTermsDays: 45,
      },
      {
        rif: 'J-30000003-0',
        businessName: 'Laboratorio Bayer Venezuela',
        tradeName: 'Bayer',
        contactName: 'Luis Pérez',
        phone: '+582129000003',
        email: 'pedidos@bayer.ve',
        address: 'Zona Industrial La Yaguara, Caracas',
        isDrugstore: false,
        paymentTermsDays: 60,
      },
      {
        rif: 'J-30000004-0',
        businessName: 'Pfizer Venezuela C.A.',
        tradeName: 'Pfizer',
        contactName: 'Ana Martínez',
        phone: '+582129000004',
        email: 'sales@pfizer.ve',
        address: 'Centro Empresarial Galipán, Caracas',
        isDrugstore: false,
        paymentTermsDays: 60,
      },
      {
        rif: 'J-30000005-0',
        businessName: 'Insumos Hospitalarios Unidos',
        tradeName: 'IHU',
        contactName: 'Carlos Sánchez',
        phone: '+582129000005',
        email: 'info@ihu.com.ve',
        address: 'Av. Intercomunal, Valencia',
        isDrugstore: true,
        paymentTermsDays: 30,
      },
    ];
    const out: SupplierEntity[] = [];
    for (const s of data) {
      let existing = await this.supplierRepo.findOne({ where: { rif: s.rif } });
      if (!existing) {
        existing = await this.supplierRepo.save(this.supplierRepo.create({ ...s, isActive: true }));
        this.logger.log(`Supplier "${s.tradeName}" created`);
      }
      out.push(existing);
    }
    return out;
  }

  // ── Brands ──────────────────────────────────────────────────────────
  private async seedBrands(): Promise<BrandEntity[]> {
    const data = [
      { name: 'Bayer', isLaboratory: true },
      { name: 'Pfizer', isLaboratory: true },
      { name: 'Roche', isLaboratory: true },
      { name: 'Novartis', isLaboratory: true },
      { name: 'Sanofi', isLaboratory: true },
      { name: 'Genven', isLaboratory: true },
      { name: 'Elmor', isLaboratory: true },
      { name: 'Colgate', isLaboratory: false },
    ];
    const out: BrandEntity[] = [];
    for (const b of data) {
      let existing = await this.brandRepo.findOne({ where: { name: b.name } });
      if (!existing) {
        existing = await this.brandRepo.save(this.brandRepo.create({ ...b, isActive: true }));
      }
      out.push(existing);
    }
    return out;
  }

  // ── Categories (con árbol) ─────────────────────────────────────────
  private async seedCategories(): Promise<CategoryEntity[]> {
    const roots = [
      { name: 'Medicamentos', code: 'MED', isPharmaceutical: true },
      { name: 'Cuidado personal', code: 'CP', isPharmaceutical: false },
      { name: 'Nutrición', code: 'NUT', isPharmaceutical: false },
    ];
    const rootEntities: Record<string, CategoryEntity> = {};
    for (const r of roots) {
      let existing = await this.categoryRepo.findOne({ where: { name: r.name, parentId: null as unknown as string } });
      if (!existing) {
        existing = await this.categoryRepo.save(this.categoryRepo.create({ ...r, parentId: null, isActive: true }));
      }
      rootEntities[r.code] = existing;
    }

    const children = [
      { name: 'Analgésicos', code: 'MED-ANLG', parent: 'MED', isPharmaceutical: true },
      { name: 'Antibióticos', code: 'MED-ATB', parent: 'MED', isPharmaceutical: true },
      { name: 'Antihistamínicos', code: 'MED-AH', parent: 'MED', isPharmaceutical: true },
      { name: 'Antiinflamatorios', code: 'MED-AI', parent: 'MED', isPharmaceutical: true },
      { name: 'Vitaminas', code: 'MED-VIT', parent: 'MED', isPharmaceutical: true },
      { name: 'Higiene bucal', code: 'CP-HB', parent: 'CP', isPharmaceutical: false },
      { name: 'Cuidado capilar', code: 'CP-CC', parent: 'CP', isPharmaceutical: false },
      { name: 'Suplementos', code: 'NUT-SUP', parent: 'NUT', isPharmaceutical: false },
    ];
    const out: CategoryEntity[] = Object.values(rootEntities);
    for (const c of children) {
      const parent = rootEntities[c.parent];
      let existing = await this.categoryRepo.findOne({
        where: { name: c.name, parentId: parent.id },
      });
      if (!existing) {
        existing = await this.categoryRepo.save(
          this.categoryRepo.create({
            name: c.name,
            code: c.code,
            parentId: parent.id,
            isPharmaceutical: c.isPharmaceutical,
            isActive: true,
          }),
        );
      }
      out.push(existing);
    }
    return out;
  }

  // ── Active Ingredients ──────────────────────────────────────────────
  private async seedActiveIngredients(): Promise<ActiveIngredientEntity[]> {
    const data = [
      {
        name: 'Paracetamol',
        innName: 'Paracetamol',
        atcCode: 'N02BE01',
        therapeuticGroup: 'Analgésico / antipirético',
      },
      { name: 'Ibuprofeno', innName: 'Ibuprofen', atcCode: 'M01AE01', therapeuticGroup: 'AINE' },
      {
        name: 'Amoxicilina',
        innName: 'Amoxicillin',
        atcCode: 'J01CA04',
        therapeuticGroup: 'Antibiótico betalactámico',
      },
      { name: 'Loratadina', innName: 'Loratadine', atcCode: 'R06AX13', therapeuticGroup: 'Antihistamínico H1' },
      { name: 'Omeprazol', innName: 'Omeprazole', atcCode: 'A02BC01', therapeuticGroup: 'Inhibidor bomba de protones' },
      { name: 'Acetaminofén', innName: 'Acetaminophen', atcCode: 'N02BE01', therapeuticGroup: 'Analgésico' },
      { name: 'Vitamina C', innName: 'Ascorbic acid', atcCode: 'A11GA01', therapeuticGroup: 'Vitamina' },
      { name: 'Diclofenaco', innName: 'Diclofenac', atcCode: 'M01AB05', therapeuticGroup: 'AINE' },
    ];
    const out: ActiveIngredientEntity[] = [];
    for (const i of data) {
      let existing = await this.ingredientRepo.findOne({ where: { name: i.name } });
      if (!existing) {
        existing = await this.ingredientRepo.save(this.ingredientRepo.create(i));
      }
      out.push(existing);
    }
    return out;
  }

  // ── Products (con barcodes e ingredients) ──────────────────────────
  private async seedProducts(
    categories: CategoryEntity[],
    brands: BrandEntity[],
    ingredients: ActiveIngredientEntity[],
  ): Promise<ProductEntity[]> {
    const byName = (n: string) => categories.find((c) => c.name === n)!;
    const brandByName = (n: string) => brands.find((b) => b.name === n)!;
    const ingByName = (n: string) => ingredients.find((i) => i.name === n)!;

    type Seed = {
      internalCode: string;
      description: string;
      shortName: string;
      category: string;
      brand?: string;
      productType: string;
      isControlled?: boolean;
      requiresRecipe?: boolean;
      isAntibiotic?: boolean;
      presentation?: string;
      taxType: string;
      pmvp?: number;
      stockMin: number;
      stockMax: number;
      reorderPoint: number;
      barcode: string;
      ingredient?: string;
      concentration?: string;
    };
    const data: Seed[] = [
      {
        internalCode: 'MED001',
        description: 'Tylenol 500mg x 20 tabletas',
        shortName: 'Tylenol 500 x20',
        category: 'Analgésicos',
        brand: 'Bayer',
        productType: 'pharmaceutical',
        presentation: '20 tabletas',
        taxType: 'exempt',
        pmvp: 4.5,
        stockMin: 20,
        stockMax: 200,
        reorderPoint: 40,
        barcode: '7591234500001',
        ingredient: 'Paracetamol',
        concentration: '500mg',
      },
      {
        internalCode: 'MED002',
        description: 'Advil 400mg x 10 tabletas',
        shortName: 'Advil 400 x10',
        category: 'Antiinflamatorios',
        brand: 'Pfizer',
        productType: 'pharmaceutical',
        presentation: '10 tabletas',
        taxType: 'exempt',
        pmvp: 3.2,
        stockMin: 15,
        stockMax: 150,
        reorderPoint: 30,
        barcode: '7591234500002',
        ingredient: 'Ibuprofeno',
        concentration: '400mg',
      },
      {
        internalCode: 'MED003',
        description: 'Amoxil 500mg x 12 cápsulas',
        shortName: 'Amoxil 500',
        category: 'Antibióticos',
        brand: 'Bayer',
        productType: 'pharmaceutical',
        requiresRecipe: true,
        isAntibiotic: true,
        presentation: '12 cápsulas',
        taxType: 'exempt',
        pmvp: 8.0,
        stockMin: 10,
        stockMax: 80,
        reorderPoint: 20,
        barcode: '7591234500003',
        ingredient: 'Amoxicilina',
        concentration: '500mg',
      },
      {
        internalCode: 'MED004',
        description: 'Clarityne 10mg x 10 tabletas',
        shortName: 'Clarityne 10mg',
        category: 'Antihistamínicos',
        brand: 'Roche',
        productType: 'pharmaceutical',
        presentation: '10 tabletas',
        taxType: 'exempt',
        pmvp: 5.5,
        stockMin: 10,
        stockMax: 100,
        reorderPoint: 20,
        barcode: '7591234500004',
        ingredient: 'Loratadina',
        concentration: '10mg',
      },
      {
        internalCode: 'MED005',
        description: 'Losec 20mg x 14 cápsulas',
        shortName: 'Losec 20mg',
        category: 'Medicamentos',
        brand: 'Novartis',
        productType: 'pharmaceutical',
        requiresRecipe: true,
        presentation: '14 cápsulas',
        taxType: 'exempt',
        pmvp: 12.0,
        stockMin: 10,
        stockMax: 60,
        reorderPoint: 15,
        barcode: '7591234500005',
        ingredient: 'Omeprazol',
        concentration: '20mg',
      },
      {
        internalCode: 'MED006',
        description: 'Acetaminofén Genven 500mg x 30 tab',
        shortName: 'Acetaminofén Genven',
        category: 'Analgésicos',
        brand: 'Genven',
        productType: 'pharmaceutical',
        presentation: '30 tabletas',
        taxType: 'exempt',
        pmvp: 2.8,
        stockMin: 30,
        stockMax: 300,
        reorderPoint: 60,
        barcode: '7591234500006',
        ingredient: 'Acetaminofén',
        concentration: '500mg',
      },
      {
        internalCode: 'MED007',
        description: 'Vitamina C 1g x 30 efervescentes',
        shortName: 'Vitamina C 1g',
        category: 'Vitaminas',
        brand: 'Bayer',
        productType: 'otc',
        presentation: '30 efervescentes',
        taxType: 'exempt',
        pmvp: 6.5,
        stockMin: 15,
        stockMax: 100,
        reorderPoint: 25,
        barcode: '7591234500007',
        ingredient: 'Vitamina C',
        concentration: '1g',
      },
      {
        internalCode: 'MED008',
        description: 'Voltaren gel 50g',
        shortName: 'Voltaren gel',
        category: 'Antiinflamatorios',
        brand: 'Novartis',
        productType: 'pharmaceutical',
        presentation: 'Gel 50g',
        taxType: 'exempt',
        pmvp: 7.5,
        stockMin: 8,
        stockMax: 60,
        reorderPoint: 15,
        barcode: '7591234500008',
        ingredient: 'Diclofenaco',
        concentration: '1%',
      },
      {
        internalCode: 'CP001',
        description: 'Colgate Triple Acción 75ml',
        shortName: 'Colgate 75ml',
        category: 'Higiene bucal',
        brand: 'Colgate',
        productType: 'grocery',
        presentation: 'Tubo 75ml',
        taxType: 'general',
        pmvp: 3.0,
        stockMin: 20,
        stockMax: 200,
        reorderPoint: 40,
        barcode: '7591234500009',
      },
      {
        internalCode: 'CP002',
        description: 'Head & Shoulders 400ml',
        shortName: 'H&S 400ml',
        category: 'Cuidado capilar',
        brand: 'Colgate',
        productType: 'grocery',
        presentation: 'Botella 400ml',
        taxType: 'general',
        pmvp: 8.5,
        stockMin: 10,
        stockMax: 80,
        reorderPoint: 20,
        barcode: '7591234500010',
      },
      {
        internalCode: 'NUT001',
        description: 'Ensure Original 400g',
        shortName: 'Ensure 400g',
        category: 'Suplementos',
        brand: 'Pfizer',
        productType: 'otc',
        presentation: 'Lata 400g',
        taxType: 'reduced',
        pmvp: 15.0,
        stockMin: 8,
        stockMax: 60,
        reorderPoint: 15,
        barcode: '7591234500011',
      },
      {
        internalCode: 'MED009',
        description: 'Paracetamol Elmor 120mg/5ml jarabe',
        shortName: 'Paracetamol jarabe',
        category: 'Analgésicos',
        brand: 'Elmor',
        productType: 'pharmaceutical',
        presentation: 'Jarabe 120ml',
        taxType: 'exempt',
        pmvp: 3.8,
        stockMin: 12,
        stockMax: 100,
        reorderPoint: 25,
        barcode: '7591234500012',
        ingredient: 'Paracetamol',
        concentration: '120mg/5ml',
      },
    ];

    const out: ProductEntity[] = [];
    for (const p of data) {
      let existing = await this.productRepo.findOne({ where: { internalCode: p.internalCode } });
      if (!existing) {
        const cat = byName(p.category);
        const brandEntity = p.brand ? brandByName(p.brand) : null;
        existing = await this.productRepo.save(
          this.productRepo.create({
            internalCode: p.internalCode,
            description: p.description,
            shortName: p.shortName,
            categoryId: cat.id,
            brandId: brandEntity?.id ?? null,
            productType: p.productType,
            isControlled: p.isControlled ?? false,
            requiresRecipe: p.requiresRecipe ?? false,
            isAntibiotic: p.isAntibiotic ?? false,
            isWeighable: false,
            unitOfMeasure: 'UND',
            decimalPlaces: 0,
            presentation: p.presentation ?? null,
            taxType: p.taxType,
            pmvp: p.pmvp ?? null,
            conservationType: 'ambient',
            stockMin: p.stockMin,
            stockMax: p.stockMax,
            reorderPoint: p.reorderPoint,
            leadTimeDays: 7,
            isActive: true,
            inventoryBlocked: false,
          }),
        );

        await this.barcodeRepo.save(
          this.barcodeRepo.create({
            productId: existing.id,
            barcode: p.barcode,
            barcodeType: 'ean13',
            isPrimary: true,
          }),
        );

        if (p.ingredient) {
          const ing = ingByName(p.ingredient);
          await this.productIngRepo.save(
            this.productIngRepo.create({
              productId: existing.id,
              activeIngredientId: ing.id,
              concentration: p.concentration ?? null,
              isPrimary: true,
            }),
          );
        }

        this.logger.log(`Product "${p.shortName}" created`);
      }
      out.push(existing);
    }
    return out;
  }

  // ── Terminals ───────────────────────────────────────────────────────
  private async seedTerminals(branches: BranchEntity[]): Promise<void> {
    for (const branch of branches) {
      for (let i = 1; i <= 2; i += 1) {
        const code = `${branch.name
          .replace(/[^A-Z]/gi, '')
          .slice(0, 3)
          .toUpperCase()}-POS-${i}`;
        const existing = await this.terminalRepo.findOne({ where: { code } });
        if (!existing) {
          await this.terminalRepo.save(
            this.terminalRepo.create({
              branchId: branch.id,
              code,
              name: `Caja ${i} - ${branch.name}`,
              fiscalPrinterConfig: { model: 'Bematech MP-4200', port: 'COM1' },
              scaleConfig: null,
              cashDrawerConfig: { model: 'APG Vasario', port: 'COM2' },
              isActive: true,
            }),
          );
        }
      }
    }
  }

  // ── Warehouse Locations ─────────────────────────────────────────────
  private async seedLocations(branches: BranchEntity[]): Promise<void> {
    for (const branch of branches) {
      const prefix = branch.name
        .replace(/[^A-Z]/gi, '')
        .slice(0, 3)
        .toUpperCase();
      const specs: Array<{
        code: string;
        aisle: string;
        shelf: string;
        section: string | null;
        isQuarantine: boolean;
      }> = [
        { code: `${prefix}-A-01-A`, aisle: 'A', shelf: '01', section: 'A', isQuarantine: false },
        { code: `${prefix}-A-01-B`, aisle: 'A', shelf: '01', section: 'B', isQuarantine: false },
        { code: `${prefix}-A-02-A`, aisle: 'A', shelf: '02', section: 'A', isQuarantine: false },
        { code: `${prefix}-B-01-A`, aisle: 'B', shelf: '01', section: 'A', isQuarantine: false },
        { code: `${prefix}-QRT`, aisle: 'Q', shelf: '00', section: null, isQuarantine: true },
      ];
      for (const spec of specs) {
        const existing = await this.locationRepo.findOne({ where: { locationCode: spec.code } });
        if (!existing) {
          await this.locationRepo.save(
            this.locationRepo.create({
              branchId: branch.id,
              locationCode: spec.code,
              aisle: spec.aisle,
              shelf: spec.shelf,
              section: spec.section,
              capacity: 500,
              isQuarantine: spec.isQuarantine,
              isActive: true,
            }),
          );
        }
      }
    }
  }

  // ── Exchange Rates (últimos 60 días) ────────────────────────────────
  private async seedExchangeRates(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let base = 36.5;
    for (let i = 60; i >= 0; i -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const existing = await this.rateRepo.findOne({
        where: { effectiveDate: date, currencyFrom: 'USD', currencyTo: 'VES' },
      });
      if (!existing) {
        base += (Math.random() - 0.3) * 0.15;
        await this.rateRepo.save(
          this.rateRepo.create({
            currencyFrom: 'USD',
            currencyTo: 'VES',
            rate: round2(base),
            source: 'BCV',
            effectiveDate: date,
            isOverridden: false,
          }),
        );
      }
    }
  }

  // ── Inventory Lots + Kardex ─────────────────────────────────────────
  private async seedLots(
    products: ProductEntity[],
    branches: BranchEntity[],
    suppliers: SupplierEntity[],
  ): Promise<void> {
    // ~4 lotes por producto, repartidos entre sucursales
    for (const product of products) {
      for (let i = 0; i < 4; i += 1) {
        const branch = branches[i % branches.length];
        const lotNumber = `L${product.internalCode}-${i + 1}`;

        const existing = await this.lotRepo.findOne({
          where: { lotNumber, productId: product.id, branchId: branch.id },
        });
        if (existing) continue;

        const supplier = pickOne(suppliers);
        const quantity = rand(20, 150);
        const costUsd = product.pmvp ? round2(Number(product.pmvp) * 0.65) : round2(rand(100, 1000) / 100);
        const salePrice = product.pmvp ? Number(product.pmvp) : round2(costUsd * 1.5);
        // Vencimientos variados: algunos próximos, otros lejanos
        const expDays = [30, 60, 180, 540][i] ?? 365;
        const expirationDate = daysFromNow(expDays);
        const manufactureDate = daysFromNow(-rand(30, 180));
        const marginPct = salePrice > 0 && costUsd > 0 ? round2(((salePrice - costUsd) / costUsd) * 100) : null;

        await this.dataSource.transaction(async (trx) => {
          const lot = await trx.getRepository(InventoryLotEntity).save(
            trx.getRepository(InventoryLotEntity).create({
              productId: product.id,
              branchId: branch.id,
              lotNumber,
              expirationDate,
              manufactureDate,
              acquisitionType: 'purchase',
              supplierId: supplier.id,
              costUsd,
              salePrice,
              marginPct,
              quantityReceived: quantity,
              quantityAvailable: quantity,
              status: 'available',
            }),
          );

          await trx.getRepository(KardexEntity).save(
            trx.getRepository(KardexEntity).create({
              productId: product.id,
              branchId: branch.id,
              lotId: lot.id,
              movementType: 'purchase_entry',
              quantity,
              unitCostUsd: costUsd,
              balanceAfter: quantity,
              referenceType: 'inventory_lot',
              referenceId: lot.id,
              userId: SYSTEM_USER,
            }),
          );
        });
      }
    }
    this.logger.log(`Lots seeded for ${products.length} products`);
  }
}
