import { authenticate } from "../shopify.server";
import  prisma  from "../db.server";

export const action = async ({ request }) => {
  const { shop, payload } = await authenticate.webhook(request);

  console.log("Shop redaction request (48hrs after uninstall):", {
    shop,
    shopId: payload.shop_id,
    shopDomain: payload.shop_domain
  });

  try {
    const connectionDeleted = await prisma.instagramConnection.deleteMany({
      where: { shop }
    });
    await prisma.feedSettings.deleteMany({
      where: { shop }
    });
    console.log(`${connectionDeleted.count} connection(s) deleted`);
  } catch (error) {
    console.error("Error during shop redaction:", error);
  }
  return new Response(null, { status: 200 });
};