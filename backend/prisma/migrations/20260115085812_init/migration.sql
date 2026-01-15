-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `pointsBalance` BIGINT NOT NULL DEFAULT 10000,
    `clientSeed` VARCHAR(191) NOT NULL DEFAULT 'default-client-seed',
    `referralCode` VARCHAR(191) NOT NULL,
    `referredByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_username_key`(`username`),
    UNIQUE INDEX `User_referralCode_key`(`referralCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Round` (
    `id` VARCHAR(191) NOT NULL,
    `nonce` BIGINT NOT NULL,
    `serverSeedHash` VARCHAR(191) NOT NULL,
    `serverSeed` VARCHAR(191) NULL,
    `crashMultiplier` DECIMAL(10, 2) NOT NULL,
    `phase` ENUM('BETTING', 'FLIGHT', 'CRASH', 'COOLDOWN') NOT NULL,
    `bettingStartAt` DATETIME(3) NOT NULL,
    `bettingEndAt` DATETIME(3) NOT NULL,
    `flightStartAt` DATETIME(3) NULL,
    `crashAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Round_nonce_key`(`nonce`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Bet` (
    `id` VARCHAR(191) NOT NULL,
    `roundId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `slotIndex` INTEGER NOT NULL,
    `amount` BIGINT NOT NULL,
    `autoCashout` DECIMAL(10, 2) NULL,
    `status` ENUM('PLACED', 'ACTIVE', 'CASHED_OUT', 'LOST', 'CANCELED') NOT NULL,
    `cashoutMultiplier` DECIMAL(10, 2) NULL,
    `payout` BIGINT NOT NULL DEFAULT 0,
    `placedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Bet_userId_idx`(`userId`),
    INDEX `Bet_roundId_idx`(`roundId`),
    UNIQUE INDEX `Bet_roundId_userId_slotIndex_key`(`roundId`, `userId`, `slotIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LedgerEntry` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `roundId` VARCHAR(191) NULL,
    `type` ENUM('BET_PLACE', 'BET_CANCEL', 'CASHOUT', 'LOSS', 'BONUS', 'REFERRAL') NOT NULL,
    `delta` BIGINT NOT NULL,
    `balanceAfter` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LedgerEntry_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Bonus` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('DAILY', 'WELCOME') NOT NULL,
    `amount` BIGINT NOT NULL,
    `availableAt` DATETIME(3) NOT NULL,
    `claimedAt` DATETIME(3) NULL,

    INDEX `Bonus_userId_type_availableAt_idx`(`userId`, `type`, `availableAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReferralReward` (
    `id` VARCHAR(191) NOT NULL,
    `referrerUserId` VARCHAR(191) NOT NULL,
    `referredUserId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `rewardPoints` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReferralReward_referrerUserId_idx`(`referrerUserId`),
    INDEX `ReferralReward_referredUserId_idx`(`referredUserId`),
    UNIQUE INDEX `ReferralReward_referrerUserId_referredUserId_key`(`referrerUserId`, `referredUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_referredByUserId_fkey` FOREIGN KEY (`referredByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bet` ADD CONSTRAINT `Bet_roundId_fkey` FOREIGN KEY (`roundId`) REFERENCES `Round`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bet` ADD CONSTRAINT `Bet_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LedgerEntry` ADD CONSTRAINT `LedgerEntry_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bonus` ADD CONSTRAINT `Bonus_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReferralReward` ADD CONSTRAINT `ReferralReward_referrerUserId_fkey` FOREIGN KEY (`referrerUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReferralReward` ADD CONSTRAINT `ReferralReward_referredUserId_fkey` FOREIGN KEY (`referredUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
