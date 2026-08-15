export default function About() {
  return (
    <div>
      <section className="bg-ink text-ivory py-20">
        <div className="max-w-3xl mx-auto px-5 md:px-8 text-center">
          <p className="eyebrow text-champagne">Our Story</p>
          <h1 className="font-display text-4xl mt-3">About The KAVSI</h1>
        </div>
      </section>
      <section className="max-w-3xl mx-auto px-5 md:px-8 py-16 space-y-6 text-ink/80 leading-relaxed">
        <p>
          The KAVSI is a contemporary ethnic-wear brand bridging the gap between
          traditional craftsmanship and modern lifestyle needs.{" "}
        </p>
        <p>
          Specializing in premium kurtis, short kurtas, and co-ord sets, the
          brand is designed for today’s confident generation of women who refuse
          to compromise on style, comfort, or conscience.{" "}
        </p>
        <p>
          Our Philosophy: "Honoring purity through premium fabric craftsmanship,
          ensuring every stitch feels as authentic as your heritage."
        </p>
      </section>
      <section className="bg-blush/30 py-16">
        <div className="max-w-5xl mx-auto px-5 md:px-8 grid sm:grid-cols-3 gap-8 text-center">
          {[
            [
              "Considered Design",
              "Every silhouette is tested for real movement, not just photographs.",
            ],
            [
              "Honest Pricing",
              "Premium fabric and finish, without the boutique markup.",
            ],
            [
              "Direct Support",
              "Reach us on call or WhatsApp — no chatbots, no runaround.",
            ],
          ].map(([title, text]) => (
            <div key={title}>
              <h3 className="font-display text-lg mb-2">{title}</h3>
              <p className="text-sm text-ink/70">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
