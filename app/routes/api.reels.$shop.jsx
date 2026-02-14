import { data } from "react-router";
import db from "../db.server";

export const loader = async ({ params, request }) => {
  const { shop } = params;

  if (!shop) {
    return data(
      { error: "Shop parameter required" }, 
      { status: 400 }
    );
  }

  try {
    const connection = await db.instagramConnection.findUnique({
      where: { shop },
      include: {
        media: {  // Changed from 'reels' to 'media'
          orderBy: { displayOrder: 'asc' },
        },
        feedSettings: true,
      }
    });

    if (!connection) {
      return data(
        { 
          error: "Instagram not connected",
          media: [],
          settings: null
        }, 
        { 
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          }
        }
      );
    }

    let filteredMedia = connection.media;
    const mediaFilter = connection.feedSettings?.mediaFilter || 'both';
    
    if (mediaFilter === 'images') {
      filteredMedia = connection.media.filter(m => m.mediaType === 'IMAGE');
    } else if (mediaFilter === 'videos') {
      filteredMedia = connection.media.filter(m => m.mediaType === 'VIDEO');
    }

    return data(
      {
        success: true,
        username: connection.username,
        profilePictureUrl: connection.profilePictureUrl,
        settings: connection.feedSettings ? {
          feedTitle: connection.feedSettings.feedTitle,
          mediaFilter: connection.feedSettings.mediaFilter,
          onPostClick: connection.feedSettings.onPostClick,
          postSpacing: connection.feedSettings.postSpacing,
          roundedCorners: connection.feedSettings.roundedCorners,
          layout: connection.feedSettings.layout,
          format: connection.feedSettings.format,
          responsiveLayout: connection.feedSettings.responsiveLayout,
          sliderBehavior: connection.feedSettings.sliderBehavior,
        } : null,
        media: filteredMedia.map(item => ({
          id: item.instagramMediaId,
          mediaType: item.mediaType,
          permalink: item.permalink,
          thumbnailUrl: item.thumbnailUrl,
          mediaUrl: item.mediaUrl,
          caption: item.caption,
          timestamp: item.timestamp,
        }))
      }, 
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'public, max-age=300',
        }
      }
    );

  } catch (error) {
    console.error("Error fetching media:", error);
    return data(
      { 
        error: error.message,
        media: [],
        settings: null
      }, 
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
};

export const options = () => {
  return data({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
};