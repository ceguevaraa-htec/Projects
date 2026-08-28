export type CartStatus = "open" | "checked_out";

export interface LineItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface Cart {
  id: string;
  status: CartStatus;
  items: LineItem[];
}
