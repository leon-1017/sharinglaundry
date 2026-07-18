interface InquiryBody {
  name?: string;
  email?: string;
  message?: string;
}

export const onRequestPost: PagesFunction = async (context) => {
  try {
    const body = await context.request.json<InquiryBody>();
    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim();
    const message = String(body?.message || "").trim();

    if (!name || !email || !message) {
      return Response.json({ success: false, error: "Name, email and message are required." }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ success: false, error: "Please enter a valid email address." }, { status: 400 });
    }

    // TODO: wire to your email API or Cloudflare Email binding here.
    // Example using Cloudflare Email Service:
    // await context.env.EMAIL.send("info@sharinglaundry.com", `Inquiry from ${name}`, `Email: ${email}\n\n${message}`);

    console.log("Inquiry received:", { name, email, message });

    return Response.json({ success: true, message: "Thank you for your inquiry. We will get back to you soon." });
  } catch {
    return Response.json({ success: false, error: "Something went wrong. Please try again later." }, { status: 500 });
  }
};
