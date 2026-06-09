export interface ProductApp {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'disabled';
}

export interface ProductRepository {
  findById(id: string): Promise<ProductApp | null>;
  findBySlug(slug: string): Promise<ProductApp | null>;
}
