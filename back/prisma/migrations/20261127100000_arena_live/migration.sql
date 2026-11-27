-- AlterTable
ALTER TABLE "ArenaSession" ADD COLUMN     "currentIndex" INTEGER NOT NULL DEFAULT -1,
ADD COLUMN     "questionStartedAt" TIMESTAMP(3),
ADD COLUMN     "revealed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "timeLimitSec" INTEGER NOT NULL DEFAULT 240;

-- CreateTable
CREATE TABLE "ArenaParticipant" (
    "arenaId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaParticipant_pkey" PRIMARY KEY ("arenaId","userId")
);

-- CreateIndex
CREATE INDEX "ArenaParticipant_userId_idx" ON "ArenaParticipant"("userId");

-- AddForeignKey
ALTER TABLE "ArenaParticipant" ADD CONSTRAINT "ArenaParticipant_arenaId_fkey" FOREIGN KEY ("arenaId") REFERENCES "ArenaSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaParticipant" ADD CONSTRAINT "ArenaParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

