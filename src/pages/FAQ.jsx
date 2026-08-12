import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "How long does delivery take?",
    a: "Most orders are delivered within 3–5 business days depending on your location.",
  },
  {
    q: "Do I need an account to order?",
    a: "No. You can browse, add to cart, and check out as a guest — no sign-up required.",
  },
  {
    q: "What payment methods do you accept?",
    a: "Currently we support Cash on Delivery (COD). Online payments are coming soon.",
  },
  // { q: 'Can I return or exchange a product?', a: 'Yes, unused items with tags intact can be returned within 7 days of delivery.' },
  // {
  //   q: "How do you determine my delivery location?",
  //   a: "At checkout you can share your GPS location or drag the pin on the map to your exact address, so our delivery partner can navigate directly to you.",
  // },
];

export default function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-16">
      <p className="eyebrow">Need Help?</p>
      <h1 className="text-3xl mt-2 mb-10">Frequently Asked Questions</h1>
      <div className="divide-y divide-ink/10 border-t border-b border-ink/10">
        {faqs.map((f, i) => (
          <div key={f.q}>
            <button
              onClick={() => setOpen(open === i ? -1 : i)}
              className="w-full flex items-center justify-between py-5 text-left"
            >
              <span className="font-medium text-sm">{f.q}</span>
              <ChevronDown
                size={18}
                className={`text-stone transition-transform ${open === i ? "rotate-180" : ""}`}
              />
            </button>
            {open === i && (
              <p className="text-sm text-ink/70 pb-5 leading-relaxed">{f.a}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
