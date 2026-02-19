import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { shop, payload } = await authenticate.webhook(request);

  console.log("Customer data request:", {
    shop,
    customerId: payload.customer?.id,
    email: payload.customer?.email
  });

  return new Response(JSON.stringify({
    message: "This app does not collect or store customer personal data",
    data_stored: "Merchant Instagram connections and public media only"
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};