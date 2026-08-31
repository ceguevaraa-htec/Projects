const createProductsRepository = require("./products.repository");
const { ValidationError, NotFoundError } = require("../errors/errorCatalog");

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * @param {{ repository?: ReturnType<typeof createProductsRepository> }} [deps]
 */
function createProductsService(deps = {}) {
  const repository = deps.repository || createProductsRepository();

  function normalizeParams(params = {}) {
    const page = params.page != null ? Number(params.page) : DEFAULT_PAGE;
    const pageSize =
      params.pageSize != null ? Number(params.pageSize) : DEFAULT_PAGE_SIZE;

    if (!Number.isInteger(page) || page < 1) {
      throw new ValidationError("page must be a positive integer", "INVALID_PAGE");
    }
    if (
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > MAX_PAGE_SIZE
    ) {
      throw new ValidationError(
        `pageSize must be an integer between 1 and ${MAX_PAGE_SIZE}`,
        "INVALID_PAGE_SIZE"
      );
    }

    let minPrice = params.minPrice != null ? Number(params.minPrice) : null;
    let maxPrice = params.maxPrice != null ? Number(params.maxPrice) : null;
    if (minPrice != null && (Number.isNaN(minPrice) || minPrice < 0)) {
      throw new ValidationError("minPrice must be >= 0", "INVALID_PRICE_RANGE");
    }
    if (maxPrice != null && (Number.isNaN(maxPrice) || maxPrice < 0)) {
      throw new ValidationError("maxPrice must be >= 0", "INVALID_PRICE_RANGE");
    }
    if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
      throw new ValidationError(
        "minPrice must not be greater than maxPrice",
        "INVALID_PRICE_RANGE"
      );
    }

    return {
      page,
      pageSize,
      q: params.q || undefined,
      category: params.category || undefined,
      minPrice,
      maxPrice,
    };
  }

  async function listProducts(params) {
    const normalized = normalizeParams(params);
    const { items, total } = await repository.findMany(normalized);
    return {
      items,
      page: normalized.page,
      pageSize: normalized.pageSize,
      total,
    };
  }

  async function getProduct(id) {
    const product = await repository.findById(id);
    if (!product) {
      throw new NotFoundError(`Product ${id} not found`, "PRODUCT_NOT_FOUND");
    }
    return product;
  }

  return { listProducts, getProduct };
}

module.exports = createProductsService;
