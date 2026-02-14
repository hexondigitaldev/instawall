import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  await authenticate.webhook(request);
  return new Response(JSON.stringify({
    message: "No customer data to redact - app only stores merchant-level data"
  }), { 
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};