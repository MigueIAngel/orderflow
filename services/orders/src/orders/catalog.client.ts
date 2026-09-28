import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CatalogProduct {
  sku: string;
  name_en: string;
  price: number;
}

export class CatalogUnavailableError extends Error {}

/** Synchronous dependency on the inventory service: current prices for the order lines. */
export abstract class CatalogClient {
  abstract findBySkus(skus: string[]): Promise<CatalogProduct[]>;
}

@Injectable()
export class HttpCatalogClient extends CatalogClient {
  private readonly logger = new Logger(HttpCatalogClient.name);
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    super();
    this.baseUrl = config.get('INVENTORY_URL', 'http://localhost:8001');
  }

  async findBySkus(skus: string[]): Promise<CatalogProduct[]> {
    const url = `${this.baseUrl}/products?skus=${encodeURIComponent(skus.join(','))}`;
    const attempts = 3;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(3000),
        });
        if (response.ok) return (await response.json()) as CatalogProduct[];
        if (response.status < 500) break;
      } catch (error) {
        this.logger.warn(
          `inventory call failed (attempt ${attempt}/${attempts}): ${String(error)}`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** attempt));
    }
    throw new CatalogUnavailableError('Inventory service is unavailable');
  }
}
