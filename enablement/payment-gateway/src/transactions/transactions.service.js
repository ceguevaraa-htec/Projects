const createTransactionsRepository = require("./transactions.repository");
const { ValidationError, NotFoundError } = require("../errors/errorCatalog");

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const VALID_STATUSES = ["APPROVED", "DECLINED"];

/**
 * @param {{ repository?: ReturnType<typeof createTransactionsRepository> }} [deps]
 */
function createTransactionsService(deps = {}) {
  const repository = deps.repository || createTransactionsRepository();

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

    if (params.status != null && !VALID_STATUSES.includes(params.status)) {
      throw new ValidationError(
        `status must be one of: ${VALID_STATUSES.join(", ")}`,
        "INVALID_STATUS"
      );
    }

    return {
      page,
      pageSize,
      status: params.status || undefined,
      cartId: params.cartId || undefined,
    };
  }

  async function getTransaction(id) {
    const transaction = await repository.findById(id);
    if (!transaction) {
      throw new NotFoundError(
        `Transaction ${id} not found`,
        "TRANSACTION_NOT_FOUND"
      );
    }
    return transaction;
  }

  async function listTransactions(params) {
    const normalized = normalizeParams(params);
    const { items, total } = await repository.findMany(normalized);
    return {
      items,
      page: normalized.page,
      pageSize: normalized.pageSize,
      total,
    };
  }

  return { getTransaction, listTransactions };
}

module.exports = createTransactionsService;
