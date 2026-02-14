import { redirect } from "react-router";
import db from "../../db.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  // 1. Retrieve the shop from the 'state' parameter passed during the initial OAuth request
  const shop = url.searchParams.get("state");
  
  console.log("shop (from state)", shop);

  // 2. CRITICAL: If 'shop' is missing, we cannot construct the return URL.
  // We throw an error instead of redirecting to a hardcoded test store.
  if (!shop) {
    console.error("Missing shop state in Instagram callback");
    throw new Response("Missing shop parameter in state. Cannot redirect to Shopify Admin.", { status: 400 });
  }

  // 3. Construct the Dynamic Admin URL
  // Remove '.myshopify.com' to get the clean store handle for the Admin URL
  // e.g., 'my-cool-store.myshopify.com' -> 'my-cool-store'
  const cleanShopName = shop.replace(".myshopify.com", "");
  
  // Your App Handle (from your Partner Dashboard)
  const appHandle = "instagram-86"; 
  
  // The base URL to redirect the user back to your app within Shopify Admin
  const baseAdminUrl = `https://admin.shopify.com/store/${cleanShopName}/apps/${appHandle}/app`;

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorReason = url.searchParams.get("error_reason");
  const errorDescription = url.searchParams.get("error_description");

  // Handle Instagram OAuth Errors (User denied access, etc.)
  if (error) {
    console.error("Instagram OAuth error:", {
      error,
      errorReason,
      errorDescription,
    });
    
    // Redirect dynamically to the specific user's store
    return redirect(`${baseAdminUrl}?error=instagram_auth_failed&reason=${errorReason || error}`);
  }

  if (!code) {
    return redirect(`${baseAdminUrl}?error=no_auth_code`);
  }

  try {
    console.log("Step 1: Exchanging code for token...");
    const tokenResponse = await exchangeCodeForToken(code);
    
    if (!tokenResponse.access_token) {
      throw new Error("No access token received from Instagram");
    }

    const { access_token, user_id } = tokenResponse;

    console.log("Step 2: Getting long-lived token...");
    const longLivedTokenData = await getLongLivedToken(access_token);

    console.log("Step 3: Getting account details and profile picture...");
    const accountDetails = await getInstagramAccountDetails(longLivedTokenData.access_token);
    console.log("Account details:", accountDetails);

    const expiresInSeconds = longLivedTokenData.expires_in || (60 * 24 * 60 * 60);
    const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    // Step 4: Store/Update Instagram Connection with profile picture
    console.log("Step 4: Saving Instagram connection to database...");
    const connection = await db.instagramConnection.upsert({
      where: { shop },
      update: {
        instagramAccountId: accountDetails.id,
        accessToken: longLivedTokenData.access_token,
        username: accountDetails.username,
        profilePictureUrl: accountDetails.profile_picture_url || null,
        followersCount: 0,
        mediaCount: accountDetails.media_count,
        connectedAt: new Date().toISOString(),
        tokenExpiresAt: tokenExpiresAt,
      },
      create: {
        shop,
        instagramAccountId: accountDetails.id,
        accessToken: longLivedTokenData.access_token,
        username: accountDetails.username,
        profilePictureUrl: accountDetails.profile_picture_url || null,
        followersCount: 0,
        mediaCount: accountDetails.media_count,
        connectedAt: new Date().toISOString(),
        tokenExpiresAt: tokenExpiresAt,
      },
    });

    console.log("Step 5: Creating default feed settings...");
    try {
      await db.feedSettings.upsert({
        where: { shop },
        update: {
          instagramConnectionId: connection.id,
        },
        create: {
          shop,
          instagramConnectionId: connection.id,
          feedTitle: "Amazing Feed",
          mediaFilter: "both",
          onPostClick: "go_to_instagram",
          postSpacing: "small",
          roundedCorners: "none",
          layout: "slider",
          format: "3:4",
          responsiveLayout: "auto",
          sliderBehavior: "static",
          gridColumns: 5,
        },
      });
    } catch (settingsError) {
      console.error("Error creating feed settings (non-critical):", settingsError);
    }
    
    // Step 6: Fetch and store media (images and videos)
    try {
      const mediaResult = await fetchAndStoreMedia(
        connection.id,
        accountDetails.id,
        longLivedTokenData.access_token
      );
      
      if (mediaResult.count > 0) {
        console.log(`Successfully stored ${mediaResult.count} media items (${mediaResult.images} images, ${mediaResult.videos} videos)`);
      } else {
        console.log("No media found to store");
      }
    } catch (mediaError) {
      console.error("Error fetching media (non-blocking):", mediaError);
    }
    
    // SUCCESS: Redirect dynamically to the user's admin
    return redirect(`${baseAdminUrl}?instagram_connected=true`);
    
  } catch (error) {
    // FAILURE: Redirect dynamically to the user's admin with error message
    console.error("Processing failed", error);
    return redirect(`${baseAdminUrl}?error=processing_failed&message=${encodeURIComponent(error.message)}`);
  }
};

