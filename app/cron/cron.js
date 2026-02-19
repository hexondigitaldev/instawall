import db from "../db.server.js";
import fetch from "node-fetch"; 

const cronSecret = "1234";

async function main() {
  const startTime = Date.now();

  try {
    const connections = await db.instagramConnection.findMany({
      select: {
        id: true,
        shop: true,
        instagramAccountId: true,
        accessToken: true,
        username: true,
        tokenExpiresAt: true,
      },
    });

    if (connections.length === 0) {
      console.log("No shops to sync");
      return;
    }

    // Refresh tokens if expiring soon
    for (const connection of connections) {
      try {
        const expiresAt = new Date(connection.tokenExpiresAt);
        const now = new Date();
        const daysUntilExpiry = (expiresAt - now) / (1000 * 60 * 60 * 24);
        if (daysUntilExpiry < 7) {
          await refreshInstagramToken(connection);
          console.log(`Token refreshed for ${connection.shop}`);
        }
      } catch (error) {
        console.error(`:x: Failed to refresh token for ${connection.shop}:`, error.message);
      }
    }

    // Process media sync
    const results = [];

    for (let index = 0; index < connections.length; index++) {
      const connection = connections[index];
      try {
        if (connection.accessToken === "EXPIRED") {
          console.error(`Skipping ${connection.shop} - token expired`);
          results.push({
            shop: connection.shop,
            success: false,
            error: "Token expired - merchant needs to reconnect Instagram",
          });
          continue;
        }

        const mediaResult = await fetchAndStoreMedia(
          connection.id,
          connection.instagramAccountId,
          connection.accessToken
        );

        const accountDetails = await getInstagramAccountDetails(connection.accessToken);

        await db.instagramConnection.update({
          where: { id: connection.id },
          data: {
            username: accountDetails.username,
            profilePictureUrl: accountDetails.profile_picture_url || null,
            mediaCount: accountDetails.media_count,
            updatedAt: new Date(),
          },
        });

        results.push({
          shop: connection.shop,
          success: true,
          mediaCount: mediaResult.count,
          images: mediaResult.images,
          videos: mediaResult.videos,
        });

        // 2-second delay between shops to avoid rate limits
        if (index < connections.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error) {
        if (
          error.message.includes("190") ||
          error.message.includes("expired") ||
          error.message.includes("OAuthException")
        ) {
          try {
            await db.instagramConnection.update({
              where: { id: connection.id },
              data: {
                accessToken: "EXPIRED",
                updatedAt: new Date(),
              },
            });
          } catch (dbError) {
            console.error("Failed to mark token as expired in DB:", dbError.message);
          }
        }

        results.push({
          shop: connection.shop,
          success: false,
          error: error.message,
        });
      }
    }

    // Log summary
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;
    const duration = Date.now() - startTime;

    console.log(`Cron finished: Synced ${successCount} shops successfully, ${failCount} failed`);
    console.log(`Duration: ${duration}ms`);
    console.log(results);
  } catch (error) {
    console.error("Cron job failed:", error.message);
    console.error(error);
  }
}

/**
 * Refresh Instagram Access Token
 */
async function refreshInstagramToken(connection) {
  const response = await fetch(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_exchange_token&access_token=${connection.accessToken}`
  );

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${errorData}`);
  }

  const data = await response.json();

  await db.instagramConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: data.access_token,
      tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      updatedAt: new Date(),
    },
  });

  return data;
}

/**
 * Fetch Instagram account details
 */
async function getInstagramAccountDetails(accessToken) {
  const response = await fetch(
    `https://graph.instagram.com/me?fields=id,username,account_type,media_count,profile_picture_url&access_token=${accessToken}`
  );

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Instagram API error (${response.status}): ${errorData}`);
  }

  return await response.json();
}

/**
 * Fetch media from Instagram and store in DB
 */
async function fetchAndStoreMedia(connectionId, accountId, accessToken) {
  const response = await fetch(
    `https://graph.instagram.com/${accountId}/media?fields=id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,like_count,comments_count&limit=10&access_token=${accessToken}`
  );

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to fetch Instagram media (${response.status}): ${errorData}`);
  }

  const mediaData = await response.json();
  const mediaItems = mediaData.data || [];

  const validMedia = mediaItems.filter((item) => item.media_type === "IMAGE" || item.media_type === "VIDEO");

  if (validMedia.length === 0) {
    return { count: 0, images: 0, videos: 0 };
  }

  // Delete previous media for this connection
  await db.instagramMedia.deleteMany({
    where: { instagramConnectionId: connectionId },
  });

  let imageCount = 0;
  let videoCount = 0;

  for (let i = 0; i < validMedia.length; i++) {
    const item = validMedia[i];

    await db.instagramMedia.create({
      data: {
        instagramConnectionId: connectionId,
        instagramMediaId: item.id,
        mediaType: item.media_type,
        permalink: item.permalink,
        thumbnailUrl: item.thumbnail_url || null,
        mediaUrl: item.media_url,
        caption: item.caption || null,
        timestamp: item.timestamp,
        likeCount: item.like_count || 0,
        commentsCount: item.comments_count || 0,
        displayOrder: i + 1,
      },
    });

    if (item.media_type === "IMAGE") imageCount++;
    if (item.media_type === "VIDEO") videoCount++;
  }

  return { count: validMedia.length, images: imageCount, videos: videoCount };
}

// Run the cron script
main().catch((err) => {
  console.error("Unhandled error in cron:", err);
  process.exit(1);
});