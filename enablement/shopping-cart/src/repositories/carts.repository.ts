import { randomUUID } from "node:crypto";
import type { Cart } from "../models/cart.js";

/**
 * In-memory, `Map`-backed data access for carts. A cart and its line items are one
 * aggregate (research.md) — no persistence across restarts, no business logic, no logging
 * (constitution Principle I).
 */
export class CartsRepository {
  private readonly carts = new Map<string, Cart>();

  create(): Cart {
    const cart: Cart = { id: randomUUID(), status: "open", items: [] };
    this.carts.set(cart.id, cart);
    return cart;
  }

  findById(id: string): Cart | undefined {
    return this.carts.get(id);
  }

  save(cart: Cart): void {
    this.carts.set(cart.id, cart);
  }
}
