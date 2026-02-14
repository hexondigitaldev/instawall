import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
    const { shop } = await authenticate.webhook(request);
    try {
        const deleted = await db.instagramConnection.deleteMany({
            where: { shop }
        });
        console.log(`Cleaned up ${deleted.count} connection(s) for ${shop}`);
        console.log(`(Cascade deleted related media and feed settings)`);

    } catch (error) {
        console.error("Error during cleanup:", error);
    }

    return new Response(null, { status: 200 });
};