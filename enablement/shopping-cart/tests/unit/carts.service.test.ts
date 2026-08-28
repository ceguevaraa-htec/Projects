import { describe, expect, it } from "vitest";
import { CartsRepository } from "../../src/repositories/carts.repository.js";
import { CartsService } from "../../src/services/carts.service.js";
import { CartNotFoundError, ItemNotFoundError, ValidationError } from "../../src/http.js";

function makeService() {
  return new CartsService(new CartsRepository());
}

describe("CartsService — create/add/get (User Story 1)", () => {
  it("createCart returns a new open cart with no items and total 0", () => {
    const service = makeService();
    const cart = service.createCart();
    expect(cart.id).toBeTruthy();
    expect(cart.status).toBe("open");
    expect(cart.items).toEqual([]);
    expect(cart.totalPrice).toBe(0);
  });

  it("addItem on an empty cart adds a line item and recalculates the total", () => {
    const service = makeService();
    const cart = service.createCart();
    const updated = service.addItem(cart.id, "sku-1", 2, 9.99);
    expect(updated.items).toEqual([{ productId: "sku-1", quantity: 2, price: 9.99 }]);
    expect(updated.totalPrice).toBeCloseTo(19.98);
  });

  it("addItem for an existing productId sums quantity and overwrites price", () => {
    const service = makeService();
    const cart = service.createCart();
    service.addItem(cart.id, "sku-1", 2, 9.99);
    const updated = service.addItem(cart.id, "sku-1", 1, 8.99);
    expect(updated.items).toEqual([{ productId: "sku-1", quantity: 3, price: 8.99 }]);
    expect(updated.totalPrice).toBeCloseTo(26.97);
  });

  it("addItem rejects a quantity that is not strictly greater than zero", () => {
    const service = makeService();
    const cart = service.createCart();
    expect(() => service.addItem(cart.id, "sku-1", 0, 9.99)).toThrow(ValidationError);
    expect(() => service.addItem(cart.id, "sku-1", -1, 9.99)).toThrow(ValidationError);
  });

  it("addItem rejects a negative price", () => {
    const service = makeService();
    const cart = service.createCart();
    expect(() => service.addItem(cart.id, "sku-1", 1, -0.01)).toThrow(ValidationError);
  });

  it("getCart returns items, status, and total for an existing cart", () => {
    const service = makeService();
    const cart = service.createCart();
    service.addItem(cart.id, "sku-1", 1, 5);
    const fetched = service.getCart(cart.id);
    expect(fetched.status).toBe("open");
    expect(fetched.items).toEqual([{ productId: "sku-1", quantity: 1, price: 5 }]);
    expect(fetched.totalPrice).toBe(5);
  });

  it("getCart throws CartNotFoundError for an unknown id", () => {
    const service = makeService();
    expect(() => service.getCart("does-not-exist")).toThrow(CartNotFoundError);
  });

  it("addItem throws CartNotFoundError for an unknown cart id", () => {
    const service = makeService();
    expect(() => service.addItem("does-not-exist", "sku-1", 1, 1)).toThrow(CartNotFoundError);
  });
});

describe("CartsService — update/remove (User Story 2)", () => {
  it("updateItemQuantity with a positive value changes quantity and recalculates total", () => {
    const service = makeService();
    const cart = service.createCart();
    service.addItem(cart.id, "sku-1", 2, 10);
    const updated = service.updateItemQuantity(cart.id, "sku-1", 5);
    expect(updated.items).toEqual([{ productId: "sku-1", quantity: 5, price: 10 }]);
    expect(updated.totalPrice).toBe(50);
  });

  it("updateItemQuantity with 0 removes the line item", () => {
    const service = makeService();
    const cart = service.createCart();
    service.addItem(cart.id, "sku-1", 2, 10);
    const updated = service.updateItemQuantity(cart.id, "sku-1", 0);
    expect(updated.items).toEqual([]);
    expect(updated.totalPrice).toBe(0);
  });

  it("updateItemQuantity with a negative value throws ValidationError", () => {
    const service = makeService();
    const cart = service.createCart();
    service.addItem(cart.id, "sku-1", 2, 10);
    expect(() => service.updateItemQuantity(cart.id, "sku-1", -1)).toThrow(ValidationError);
  });

  it("updateItemQuantity/removeItem throw ItemNotFoundError for an unknown productId", () => {
    const service = makeService();
    const cart = service.createCart();
    expect(() => service.updateItemQuantity(cart.id, "unknown-sku", 1)).toThrow(
      ItemNotFoundError,
    );
    expect(() => service.removeItem(cart.id, "unknown-sku")).toThrow(ItemNotFoundError);
  });

  it("removeItem removes the line item and recalculates the total, leaving others unaffected", () => {
    const service = makeService();
    const cart = service.createCart();
    service.addItem(cart.id, "sku-1", 1, 10);
    service.addItem(cart.id, "sku-2", 2, 5);
    const updated = service.removeItem(cart.id, "sku-1");
    expect(updated.items).toEqual([{ productId: "sku-2", quantity: 2, price: 5 }]);
    expect(updated.totalPrice).toBe(10);
  });
});

describe("CartsService — checkout/clear (User Story 3)", () => {
  it("checkout on a cart with items clears items and sets status checked_out", () => {
    const service = makeService();
    const cart = service.createCart();
    service.addItem(cart.id, "sku-1", 1, 10);
    const checkedOut = service.checkout(cart.id);
    expect(checkedOut.status).toBe("checked_out");
    expect(checkedOut.items).toEqual([]);
    expect(checkedOut.totalPrice).toBe(0);
  });

  it("checkout on a cart with no items throws EmptyCartCheckoutError", async () => {
    const { EmptyCartCheckoutError } = await import("../../src/http.js");
    const service = makeService();
    const cart = service.createCart();
    expect(() => service.checkout(cart.id)).toThrow(EmptyCartCheckoutError);
  });

  it("any mutating operation on an already-checked-out cart throws CartFinalizedError", async () => {
    const { CartFinalizedError } = await import("../../src/http.js");
    const service = makeService();
    const cart = service.createCart();
    service.addItem(cart.id, "sku-1", 1, 10);
    service.checkout(cart.id);

    expect(() => service.addItem(cart.id, "sku-2", 1, 1)).toThrow(CartFinalizedError);
    expect(() => service.updateItemQuantity(cart.id, "sku-1", 1)).toThrow(CartFinalizedError);
    expect(() => service.removeItem(cart.id, "sku-1")).toThrow(CartFinalizedError);
    expect(() => service.checkout(cart.id)).toThrow(CartFinalizedError);
    expect(() => service.clearCart(cart.id)).toThrow(CartFinalizedError);
  });

  it("clearCart on an open cart with items empties items and stays open", () => {
    const service = makeService();
    const cart = service.createCart();
    service.addItem(cart.id, "sku-1", 1, 10);
    const cleared = service.clearCart(cart.id);
    expect(cleared.status).toBe("open");
    expect(cleared.items).toEqual([]);
    expect(cleared.totalPrice).toBe(0);
  });
});
