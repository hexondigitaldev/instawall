import { useState, useEffect, useRef } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { data } from "react-router";
import db from "../db.server";

const PREVIEW_CSS = `
  /* --- BASE PREVIEW STYLES --- */
  .preview-wrapper {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    padding: 10px; 
    position: relative;
  }

  /* Make the Right Column Sticky */
  .sticky-preview {
    position: sticky;
    top: 20px;
    height: fit-content;
  }

  .instagram-reels-heading {
    text-align: center;
    font-size: 1.2rem;
    margin-bottom: 15px;
    font-weight: 600;
    color: #000;
  }

  /* --- GRID PREVIEW (Adjusted for Sidebar) --- */
  .instagram-reels-grid {
    display: grid;
    /* Force 2 columns in the sidebar for better look */
    grid-template-columns: repeat(2, 1fr); 
    width: 100%;
    gap: 8px;
  }
  
  .instagram-reel-card {
    position: relative;
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.2s;
  }
  .reel-thumbnail {
    position: relative;
    width: 100%;
    background: linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%);
    overflow: hidden;
  }
  .reel-thumbnail img, .reel-thumbnail video {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .reel-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  .instagram-reel-card:hover .reel-overlay {
    opacity: 1;
  }

  /* --- SLIDER STYLES --- */
  .instagram-reels-slider {
    position: relative;
    overflow: hidden;
    width: 100%;
    display: flex;
    align-items: center;
  }
  .slider-track {
    display: flex;
    overflow-x: auto;
    scroll-behavior: smooth;
    scrollbar-width: none;
    padding: 10px 0;
    width: 100%;
  }
  .slider-track::-webkit-scrollbar {
    display: none;
  }
  .slider-track .instagram-reel-card {
    flex: 0 0 auto;
    width: 140px; /* Smaller card width for sidebar */
  }
  .slider-nav {
    position: absolute;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid #ddd;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    z-index: 10;
    top: 50%
  }
  .slider-prev { left: 5px; }
  .slider-next { right: 5px; }
  .slider-nav:hover { background: #fff; }

  /* --- POPUP STYLES --- */
  .instagram-popup-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
  }

  /* DETAILED POPUP */
  .instagram-popup-detailed-modern {
    background: white;
    border-radius: 12px;
    max-width: 90vw;
    max-height: 90vh;
    width: 935px;
    height: 600px;
    position: relative;
    overflow: hidden;
    display: flex;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  }
  .popup-close-modern {
    position: absolute;
    top: 15px;
    right: 15px;
    background: transparent;
    color: white;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    transition: background 0.3s ease;
  }
  .popup-close-modern:hover { background: rgba(255, 255, 255, 0.2); }
  .popup-content-wrapper { display: flex; width: 100%; height: 100%; }
  .popup-media-section {
    flex: 1.5;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  .popup-media-content { max-width: 100%; max-height: 100%; object-fit: contain; }
  .popup-info-section { flex: 1; display: flex; flex-direction: column; background: white; }
  .popup-header { padding: 14px 16px; border-bottom: 1px solid #dbdbdb; }
  .popup-profile { display: flex; align-items: center; gap: 12px; }
  .popup-profile-pic { width: 32px; height: 32px; border-radius: 50%; overflow: hidden; background: #f0f0f0; }
  .popup-profile-pic img { width: 100%; height: 100%; object-fit: cover; }
  .popup-username { font-weight: 600; font-size: 14px; color: #262626; }
  .popup-caption-section { flex: 1; overflow-y: auto; padding: 16px; }
  .popup-caption-content { line-height: 1.5; font-size: 14px; }
  .caption-username { font-weight: 600; color: #262626; margin-right: 4px; }
  .caption-text { color: #262626; word-wrap: break-word; }
  .popup-actions-section { padding: 16px; border-top: 1px solid #dbdbdb; }
  .popup-instagram-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 8px 16px;
    background: #0095f6;
    color: white;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
    transition: background 0.3s ease;
    cursor: pointer;
  }
  .popup-instagram-btn:hover { background: #1877f2; }

  /* MINIMAL POPUP */
  .instagram-popup-minimal {
    position: relative;
    width: auto;
    height: 80vh;
    max-width: 450px;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .popup-image-container, .popup-video-container {
    position: relative;
    width: 550px;
    height: 80vh;
    background: #000;
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  }
  .popup-image-full, .popup-video-full {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  .popup-close-minimal {
    position: absolute;
    top: -50px;
    right: 0;
    background: transparent;
    color: white;
    border: none;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    transition: background 0.3s ease;
  }
  .popup-close-minimal:hover { background: rgba(255, 255, 255, 0.1); }
  
  @media (max-width: 768px) {
    .instagram-popup-detailed-modern { flex-direction: column; width: 95vw; height: 90vh; }
    .popup-media-section { flex: 1; min-height: 50%; }
    .popup-info-section { flex: 1; max-height: 50%; }
    .popup-close-modern { top: 10px; right: 10px; background: rgba(0,0,0,0.6); }
    .instagram-popup-minimal { max-width: 90%; }
  }
`;

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const instagramConnected = url.searchParams.get("instagram_connected");
  const settingsSaved = url.searchParams.get("settings_saved");
  const APP_URL = process.env.SHOPIFY_APP_URL;
  const connection = await db.instagramConnection.findUnique({
    where: { shop: session.shop },
    include: {
      media: {
        orderBy: { displayOrder: 'asc' },
      },
      feedSettings: true,
    }
  });

  let imageCount = 0;
  let videoCount = 0;

  if (connection?.media) {
    imageCount = connection.media.filter(m => m.mediaType === 'IMAGE').length;
    videoCount = connection.media.filter(m => m.mediaType === 'VIDEO').length;
  }

  let lastSyncText = 'Never';
  if (connection?.updatedAt) {
    const now = new Date();
    const updated = new Date(connection.updatedAt);
    const diffMs = now - updated;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      lastSyncText = 'Just now';
    } else if (diffMins < 60) {
      lastSyncText = `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHours < 24) {
      lastSyncText = `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else {
      lastSyncText = `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    }
  }


  const response = await admin.graphql(
    `#graphql
    query getThemeSettings {
      themes(first: 1, roles: MAIN) {
        nodes {
          id
          files(filenames: "config/settings_data.json") {
            nodes {
              body {
                ... on OnlineStoreThemeFileBodyText {
                  content
                }
              }
            }
          }
        }
      }
    }`
  );

  const responseJson = await response.json();
  const mainTheme = responseJson.data?.themes?.nodes[0];
  let isEmbedActive = false;
  const EXTENSION_UUID = process.env.INSTAGRAM_EXTENSION_UUID;
  const BLOCK_HANDLE = "instagram_reels_embed";

  if (mainTheme?.files?.nodes[0]?.body?.content) {
    try {
      let jsonString = mainTheme.files.nodes[0].body.content;
      jsonString = jsonString.replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, g) => g ? "" : m);
      const settings = JSON.parse(jsonString);
      const blocks = settings.current?.blocks || {};
      isEmbedActive = Object.values(blocks).some((block) => {
        const isMyBlock = block.type.includes(EXTENSION_UUID) && block.type.includes(BLOCK_HANDLE);
        return isMyBlock && block.disabled !== true;
      });
    } catch (error) {
      console.error("Error parsing theme settings:", error);
    }
  }


  return data({
    shop: session.shop,
    isEmbedActive,
    domain: APP_URL,
    instagramAppId: process.env.INSTAGRAM_APP_ID,
    isConnected: !!connection,
    connection: connection ? {
      username: connection.username,
      profilePictureUrl: connection.profilePictureUrl,
      instagramAccountId: connection.instagramAccountId,
      mediaCount: connection.mediaCount,
      connectedAt: connection.connectedAt,
      imageCount: imageCount,
      videoCount: videoCount,
      totalMediaCount: connection.media.length,
      lastSync: lastSyncText,
      media: connection.media
    } : null,
    feedSettings: connection?.feedSettings || null,
    justConnected: instagramConnected === 'true',
    settingsSaved: settingsSaved === 'true',
  });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("action");

  if (actionType === "disconnect") {
    try {
      await db.instagramConnection.delete({
        where: { shop: session.shop }
      });
      return data({ success: true, message: "Instagram account disconnected successfully" });
    } catch (error) {
      console.error("Error disconnecting Instagram:", error);
      return data({ success: false, error: "Failed to disconnect Instagram account" }, { status: 500 });
    }
  }

  if (actionType === "save_settings") {
    try {
      const feedTitle = formData.get("feedTitle");
      const mediaFilter = formData.get("mediaFilter");
      const onPostClick = formData.get("onPostClick");
      const postSpacing = formData.get("postSpacing");
      const roundedCorners = formData.get("roundedCorners");
      const layout = formData.get("layout");
      const format = formData.get("format");
      const responsiveLayout = formData.get("responsiveLayout");
      const sliderBehavior = formData.get("sliderBehavior");

      await db.feedSettings.update({
        where: { shop: session.shop },
        data: { feedTitle, mediaFilter, onPostClick, postSpacing, roundedCorners, layout, format, responsiveLayout, sliderBehavior },
      });
      return data({ success: true, message: "Feed settings saved successfully", settingsSaved: true });
    } catch (error) {
      console.error("Error saving feed settings:", error);
      return data({ success: false, error: "Failed to save feed settings" }, { status: 500 });
    }
  }
  return data({ success: false, error: "Invalid action" }, { status: 400 });
};

export default function Index() {
  const disconnectFetcher = useFetcher();
  const settingsFetcher = useFetcher();
  const syncFetcher = useFetcher();
  const shopify = useAppBridge();

  const { shop, isEmbedActive, isConnected, connection, feedSettings: initialFeedSettings, justConnected, settingsSaved, domain, instagramAppId } = useLoaderData();

  const [previewSettings, setPreviewSettings] = useState({
    feedTitle: initialFeedSettings?.feedTitle || "",
    mediaFilter: initialFeedSettings?.mediaFilter || "both",
    onPostClick: initialFeedSettings?.onPostClick || "go_to_instagram",
    postSpacing: initialFeedSettings?.postSpacing || "small",
    roundedCorners: initialFeedSettings?.roundedCorners || "none",
    layout: initialFeedSettings?.layout || "slider",
    format: initialFeedSettings?.format || "3:4",
    responsiveLayout: initialFeedSettings?.responsiveLayout || "auto",
    sliderBehavior: initialFeedSettings?.sliderBehavior || "static",
  });

  const [activePopup, setActivePopup] = useState(null);
  const sliderTrackRef = useRef(null);

  useEffect(() => {
    if (initialFeedSettings) {
      setPreviewSettings(initialFeedSettings);
    }
  }, [initialFeedSettings]);

  const isDisconnecting = ["loading", "submitting"].includes(disconnectFetcher.state);
  const isSavingSettings = ["loading", "submitting"].includes(settingsFetcher.state);
  const isSyncing = ["loading", "submitting"].includes(syncFetcher.state);

  useEffect(() => {
    if (disconnectFetcher.data?.success) shopify.toast.show(disconnectFetcher.data.message);
    if (settingsFetcher.data?.success) shopify.toast.show(settingsFetcher.data.message);
    if (syncFetcher.data?.success) {
      shopify.toast.show(syncFetcher.data.message);
      window.location.reload();
    } else if (syncFetcher.data?.error) {
      shopify.toast.show(syncFetcher.data.error, { isError: true });
    }
  }, [disconnectFetcher.data, settingsFetcher.data, syncFetcher.data]);

  const handleConnection = () => {
    const redirectUri = encodeURIComponent(`${domain}/instagram/callback`);
    const scopes = encodeURIComponent("instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights");
    const state = encodeURIComponent(shop);
    return `https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=${instagramAppId}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes}&state=${state}`;
  };

  const handleDisconnect = () => disconnectFetcher.submit({ action: "disconnect" }, { method: "POST" });
  const handleSync = () => syncFetcher.submit({}, { method: "POST", action: "/api/instagram/sync" });

  // --- PREVIEW LOGIC ---
  const handleSettingChange = (field, value) => setPreviewSettings((prev) => ({ ...prev, [field]: value }));

  const getAspectRatio = (format) => {
    switch (format) {
      case '3:4': return '133.33%';
      case '4:5': return '125%';
      case '1:1': return '100%';
      case '9:16': return '177.78%';
      case '4:3': return '75%';
      case 'circle': return '100%';
      default: return '125%';
    }
  };

  const getSpacing = (spacing) => {
    switch (spacing) {
      case 'small': return '8px';
      case 'medium': return '16px';
      case 'large': return '24px';
      case 'none': return '0px';
      default: return '8px';
    }
  };

  const getBorderRadius = (corners) => {
    switch (corners) {
      case 'none': return '0px';
      case 'small': return '8px';
      case 'medium': return '16px';
      case 'large': return '24px';
      default: return '0px';
    }
  };

  const scrollSlider = (direction) => {
    if (sliderTrackRef.current) {
      sliderTrackRef.current.scrollBy({ left: direction * 140, behavior: 'smooth' });
    }
  };

  const getFilteredMedia = () => {
    if (!connection?.media) return [];
    if (previewSettings.mediaFilter === 'images') return connection.media.filter(m => m.mediaType === 'IMAGE');
    if (previewSettings.mediaFilter === 'videos') return connection.media.filter(m => m.mediaType === 'VIDEO');
    return connection.media;
  };

  const handlePreviewClick = (item) => {
    const action = previewSettings.onPostClick;
    if (action === 'do_nothing') return;
    if (action === 'go_to_instagram') {
      window.open(item.permalink, '_blank');
      return;
    }
    if (action === 'detailed_popup') {
      setActivePopup({ type: 'detailed', item });
    } else if (action === 'minimal_popup') {
      setActivePopup({ type: 'minimal', item });
    }
  };

  const handleEnableApp = () => {
    // UPDATED: Must use the UUID found in your settings_data.json
    const extensionId = "019bd59e-accf-7915-9db1-d4ff4ad47e2b";
    // UPDATED: This must match the loader and your file name
    const blockHandle = "instagram_reels_embed";
    const deepLink = `https://${shop}/admin/themes/current/editor?context=apps&activateAppId=${extensionId}/${blockHandle}`;
    window.open(deepLink, "_blank");
  }


  const filteredMedia = getFilteredMedia();
  const spacingVal = getSpacing(previewSettings.postSpacing);
  const radiusVal = getBorderRadius(previewSettings.roundedCorners);
  const ratioVal = getAspectRatio(previewSettings.format);
  const isCircle = previewSettings.format === 'circle';

  return (
    <s-page heading="Instagram Feed">
      <style>{PREVIEW_CSS}</style>

      {/* POPUP RENDERER */}
      {activePopup && (
        <div className="instagram-popup-overlay" onClick={(e) => {
          if (e.target.classList.contains('instagram-popup-overlay')) setActivePopup(null);
        }}>
          {activePopup.type === 'detailed' && (
            <div className="instagram-popup-detailed-modern">
              <button className="popup-close-modern" onClick={() => setActivePopup(null)}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
              </button>
              <div className="popup-content-wrapper">
                <div className="popup-media-section">
                  {activePopup.item.mediaType === 'VIDEO' ? <video className="popup-media-content" src={activePopup.item.mediaUrl} autoPlay loop muted playsInline /> : <img className="popup-media-content" src={activePopup.item.mediaUrl} alt="Post" />}
                </div>
                <div className="popup-info-section">
                  <div className="popup-header">
                    <div className="popup-profile">
                      <div className="popup-profile-pic"><img src={connection.profilePictureUrl || ''} alt="Profile" /></div>
                      <span className="popup-username">@{connection.username}</span>
                    </div>
                  </div>
                  <div className="popup-caption-section">
                    {activePopup.item.caption && <div className="popup-caption-content"><span className="caption-username">@{connection.username}</span><span className="caption-text">{activePopup.item.caption}</span></div>}
                  </div>
                  <div className="popup-actions-section">
                    <a href={activePopup.item.permalink} target="_blank" rel="noreferrer" className="popup-instagram-btn"><s-icon type="link" size="small" /> View on Instagram</a>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activePopup.type === 'minimal' && (
            <div className="instagram-popup-minimal">
              <button className="popup-close-minimal" onClick={() => setActivePopup(null)}>×</button>
              <div className={activePopup.item.mediaType === 'VIDEO' ? "popup-video-container" : "popup-image-container"}>
                {activePopup.item.mediaType === 'VIDEO' ? <video className="popup-video-full" src={activePopup.item.mediaUrl} autoPlay loop muted playsInline /> : <img className="popup-image-full" src={activePopup.item.mediaUrl} alt="Post" />}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Banners */}
      {justConnected && <s-banner status="success" dismissible><s-paragraph>Instagram account connected successfully!</s-paragraph></s-banner>}
      {disconnectFetcher.data?.error && <s-banner status="critical" dismissible><s-paragraph>{disconnectFetcher.data.error}</s-paragraph></s-banner>}
      {settingsFetcher.data?.error && <s-banner status="critical" dismissible><s-paragraph>{settingsFetcher.data.error}</s-paragraph></s-banner>}

      {!isConnected && <s-link slot="primary-action" target="_blank" href={handleConnection()}>Connect Instagram Account</s-link>}

      {isConnected && connection ? (
        <>

          <s-stack gap="base large">
            <s-box>
              <s-grid gridTemplateColumns="repeat(12, 1fr)" gap="base" alignItems="stretch">
                {/* CARD 1: ACCOUNT DETAILS */}
                <s-grid-item gridColumn="span 6">
                  <s-box height="100%">
                    <s-section>
                      <s-stack gap="base" vertical>
                        <s-text variant="headingSm" color="subdued">Account</s-text>

                        <s-stack direction="inline" gap="base small" align="center">
                          <img src={connection.profilePictureUrl} alt="Profile" width="56px" height="56px" style={{ borderRadius: '50%', border: '2px solid #e1e3e5' }} />
                          <s-stack gap="extra-tight">
                            <s-text variant="headingMd" weight="bold">@{connection.username}</s-text>
                            <s-badge tone="success">Active Connection</s-badge>
                          </s-stack>
                        </s-stack>
                        <s-stack direction="block" align="center">
                          <s-text variant="bodySm" color="subdued">Connected to Shop</s-text>
                          <s-button variant="plain" size="small" tone="critical" onClick={handleDisconnect} disabled={isDisconnecting}>Disconnect</s-button>
                        </s-stack>
                      </s-stack>
                    </s-section>
                  </s-box>
                </s-grid-item>

                <s-grid-item gridColumn="span 6">
                  <s-box height="100%">
                    <s-section>
                      <s-stack gap="base" vertical>
                        <s-stack direction="block" align="center" style={{ justifyContent: 'space-between', gap: '2px' }}>
                          <s-text variant="headingSm" color="subdued">Media Library</s-text>
                        </s-stack>

                        <s-stack direction="inline" gap="large" align="center" style={{ padding: '10px 0' }}>
                          <s-stack gap="extra-tight">
                            <s-text variant="heading2xl" weight="bold">{connection.imageCount}</s-text>
                            <s-text variant="bodySm" color="subdued">Images</s-text>
                          </s-stack>
                          <div style={{ width: '1px', height: '40px', backgroundColor: '#e1e3e5' }}></div>
                          <s-stack gap="extra-tight">
                            <s-text variant="heading2xl" weight="bold">{connection.videoCount}</s-text>
                            <s-text variant="bodySm" color="subdued">Videos</s-text>
                          </s-stack>
                        </s-stack>

                        <s-stack direction="block" align="center" gap="base small" style={{ marginTop: 'auto', borderTop: '1px solid #f1f2f4', paddingTop: '12px' }}>
                          <s-text variant="bodySm" color="subdued">Last synced {connection.lastSync}</s-text>
                          <s-button variant="plain" size="small" onClick={handleSync} disabled={isSyncing}>{isSyncing ? "Syncing..." : "Sync Now"}</s-button>
                        </s-stack>
                      </s-stack>
                    </s-section>
                  </s-box>
                </s-grid-item>
              </s-grid>
            </s-box>

            {isEmbedActive ? (
              ""
            ) : (
              <s-box>
                <s-section heading="Enable App Embed">
                  <s-stack gap="base small">
                      <s-text>To display reels, you must enable the app embed in your theme editor.</s-text>
                    <s-button variant="primary" onClick={handleEnableApp}>
                      Enable in Theme Editor
                    </s-button>
                  </s-stack>
                </s-section>
              </s-box>
            )}

            {/* --- SETTINGS & PREVIEW (TWO COLUMN) --- */}
            <s-box>
              <s-grid gridTemplateColumns="repeat(12, 1fr)" gap="base" alignItems="start">
                {/* LEFT COLUMN: Settings Form (Spans 8/12) */}
                <s-grid-item gridColumn="span 8">
                  <s-box>
                    <settingsFetcher.Form data-save-bar method="post">
                      <input type="hidden" name="action" value="save_settings" />
                      <s-section heading="Feed Design">
                        <s-stack gap="base">
                          <s-text-field label="Feed title" name="feedTitle" value={previewSettings.feedTitle} onInput={(e) => handleSettingChange('feedTitle', e.target.value)} />

                          <s-stack direction="inline" gap="base" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <s-select label="Show content" name="mediaFilter" value={previewSettings.mediaFilter} onChange={(e) => handleSettingChange('mediaFilter', e.target.value)}>
                              <s-option value="both">Images & Videos</s-option>
                              <s-option value="images">Images only</s-option>
                              <s-option value="videos">Videos only</s-option>
                            </s-select>
                            <s-select label="On post click" name="onPostClick" value={previewSettings.onPostClick} onChange={(e) => handleSettingChange('onPostClick', e.target.value)}>
                              <s-option value="detailed_popup">Open detailed popup</s-option>
                              <s-option value="minimal_popup">Open minimal popup</s-option>
                              <s-option value="go_to_instagram">Go to Instagram</s-option>
                              <s-option value="do_nothing">Do nothing</s-option>
                            </s-select>
                          </s-stack>

                          <s-stack direction="inline" gap="base" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <s-select label="Post spacing" name="postSpacing" value={previewSettings.postSpacing} onChange={(e) => handleSettingChange('postSpacing', e.target.value)}>
                              <s-option value="small">Small</s-option>
                              <s-option value="medium">Medium</s-option>
                              <s-option value="large">Large</s-option>
                              <s-option value="none">No spacing</s-option>
                            </s-select>
                            <s-select label="Rounded corners" name="roundedCorners" value={previewSettings.roundedCorners} onChange={(e) => handleSettingChange('roundedCorners', e.target.value)}>
                              <s-option value="none">No</s-option>
                              <s-option value="small">Small</s-option>
                              <s-option value="medium">Medium</s-option>
                              <s-option value="large">Large</s-option>
                            </s-select>
                          </s-stack>

                          <s-stack direction="inline" gap="base" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <s-select label="Layout" name="layout" value={previewSettings.layout} onChange={(e) => handleSettingChange('layout', e.target.value)}>
                              <s-option value="slider">Slider</s-option>
                              <s-option value="grid">Grid</s-option>
                            </s-select>
                            <s-select label="Format" name="format" value={previewSettings.format} onChange={(e) => handleSettingChange('format', e.target.value)}>
                              <s-option value="3:4">3:4</s-option>
                              <s-option value="4:5">4:5</s-option>
                              <s-option value="1:1">1:1</s-option>
                              <s-option value="9:16">9:16</s-option>
                              <s-option value="4:3">4:3</s-option>
                              <s-option value="circle">Circle</s-option>
                            </s-select>
                          </s-stack>

                          <s-select label="Slider behavior" name="sliderBehavior" value={previewSettings.sliderBehavior} onChange={(e) => handleSettingChange('sliderBehavior', e.target.value)}>
                            <s-option value="static">Static, rotate one post</s-option>
                            <s-option value="auto_rotate">Auto rotate</s-option>
                          </s-select>

                          <s-select label="Responsive layout" name="responsiveLayout" value={previewSettings.responsiveLayout} onChange={(e) => handleSettingChange('responsiveLayout', e.target.value)}>
                            <s-option value="auto">Auto</s-option>
                          </s-select>

                          <s-stack direction="inline" gap="base">
                            <s-button type="submit" variant="primary" disabled={isSavingSettings}>{isSavingSettings ? "Saving..." : "Save Settings"}</s-button>
                          </s-stack>
                        </s-stack>
                      </s-section>
                    </settingsFetcher.Form>
                  </s-box>
                </s-grid-item>

                {/* RIGHT COLUMN: Sticky Preview (Spans 4/12) */}
                <s-grid-item gridColumn="span 4" class="sticky-preview">
                  <s-box>
                    <s-section>
                      <div className="preview-wrapper">
                        {/* Title */}
                        <h2 className="instagram-reels-heading">{previewSettings.feedTitle || "Feed Preview"}</h2>

                        {filteredMedia.length === 0 ? (
                          <p style={{ textAlign: 'center', padding: '20px', color: '#666' }}>No media matches your filter settings.</p>
                        ) : (
                          <>
                            {/* Slider Preview */}
                            {previewSettings.layout === 'slider' && (
                              <div className="instagram-reels-slider">
                                <button className="slider-nav slider-prev" onClick={() => scrollSlider(-1)}>‹</button>
                                <div className="slider-track" ref={sliderTrackRef} style={{ gap: spacingVal }}>
                                  {filteredMedia.slice(0, 10).map((item) => (
                                    <div key={item.id} className="instagram-reel-card" onClick={() => handlePreviewClick(item)}>
                                      <div className="reel-thumbnail" style={{ paddingBottom: ratioVal, borderRadius: isCircle ? '50%' : radiusVal }}>
                                        {item.mediaType === 'VIDEO' ? <video src={item.mediaUrl} muted style={{ borderRadius: isCircle ? '50%' : radiusVal }} /> : <img src={item.mediaUrl} alt="Post" style={{ borderRadius: isCircle ? '50%' : radiusVal }} />}
                                        <div className="reel-overlay">{item.mediaType === 'VIDEO' && <s-icon type="play-circle" color="white" />}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <button className="slider-nav slider-next" onClick={() => scrollSlider(1)}>›</button>
                              </div>
                            )}

                            {/* Grid Preview */}
                            {previewSettings.layout === 'grid' && (
                              <div className="instagram-reels-grid" style={{ gap: spacingVal }}>
                                {filteredMedia.slice(0, 6).map((item) => (
                                  <div key={item.id} className="instagram-reel-card" onClick={() => handlePreviewClick(item)}>
                                    <div className="reel-thumbnail" style={{ paddingBottom: ratioVal, borderRadius: isCircle ? '50%' : radiusVal }}>
                                      {item.mediaType === 'VIDEO' ? <video src={item.mediaUrl} muted style={{ borderRadius: isCircle ? '50%' : radiusVal }} /> : <img src={item.mediaUrl} alt="Post" style={{ borderRadius: isCircle ? '50%' : radiusVal }} />}
                                      <div className="reel-overlay">{item.mediaType === 'VIDEO' && <s-icon type="play-circle" color="white" />}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </s-section>
                  </s-box>
                </s-grid-item>
              </s-grid>
            </s-box>
          </s-stack>
        </>
      ) : (
        <>
          <s-section heading="Your Instagram, On Your Store 🎉">
            <s-paragraph>Seamlessly showcase photos and videos from your Instagram account on your storefront.</s-paragraph>
          </s-section>
          <s-section heading="Get Started">
            <s-paragraph>Connect your Instagram account to start showcasing your content on your store.</s-paragraph>
            <s-stack direction="inline" gap="base"><s-link target="_blank" href={handleConnection()}>Connect Account</s-link></s-stack>
          </s-section>
        </>
      )}
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);