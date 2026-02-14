-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramConnection" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "profilePictureUrl" TEXT,
    "followersCount" INTEGER,
    "mediaCount" INTEGER,
    "connectedAt" TEXT NOT NULL,
    "tokenExpiresAt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramMedia" (
    "id" TEXT NOT NULL,
    "instagramConnectionId" TEXT NOT NULL,
    "instagramMediaId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "permalink" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "mediaUrl" TEXT NOT NULL,
    "caption" TEXT,
    "timestamp" TEXT NOT NULL,
    "likeCount" INTEGER,
    "commentsCount" INTEGER,
    "viewsCount" INTEGER,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedSettings" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "feedTitle" TEXT NOT NULL DEFAULT 'Amazing Feed',
    "mediaFilter" TEXT NOT NULL DEFAULT 'both',
    "onPostClick" TEXT NOT NULL DEFAULT 'go_to_instagram',
    "postSpacing" TEXT NOT NULL DEFAULT 'small',
    "roundedCorners" TEXT NOT NULL DEFAULT 'none',
    "layout" TEXT NOT NULL DEFAULT 'slider',
    "format" TEXT NOT NULL DEFAULT '3:4',
    "responsiveLayout" TEXT NOT NULL DEFAULT 'auto',
    "sliderBehavior" TEXT NOT NULL DEFAULT 'static',
    "gridColumns" INTEGER DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "instagramConnectionId" TEXT NOT NULL,

    CONSTRAINT "FeedSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstagramConnection_shop_key" ON "InstagramConnection"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramMedia_instagramMediaId_key" ON "InstagramMedia"("instagramMediaId");

-- CreateIndex
CREATE INDEX "InstagramMedia_instagramConnectionId_idx" ON "InstagramMedia"("instagramConnectionId");

-- CreateIndex
CREATE INDEX "InstagramMedia_displayOrder_idx" ON "InstagramMedia"("displayOrder");

-- CreateIndex
CREATE INDEX "InstagramMedia_mediaType_idx" ON "InstagramMedia"("mediaType");

-- CreateIndex
CREATE UNIQUE INDEX "FeedSettings_shop_key" ON "FeedSettings"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "FeedSettings_instagramConnectionId_key" ON "FeedSettings"("instagramConnectionId");

-- CreateIndex
CREATE INDEX "FeedSettings_shop_idx" ON "FeedSettings"("shop");

-- AddForeignKey
ALTER TABLE "InstagramMedia" ADD CONSTRAINT "InstagramMedia_instagramConnectionId_fkey" FOREIGN KEY ("instagramConnectionId") REFERENCES "InstagramConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedSettings" ADD CONSTRAINT "FeedSettings_instagramConnectionId_fkey" FOREIGN KEY ("instagramConnectionId") REFERENCES "InstagramConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
