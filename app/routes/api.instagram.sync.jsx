import { data } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  try {

    const connection = await db.instagramConnection.findUnique({
      where: { shop: session.shop },
    });

    if (!connection) {
      return data(
        { 
          success: false, 
          error: "Instagram account not connected" 
        }, 
        { status: 404 }
      );
    }

    // Fetch latest media from Instagram
    const mediaResult = await fetchAndStoreMedia(
      connection.id,
      connection.instagramAccountId,
      connection.accessToken
    );

    // Update account details
    const accountDetails = await getInstagramAccountDetails(connection.accessToken);

    // Update connection with latest info
    await db.instagramConnection.update({
      where: { id: connection.id },
      data: {
        username: accountDetails.username,
        profilePictureUrl: accountDetails.profile_picture_url || null,
        mediaCount: accountDetails.media_count,
      },
    });

    return data({
      success: true,
      message: `Successfully synced ${mediaResult.count} media items`,
      stats: {
        totalMedia: mediaResult.count,
        images: mediaResult.images,
        videos: mediaResult.videos,
      },
    });

  } catch (error) {
    console.error("Error syncing Instagram:", error);
    return data(
      { 
        success: false, 
        error: error.message || "Failed to sync Instagram data" 
      }, 
      { status: 500 }
    );
  }
};

async function getInstagramAccountDetails(accessToken) {
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

    // Take up to 10 media items
    const mediaToStore = imageAndVideoMedia.slice(0, Math.min(imageAndVideoMedia.length, 10));
    console.log(`Storing ${mediaToStore.length} media items`);
    const deletedCount = await db.instagramMedia.deleteMany({
      where: { instagramConnectionId: connectionId }
    });
    
    console.log(`Deleted ${deletedCount.count} old media items`);

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