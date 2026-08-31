/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const PRODUCTS = [
  { name: "Wireless Mouse", category: "Electronics", priceCents: 2499, description: "Ergonomic wireless mouse" },
  { name: "Mechanical Keyboard", category: "Electronics", priceCents: 8999, description: "RGB mechanical keyboard" },
  { name: "USB-C Phone Charger", category: "Electronics", priceCents: 1999, description: "Fast-charging phone charger" },
  { name: "Smartphone Stand", category: "Electronics", priceCents: 1299, description: "Adjustable phone stand" },
  { name: "Bluetooth Headphones", category: "Electronics", priceCents: 5999, description: "Noise-cancelling headphones" },
  { name: "Running Shoes", category: "Apparel", priceCents: 7499, description: "Lightweight running shoes" },
  { name: "Cotton T-Shirt", category: "Apparel", priceCents: 1999, description: "Classic fit cotton t-shirt" },
  { name: "Denim Jacket", category: "Apparel", priceCents: 8999, description: "Casual denim jacket" },
  { name: "Wool Scarf", category: "Apparel", priceCents: 2999, description: "Warm wool scarf" },
  { name: "Coffee Maker", category: "Home", priceCents: 4999, description: "12-cup drip coffee maker" },
  { name: "Nonstick Frying Pan", category: "Home", priceCents: 3499, description: "10-inch nonstick frying pan" },
  { name: "Throw Blanket", category: "Home", priceCents: 2599, description: "Soft fleece throw blanket" },
  { name: "Desk Lamp", category: "Home", priceCents: 2199, description: "LED desk lamp with dimmer" },
  { name: "Novel: The Long Road", category: "Books", priceCents: 1499, description: "Bestselling fiction novel" },
  { name: "Cookbook: Simple Meals", category: "Books", priceCents: 1899, description: "Quick weeknight recipes" },
];

const PROMO_CODES = [
  { code: "WELCOME10", discountType: "PERCENT", discountValue: 10, active: true, expiresAt: null },
  { code: "SAVE5", discountType: "FIXED", discountValue: 500, active: true, expiresAt: null },
  { code: "EXPIRED20", discountType: "PERCENT", discountValue: 20, active: true, expiresAt: new Date("2020-01-01") },
  { code: "INACTIVE15", discountType: "PERCENT", discountValue: 15, active: false, expiresAt: null },
];

async function main() {
  console.log("Seeding database...");

  // Clear existing data (order respects FK constraints)
  await prisma.transaction.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.promoCode.deleteMany();
  await prisma.product.deleteMany();

  const products = [];
  for (const p of PRODUCTS) {
    products.push(await prisma.product.create({ data: p }));
  }

  const promoCodes = [];
  for (const c of PROMO_CODES) {
    promoCodes.push(await prisma.promoCode.create({ data: c }));
  }

  // Sample OPEN cart with items
  const openCart = await prisma.cart.create({
    data: {
      status: "OPEN",
      items: {
        create: [
          { productId: products[0].id, quantity: 2, unitPriceCents: products[0].priceCents },
          { productId: products[1].id, quantity: 1, unitPriceCents: products[1].priceCents },
        ],
      },
    },
  });

  // Sample PAID cart with a matching transaction
  const paidCartSubtotal = products[5].priceCents * 1;
  const paidCart = await prisma.cart.create({
    data: {
      status: "PAID",
      discountCents: 0,
      totalCents: paidCartSubtotal,
      items: {
        create: [
          { productId: products[5].id, quantity: 1, unitPriceCents: products[5].priceCents },
        ],
      },
    },
  });
  await prisma.transaction.create({
    data: {
      cartId: paidCart.id,
      status: "APPROVED",
      totalCents: paidCartSubtotal,
      discountCents: 0,
      gatewayReference: "mock_seed_approved_1",
    },
  });

  // Sample FAILED cart with a matching transaction
  const failedCartSubtotal = products[9].priceCents * 3;
  const failedCart = await prisma.cart.create({
    data: {
      status: "FAILED",
      discountCents: 0,
      totalCents: failedCartSubtotal,
      items: {
        create: [
          { productId: products[9].id, quantity: 3, unitPriceCents: products[9].priceCents },
        ],
      },
    },
  });
  await prisma.transaction.create({
    data: {
      cartId: failedCart.id,
      status: "DECLINED",
      totalCents: failedCartSubtotal,
      discountCents: 0,
      gatewayReference: "mock_seed_declined_1",
    },
  });

  console.log(`Seeded ${products.length} products, ${promoCodes.length} promo codes, 3 carts, 2 transactions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
