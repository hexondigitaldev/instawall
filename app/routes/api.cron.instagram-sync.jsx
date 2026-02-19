import { data } from "react-router";
import db from "../db.server";

export const loader = async () => {
  return data({ 
    error: "This is a POST-only endpoint. Use POST method to trigger sync." 
  }, { 
    status: 405 
  });
};

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }


  const authHeader = request.headers.get("Authorization");
  const cronSecret = "1234";
  const isAuthorized = authHeader === `Bearer ${cronSecret}`;

  if (!isAuthorized) {
    return data({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const startTime = Date.now();
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
      return data({
        success: true,
        message: "No shops to sync",
        totalShops: 0,
        results: [],
        duration: Date.now() - startTime,
      });
    }

    for (const connection of connections) {
      try {
        const expiresAt = new Date(connection.tokenExpiresAt);
        const now = new Date();
        const daysUntilExpiry = (expiresAt - now) / (1000 * 60 * 60 * 24);
        if (daysUntilExpiry < 7) {
          await refreshInstagramToken(connection);
        }
      } catch (error) {
        console.error(`❌ Failed to check/refresh token for ${connection.shop}:`, error.message);
      }
    }

    const results = [];

    for (let index = 0; index < connections.length; index++) {
      const connection = connections[index];
      
      try {

        if (connection.accessToken === 'EXPIRED') {
          console.error(`⏭️ Skipping ${connection.shop} - token expired, merchant needs to reconnect`);
          results.push({
            shop: connection.shop,
            success: false,
            error: 'Token expired - merchant needs to reconnect Instagram',
          });
          continue;
        }

        const mediaResult = await fetchAndStoreMedia(
          connection.id,
          connection.instagramAccountId,
          connection.accessToken
        );

        const accountDetails = await getInstagramAccountDetails(
          connection.accessToken
        );

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

        if (index < connections.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
        }

      } catch (error) {
        if (error.message.includes('190') || error.message.includes('expired') || error.message.includes('OAuthException')) {
          try {
            await db.instagramConnection.update({
              where: { id: connection.id },
              data: { 
                accessToken: 'EXPIRED',
                updatedAt: new Date()
              }
            });

          } catch (dbError) {

          }
        }
        
        results.push({
          shop: connection.shop,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;
    const duration = Date.now() - startTime;

    return data({
      success: true,
      message: `Synced ${successCount} shops successfully, ${failCount} failed`,
      totalShops: connections.length,
      successCount,
      failCount,
      duration,
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    return data(
      {
        success: false,
        error: error.message || "Failed to run sync job",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
};


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
      tokenExpiresAt: new Date(Date.now() + (data.expires_in * 1000)).toISOString(),
      updatedAt: new Date(),
    },
  });
  return data;
}


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

  const validMedia = mediaItems.filter(
    (item) => item.media_type === "IMAGE" || item.media_type === "VIDEO"
  );

  if (validMedia.length === 0) {
    return { count: 0, images: 0, videos: 0 };
  }

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

  return {
    count: validMedia.length,
    images: imageCount,
    videos: videoCount,
  };
}