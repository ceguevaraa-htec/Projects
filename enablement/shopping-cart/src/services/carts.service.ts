import type { Cart } from "../models/cart.js";
import type { CartsRepository } from "../repositories/carts.repository.js";
import { log } from "../logger.js";
import {
  CartFinalizedError,
  CartNotFoundError,
  EmptyCartCheckoutError,
  ItemNotFoundError,
  ValidationError,
} from "../http.js";

export interface CartView {
  id: string;
  status: Cart["status"];
  items: Cart["items"];
  totalPrice: number;
}

function toView(cart: Cart): CartView {
  return {
    id: cart.id,
    status: cart.status,
    items: cart.items,
    totalPrice: cart.items.reduce((sum, item) => sum + item.quantity * item.price, 0),
  };
}

/**
 * Business logic for the shopping cart lifecycle (constitution Principle I: service layer).
 * Validates input, enforces the cart lifecycle, computes the total, delegates storage to the
 * repository, and logs every successful mutation (constitution Principle III).
 */
export class CartsService {
  constructor(private readonly repository: CartsRepository) {}

  private getExisting(cartId: string): Cart {
    const cart = this.repository.findById(cartId);
    if (!cart) {
      throw new CartNotFoundError(cartId);
    }
    return cart;
  }

  /**
   * Rejects any mutation attempted against a cart that has already been checked out
   * (FR-012). Called by every mutating operation from its first implementation, so no
   * story needs to retrofit this check into another story's already-complete functions.
   */
  private assertCartOpen(cart: Cart): void {
    if (cart.status === "checked_out") {
      throw new CartFinalizedError(cart.id);
    }
  }

  createCart(): CartView {
    const cart = this.repository.create();
    log({ action: "create_cart", cartId: cart.id });
    return toView(cart);
  }

  getCart(cartId: string): CartView {
    return toView(this.getExisting(cartId));
  }

  addItem(cartId: string, productId: string, quantity: number, price: number): CartView {
    const cart = this.getExisting(cartId);
    this.assertCartOpen(cart);
    if (!(quantity > 0)) {
      throw new ValidationError("quantity must be greater than 0.");
    }
    if (!(price >= 0)) {
      throw new ValidationError("price must not be negative.");
    }

    const existing = cart.items.find((item) => item.productId === productId);
    if (existing) {
      existing.quantity += quantity;
      existing.price = price;
    } else {
      cart.items.push({ productId, quantity, price });
    }
    this.repository.save(cart);
    log({ action: "add_item", cartId, productId });
    return toView(cart);
  }

  updateItemQuantity(cartId: string, productId: string, quantity: number): CartView {
    const cart = this.getExisting(cartId);
    this.assertCartOpen(cart);
    const index = cart.items.findIndex((item) => item.productId === productId);
    if (index === -1) {
      throw new ItemNotFoundError(cartId, productId);
    }
    if (quantity < 0) {
      throw new ValidationError("quantity must not be negative.");
    }

    if (quantity === 0) {
      cart.items.splice(index, 1);
    } else {
      cart.items[index].quantity = quantity;
    }
    this.repository.save(cart);
    log({ action: "update_item", cartId, productId });
    return toView(cart);
  }

  removeItem(cartId: string, productId: string): CartView {
    const cart = this.getExisting(cartId);
    this.assertCartOpen(cart);
    const index = cart.items.findIndex((item) => item.productId === productId);
    if (index === -1) {
      throw new ItemNotFoundError(cartId, productId);
    }

    cart.items.splice(index, 1);
    this.repository.save(cart);
    log({ action: "remove_item", cartId, productId });
    return toView(cart);
  }

  checkout(cartId: string): CartView {
    const cart = this.getExisting(cartId);
    this.assertCartOpen(cart);
    if (cart.items.length === 0) {
      throw new EmptyCartCheckoutError(cartId);
    }

    cart.items = [];
    cart.status = "checked_out";
    this.repository.save(cart);
    log({ action: "checkout", cartId });
    return toView(cart);
  }

  clearCart(cartId: string): CartView {
    const cart = this.getExisting(cartId);
    this.assertCartOpen(cart);

    cart.items = [];
    this.repository.save(cart);
    log({ action: "clear", cartId });
    return toView(cart);
  }
}
