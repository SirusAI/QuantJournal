-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "direction" TEXT NOT NULL DEFAULT 'LONG',
    "notes" TEXT,
    "grossPl" DECIMAL,
    "netPl" DECIMAL,
    "volume" INTEGER NOT NULL DEFAULT 0,
    "winLoss" TEXT,
    "mae" DECIMAL,
    "mfe" DECIMAL,
    "initialBalance" DECIMAL DEFAULT 0,
    "isManualPnl" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TradeReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tradeId" TEXT NOT NULL,
    "entryQuality" TEXT,
    "entryNotes" TEXT,
    "exitQuality" TEXT,
    "exitNotes" TEXT,
    "psychologyTags" TEXT,
    "psychologyNotes" TEXT,
    "riskQuality" TEXT,
    "riskNotes" TEXT,
    "lessonNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TradeReview_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyJournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryDate" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Execution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tradeId" TEXT NOT NULL,
    "time" DATETIME NOT NULL,
    "side" TEXT NOT NULL,
    "price" DECIMAL NOT NULL,
    "quantity" INTEGER NOT NULL,
    "fee" DECIMAL NOT NULL DEFAULT 0,
    "route" TEXT,
    "broker" TEXT,
    "type" TEXT,
    "pnl" DECIMAL,
    CONSTRAINT "Execution_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "CoachingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "advice" TEXT NOT NULL,
    "stats" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DailyReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cacheKey" TEXT NOT NULL DEFAULT '',
    "reviewDate" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "modelName" TEXT,
    "analysisVersion" TEXT NOT NULL DEFAULT 'v1',
    "tradeCount" INTEGER NOT NULL DEFAULT 0,
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "renderedReport" TEXT NOT NULL,
    "reviewJson" TEXT NOT NULL,
    "sourceSnapshot" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EdgeAnalysisSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scopeKey" TEXT NOT NULL,
    "scopeJson" TEXT NOT NULL,
    "sourceFingerprint" TEXT NOT NULL,
    "analysisVersion" TEXT NOT NULL,
    "connectionKey" TEXT NOT NULL DEFAULT '',
    "modelId" TEXT NOT NULL,
    "modelName" TEXT,
    "summaryJson" TEXT NOT NULL,
    "evidenceJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "_TagToTrade" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_TagToTrade_A_fkey" FOREIGN KEY ("A") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_TagToTrade_B_fkey" FOREIGN KEY ("B") REFERENCES "Trade" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Trade_date_idx" ON "Trade"("date");

-- CreateIndex
CREATE UNIQUE INDEX "TradeReview_tradeId_key" ON "TradeReview"("tradeId");

-- CreateIndex
CREATE INDEX "TradeReview_tradeId_idx" ON "TradeReview"("tradeId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyJournalEntry_entryDate_key" ON "DailyJournalEntry"("entryDate");

-- CreateIndex
CREATE INDEX "DailyJournalEntry_entryDate_idx" ON "DailyJournalEntry"("entryDate");

-- CreateIndex
CREATE INDEX "Execution_tradeId_time_idx" ON "Execution"("tradeId", "time");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReview_reviewDate_key" ON "DailyReview"("reviewDate");

-- CreateIndex
CREATE INDEX "EdgeAnalysisSession_cache_idx" ON "EdgeAnalysisSession"("scopeKey", "sourceFingerprint", "analysisVersion", "modelId", "createdAt");

-- CreateIndex
CREATE INDEX "EdgeAnalysisSession_createdAt_idx" ON "EdgeAnalysisSession"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "_TagToTrade_AB_unique" ON "_TagToTrade"("A", "B");

-- CreateIndex
CREATE INDEX "_TagToTrade_B_index" ON "_TagToTrade"("B");