async function exchangeCodeForToken(code) {
  const params = new URLSearchParams({
    client_id: "1423828959321697",
    client_secret: "ae136d847996bac4c139675d27b0ef7d",
    grant_type: "authorization_code",
    redirect_uri: `https://forums-decision-source-qualities.trycloudflare.com/instagram/callback`,
    code: code,
  });

  const response = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Token exchange failed: ${JSON.stringify(errorData)}`);
  }
  return await response.json();
}

async function getLongLivedToken(shortLivedToken) {
  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.append("grant_type", "ig_exchange_token");
  url.searchParams.append("client_secret", "ae136d847996bac4c139675d27b0ef7d");
  url.searchParams.append("access_token", shortLivedToken);

  const response = await fetch(url);
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Long-lived token exchange failed: ${JSON.stringify(errorData)}`);
  }

  return await response.json();
}

async function getInstagramAccountDetails(accessToken) {
  // Updated to include profile_picture_url in the fields
  const url = `https://graph.instagram.com/me?fields=id,username,account_type,media_count,profile_picture_url&access_token=${accessToken}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to fetch account details: ${JSON.stringify(errorData)}`);
  }
  return await response.json();
}

async function fetchAndStoreMedia(connectionId, instagramUserId, accessToken) {
  try {
    console.log(`Fetching media for Instagram user: ${instagramUserId}`);
    
    // Fetch media with all necessary fields
    const mediaUrl = `https://graph.instagram.com/${instagramUserId}/media?fields=id,media_type,media_url,thumbnail_url,permalink,caption,timestamp&limit=25&access_token=${accessToken}`;
    
    const response = await fetch(mediaUrl);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to fetch media: ${JSON.stringify(errorData)}`);
    }

    const mediaData = await response.json();
    
    if (!mediaData.data || mediaData.data.length === 0) {
      console.log("No media found for this Instagram account");
      return { success: false, count: 0, images: 0, videos: 0 };
    }

    console.log(`Total media items fetched: ${mediaData.data.length}`);

    // Filter for IMAGE and VIDEO types (exclude CAROUSEL_ALBUM for now, but you can include it)
    const imageAndVideoMedia = mediaData.data.filter(media => 
      media.media_type === 'IMAGE' || media.media_type === 'VIDEO'
    );
    
    const imageCount = imageAndVideoMedia.filter(m => m.media_type === 'IMAGE').length;
    const videoCount = imageAndVideoMedia.filter(m => m.media_type === 'VIDEO').length;
    
    console.log(`Found ${imageCount} images and ${videoCount} videos`);

    if (imageAndVideoMedia.length === 0) {
      console.log("No images or videos found for this Instagram account");
      return { success: false, count: 0, images: 0, videos: 0 };
    }

    // Take up to 10 media items (mix of images and videos)
    const mediaToStore = imageAndVideoMedia.slice(0, Math.min(imageAndVideoMedia.length, 10));
    
    console.log(`Storing ${mediaToStore.length} media items`);

    // Check if db.instagramMedia exists (safety check)
    if (!db.instagramMedia) {
      throw new Error("InstagramMedia model not found in Prisma client. Did you run 'npx prisma generate'?");
    }

    // Delete existing media for this connection to avoid duplicates
    const deletedCount = await db.instagramMedia.deleteMany({
      where: { instagramConnectionId: connectionId }
    });
    
    console.log(`Deleted ${deletedCount.count} old media items`);

    // Store each media item in the database
    const createdMedia = [];
    let storedImages = 0;
    let storedVideos = 0;
    
    for (let i = 0; i < mediaToStore.length; i++) {
      const media = mediaToStore[i];
      
      try {
        const createdItem = await db.instagramMedia.create({
          data: {
            instagramConnectionId: connectionId,
            instagramMediaId: media.id,
            mediaType: media.media_type,
            permalink: media.permalink,
            thumbnailUrl: media.thumbnail_url || null,
            mediaUrl: media.media_url || "",
            caption: media.caption || "",
            timestamp: media.timestamp,
            likeCount: 0,
            commentsCount: 0,
            viewsCount: null,
            displayOrder: i + 1,
          },
        });
        
        createdMedia.push(createdItem);
        
        if (media.media_type === 'IMAGE') {
          storedImages++;
        } else if (media.media_type === 'VIDEO') {
          storedVideos++;
        }
        
        console.log(`Stored ${media.media_type.toLowerCase()} ${i + 1}/${mediaToStore.length}: ${media.id}`);
        
      } catch (createError) {
        console.error(`Error storing media ${i + 1}:`, createError);
        // Continue with other media even if one fails
      }
    }
    
    console.log(`Successfully stored ${createdMedia.length} media items in database`);
    
    return { 
      success: true, 
      count: createdMedia.length,
      images: storedImages,
      videos: storedVideos,
      media: createdMedia 
    };

  } catch (error) {
    console.error("Error in fetchAndStoreMedia:", error);
    throw error;
  }
}

export default function InstagramCallback() {
  return null;
}