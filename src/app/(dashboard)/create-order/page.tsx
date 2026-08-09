"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type CustomerType = "VAT" | "NON_VAT";
type PaymentType = "PAID_NOW" | "CREDIT";

type Customer = {
  id: string;
  customerCode: string;
  name: string;
  contactPerson: string;
  phone: string;
  address: string;
  addresses: {
    id: string;
    label: string | null;
    address: string;
    isDefault: boolean;
  }[];
  type: CustomerType;
  vatNumber?: string;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  kgPerBag: number;
  availableBags: number;
  defaultPricePerKg: number;
};

type OrderItem = {
  productId: string;
  productName: string;
  sku: string;
  kgPerBag: number;
  availableBags: number;
  quantityBags: number;
  quantityKg: number;
  pricePerKg: number;
  lineTotal: number;
};

function formatMoney(value: number) {
  return `Rs ${value.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function CreateOrderPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedCustomerAddressId, setSelectedCustomerAddressId] = useState("");

  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantityBags, setQuantityBags] = useState(1);
  const [pricePerKg, setPricePerKg] = useState(0);

  const [items, setItems] = useState<OrderItem[]>([]);

  const [discountAmount, setDiscountAmount] = useState(0);
  const [deliveryAmount, setDeliveryAmount] = useState(0);

  const [paymentType, setPaymentType] = useState<PaymentType>("PAID_NOW");
  const [paymentDueDate, setPaymentDueDate] = useState("");

  const [notes, setNotes] = useState("");

  useEffect(() => {
    async function loadCustomers() {
      try {
        const response = await fetch("/api/customers");
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || "Failed to load customers");
        }

        const mappedCustomers: Customer[] = result.data.map(
          (customer: {
            id: string;
            customerCode: string | null;
            customerName: string;
            contactPerson: string | null;
            phone: string | null;
            address: string | null;
            addresses?: {
              id: string;
              label: string | null;
              address: string;
              isDefault: boolean;
            }[];
            customerType: CustomerType;
            vatNumber: string | null;
          }) => ({
            id: customer.id,
            customerCode: customer.customerCode ?? "",
            name: customer.customerName,
            contactPerson: customer.contactPerson ?? "",
            phone: customer.phone ?? "",
            address: customer.address ?? "",
            addresses:
              customer.addresses && customer.addresses.length > 0
                ? customer.addresses
                : customer.address
                ? [
                    {
                      id: "legacy",
                      label: "Primary",
                      address: customer.address,
                      isDefault: true,
                    },
                  ]
                : [],
            type: customer.customerType,
            vatNumber: customer.vatNumber ?? undefined,
          })
        );

        setCustomers(mappedCustomers);
      } catch (error) {
        console.error("Failed to load customers:", error);
      } finally {
        setIsLoadingCustomers(false);
      }
    }

    async function loadProducts() {
      try {
        const response = await fetch("/api/products?limit=100");
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || "Failed to load products");
        }

        const mappedProducts: Product[] = result.data.map(
          (product: {
            id: string;
            productName: string;
            sku: string | null;
            kgPerBag: number;
            stockBags: number;
            availableBags?: number;
            defaultSellingPricePerKg: number;
          }) => ({
            id: product.id,
            name: product.productName,
            sku: product.sku ?? "",
            kgPerBag: product.kgPerBag,
            availableBags: product.availableBags ?? product.stockBags,
            defaultPricePerKg: product.defaultSellingPricePerKg,
          })
        );

        setProducts(mappedProducts);
      } catch (error) {
        console.error("Failed to load products:", error);
      } finally {
        setIsLoadingProducts(false);
      }
    }

    loadCustomers();
    loadProducts();
  }, []);

  const filteredCustomers = customers.filter((customer) => {
    const search = customerSearch.toLowerCase();

    return (
      customer.name.toLowerCase().includes(search) ||
      customer.contactPerson.toLowerCase().includes(search) ||
      customer.customerCode.toLowerCase().includes(search) ||
      customer.phone.toLowerCase().includes(search) ||
      (customer.vatNumber ?? "").toLowerCase().includes(search)
    );
  });

  const selectedProduct = products.find(
    (product) => product.id === selectedProductId
  );

  const previewQuantityKg = selectedProduct
    ? quantityBags * selectedProduct.kgPerBag
    : 0;

  const previewLineTotal = previewQuantityKg * pricePerKg;

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.lineTotal, 0);
  }, [items]);

  const orderType = selectedCustomer?.type ?? null;
  const selectedCustomerAddress = selectedCustomer
    ? selectedCustomer.addresses.find(
        (address) => address.id === selectedCustomerAddressId
      )?.address ??
      selectedCustomer.addresses[0]?.address ??
      selectedCustomer.address
    : "";

  const vatRate = orderType === "VAT" ? 18 : 0;

  const vatAmount = useMemo(() => {
    if (orderType !== "VAT") return 0;

    const taxableAmount = subtotal - discountAmount + deliveryAmount;
    return taxableAmount * (vatRate / 100);
  }, [subtotal, discountAmount, deliveryAmount, orderType, vatRate]);

  const totalAmount = subtotal - discountAmount + deliveryAmount + vatAmount;

  function handleSelectProduct(productId: string) {
    setSelectedProductId(productId);

    const product = products.find((item) => item.id === productId);

    if (product) {
      setQuantityBags(1);
      setPricePerKg(product.defaultPricePerKg);
    }
  }

  function handleAddItem() {
    if (!selectedProduct) return;

    if (quantityBags <= 0) {
      alert("Quantity bags must be greater than 0.");
      return;
    }

    if (quantityBags > selectedProduct.availableBags) {
      alert("Selected bags exceed available stock.");
      return;
    }

    if (pricePerKg <= 0) {
      alert("Price per kg must be greater than 0.");
      return;
    }

    const calculatedKg = quantityBags * selectedProduct.kgPerBag;
    const calculatedLineTotal = calculatedKg * pricePerKg;

    const newItem: OrderItem = {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      sku: selectedProduct.sku,
      kgPerBag: selectedProduct.kgPerBag,
      availableBags: selectedProduct.availableBags,
      quantityBags,
      quantityKg: calculatedKg,
      pricePerKg,
      lineTotal: calculatedLineTotal,
    };

    setItems((prev) => [...prev, newItem]);

    setSelectedProductId("");
    setQuantityBags(1);
    setPricePerKg(0);
  }

  function handleRemoveItem(index: number) {
    setItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleCreateOrder() {
    if (!selectedCustomer) {
      alert("Please select a customer.");
      return;
    }

    if (items.length === 0) {
      alert("Please add at least one product.");
      return;
    }

    if (paymentType === "CREDIT" && !paymentDueDate) {
      alert("Please select a payment due date.");
      return;
    }

    const payload = {
      customerId: selectedCustomer.id,
      customerAddressId:
        selectedCustomerAddressId && selectedCustomerAddressId !== "legacy"
          ? selectedCustomerAddressId
          : null,
      items: items.map((item) => ({
        productId: item.productId,
        quantityBags: item.quantityBags,
        pricePerKg: item.pricePerKg,
      })),
      discountAmount,
      deliveryAmount,
      paymentType,
      paymentDueDate: paymentType === "CREDIT" ? paymentDueDate : null,
      notes,
    };

    try {
      setIsSubmitting(true);

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to create order.");
      }

      alert(`Order created successfully: ${result.data.orderId}`);
      router.push("/orders");
    } catch (error) {
      console.error("Create order failed:", error);
      alert(error instanceof Error ? error.message : "Failed to create order.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="p-6 text-black font-sans">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFBF01] text-black font-bold shadow-sm">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-black">
            Create Order
          </h1>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          {/* Products Section */}
          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-black">Products</h2>
            </div>

            <div className="grid gap-4 rounded-xl border border-stone-200 bg-stone-50/50 p-5 md:grid-cols-4">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-stone-700">
                  Product
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleSelectProduct(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none transition-all focus:border-[#FFBF01] focus:ring-1 focus:ring-[#FFBF01]"
                >
                  <option value="">
                    {isLoadingProducts ? "Loading products..." : "Select product"}
                  </option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-stone-700">
                  Quantity bags
                </label>
                <input
                  type="number"
                  min={1}
                  value={quantityBags}
                  onChange={(e) => setQuantityBags(Number(e.target.value))}
                  className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none transition-all focus:border-[#FFBF01] focus:ring-1 focus:ring-[#FFBF01]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-stone-700">
                  Price per kg
                </label>
                <input
                  type="number"
                  min={0}
                  value={pricePerKg}
                  onChange={(e) => setPricePerKg(Number(e.target.value))}
                  className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none transition-all focus:border-[#FFBF01] focus:ring-1 focus:ring-[#FFBF01]"
                />
              </div>

              {selectedProduct && (
                <div className="md:col-span-4 mt-2 rounded-xl border border-[#FFBF01]/20 bg-[#FFBF01]/5 p-4 text-sm">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div>
                      <p className="text-stone-500">Available stock</p>
                      <p className="font-semibold text-black">
                        {selectedProduct.availableBags} bags /{" "}
                        {selectedProduct.availableBags * selectedProduct.kgPerBag} kg
                      </p>
                    </div>
                    <div>
                      <p className="text-stone-500">Kg per bag</p>
                      <p className="font-semibold text-black">{selectedProduct.kgPerBag} kg</p>
                    </div>
                    <div>
                      <p className="text-stone-500">Selected quantity</p>
                      <p className="font-semibold text-[#FFBF01]">
                        {quantityBags} bags / {previewQuantityKg} kg
                      </p>
                    </div>
                    <div>
                      <p className="text-stone-500">Line total</p>
                      <p className="font-semibold text-black">{formatMoney(previewLineTotal)}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="md:col-span-4 mt-2">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full rounded-xl bg-black px-5 py-3.5 text-sm font-semibold text-[#FFBF01] transition-colors hover:bg-stone-800 disabled:opacity-40 disabled:hover:bg-black md:w-auto"
                  disabled={!selectedProduct}
                >
                  + Add Product
                </button>
              </div>
            </div>

            {items.length > 0 && (
              <div className="mt-6 overflow-hidden rounded-xl border border-stone-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-stone-50 text-stone-600">
                    <tr>
                      <th className="p-4 font-medium">Product</th>
                      <th className="p-4 font-medium">Bags</th>
                      <th className="p-4 font-medium">Kg</th>
                      <th className="p-4 font-medium">Price/kg</th>
                      <th className="p-4 font-medium">Total</th>
                      <th className="p-4 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {items.map((item, index) => (
                      <tr key={`${item.productId}-${index}`} className="hover:bg-stone-50/50">
                        <td className="p-4">
                          <p className="font-medium text-black">{item.productName}</p>
                          <p className="text-xs text-stone-500">
                            {item.sku} · {item.kgPerBag}kg/bag
                          </p>
                        </td>
                        <td className="p-4">{item.quantityBags}</td>
                        <td className="p-4">{item.quantityKg}</td>
                        <td className="p-4">{formatMoney(item.pricePerKg)}</td>
                        <td className="p-4 font-medium text-black">
                          {formatMoney(item.lineTotal)}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="text-sm font-medium text-red-500 transition-colors hover:text-red-700"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Payment Section */}
          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-xl font-semibold text-black">Payment Details</h2>

            <div className="overflow-hidden rounded-xl border border-stone-200">
              <div className="space-y-5 bg-white p-6">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-black">Subtotal</p>
                    <p className="text-sm text-stone-500">
                      {items.length} item{items.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="text-lg font-medium text-black">{formatMoney(subtotal)}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-stone-600">
                      Discount Amount
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(Number(e.target.value))}
                      className="w-full rounded-xl border border-stone-300 px-4 py-3 outline-none transition-all focus:border-[#FFBF01] focus:ring-1 focus:ring-[#FFBF01]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-stone-600">
                      Delivery Charge
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={deliveryAmount}
                      onChange={(e) => setDeliveryAmount(Number(e.target.value))}
                      className="w-full rounded-xl border border-stone-300 px-4 py-3 outline-none transition-all focus:border-[#FFBF01] focus:ring-1 focus:ring-[#FFBF01]"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <p className="font-medium text-black">VAT / Tax</p>
                  <div className="text-right">
                    <p className="font-medium text-black">{formatMoney(vatAmount)}</p>
                    <p className="text-xs text-[#FFBF01] font-medium">
                      {orderType === "VAT"
                        ? `${vatRate}% VAT Customer`
                        : orderType === "NON_VAT"
                        ? "NON-VAT Customer"
                        : "Select customer first"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Total Footer */}
              <div className="bg-stone-50 px-6 py-5 border-t border-stone-200">
                <div className="flex justify-between items-center text-xl font-bold text-black">
                  <p>Total Due</p>
                  <p className="text-[#FFBF01]">{formatMoney(totalAmount)}</p>
                </div>
              </div>
            </div>
            
            <div className="mt-6 rounded-xl border border-stone-200 bg-stone-50 p-5">
              <h3 className="mb-4 text-sm font-semibold text-stone-600 uppercase tracking-wider">Payment Method</h3>
              <div className="flex flex-col gap-4">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="radio"
                    name="paymentType"
                    checked={paymentType === "PAID_NOW"}
                    onChange={() => setPaymentType("PAID_NOW")}
                    className="h-5 w-5 border-stone-300 text-[#FFBF01] accent-[#FFBF01] focus:ring-[#FFBF01]"
                  />
                  <span className="font-medium">Mark as paid immediately</span>
                </label>

                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="radio"
                    name="paymentType"
                    checked={paymentType === "CREDIT"}
                    onChange={() => setPaymentType("CREDIT")}
                    className="h-5 w-5 border-stone-300 text-[#FFBF01] accent-[#FFBF01] focus:ring-[#FFBF01]"
                  />
                  <span className="font-medium">Payment due later (Credit)</span>
                </label>

                {paymentType === "CREDIT" && (
                  <div className="ml-8 mt-2 max-w-xs">
                    <label className="mb-2 block text-sm font-medium text-stone-600">
                      Payment due date
                    </label>
                    <input
                      type="date"
                      value={paymentDueDate}
                      onChange={(e) => setPaymentDueDate(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 px-4 py-3 outline-none transition-all focus:border-[#FFBF01] focus:ring-1 focus:ring-[#FFBF01]"
                    />
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-black">Customer Details</h2>

            {!selectedCustomer ? (
              <div>
                <input
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search company, contact person, phone, VAT no..."
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition-all focus:border-[#FFBF01] focus:bg-white focus:ring-1 focus:ring-[#FFBF01]"
                />

                {isLoadingCustomers && (
                  <p className="mt-3 text-sm text-stone-500">
                    Loading customers...
                  </p>
                )}

                {customerSearch && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
                    {filteredCustomers.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setSelectedCustomerAddressId(
                            customer.addresses.find((address) => address.isDefault)?.id ??
                              customer.addresses[0]?.id ??
                              ""
                          );
                          setCustomerSearch("");
                        }}
                        className="flex w-full items-center justify-between border-b border-stone-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[#FFBF01]/5"
                      >
                        <div>
                          <p className="font-medium text-black">{customer.name}</p>
                          <p className="text-sm text-stone-500">
                            {[customer.contactPerson, customer.phone]
                              .filter(Boolean)
                              .join(" · ") || "No contact details"}
                          </p>
                          {customer.vatNumber && (
                            <p className="text-xs font-medium text-stone-500">
                              VAT No: {customer.vatNumber}
                            </p>
                          )}
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            customer.type === "VAT"
                              ? "bg-[#FFBF01] text-black"
                              : "bg-stone-200 text-stone-700"
                          }`}
                        >
                          {customer.type === "VAT" ? "VAT" : "NON-VAT"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-black">{selectedCustomer.name}</p>
                    {selectedCustomer.contactPerson && (
                      <p className="mt-1 text-sm text-stone-600">
                        {selectedCustomer.contactPerson}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-stone-600">
                      {selectedCustomer.phone}
                    </p>
                    {selectedCustomer.addresses.length === 0 && selectedCustomerAddress && (
                      <p className="mt-1 text-sm text-stone-600">
                        {selectedCustomerAddress}
                      </p>
                    )}
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                      selectedCustomer.type === "VAT"
                        ? "bg-[#FFBF01] text-black"
                        : "bg-stone-200 text-stone-700"
                    }`}
                  >
                    {selectedCustomer.type === "VAT" ? "VAT" : "NON-VAT"}
                  </span>
                </div>

                {selectedCustomer.vatNumber && (
                  <div className="mb-4 rounded-lg bg-white p-3 border border-stone-200">
                    <p className="text-xs text-stone-500 uppercase tracking-wide">VAT No</p>
                    <p className="font-medium text-black">{selectedCustomer.vatNumber}</p>
                  </div>
                )}

                {selectedCustomer.addresses.length > 0 && (
                  <label className="mb-4 block space-y-1.5">
                    <span className="text-xs font-semibold uppercase text-stone-500">
                      Address to use
                    </span>
                    <select
                      value={selectedCustomerAddressId}
                      onChange={(event) =>
                        setSelectedCustomerAddressId(event.target.value)
                      }
                      className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#FFBF01] focus:ring-1 focus:ring-[#FFBF01]"
                    >
                      {selectedCustomer.addresses.map((address, index) => (
                        <option key={address.id} value={address.id}>
                          {address.label || `Address ${index + 1}`}
                        </option>
                      ))}
                    </select>
                    <p className="rounded-lg border border-stone-200 bg-white p-3 text-sm text-stone-600">
                      {selectedCustomerAddress}
                    </p>
                  </label>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setSelectedCustomerAddressId("");
                  }}
                  className="text-sm font-medium text-[#FFBF01] transition-colors hover:text-black"
                >
                  Change Customer
                </button>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-black">Order Notes</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add optional notes for this order..."
              rows={4}
              className="w-full resize-none rounded-xl border border-stone-300 px-4 py-3 outline-none transition-all focus:border-[#FFBF01] focus:ring-1 focus:ring-[#FFBF01]"
            />
          </section>

          <button
            type="button"
            onClick={handleCreateOrder}
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-[#FFBF01] px-5 py-4 text-lg font-bold text-black shadow-sm transition-all hover:bg-[#e0a800] focus:outline-none focus:ring-4 focus:ring-[#FFBF01]/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Processing Order..." : "Create Order"}
          </button>
        </aside>
      </div>
    </main>
  );
}
