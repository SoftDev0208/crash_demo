-- CreateTable
CREATE TABLE `LimboBet` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `amount` BIGINT NOT NULL,
    `payout` DECIMAL(10, 2) NOT NULL,
    `chance` DECIMAL(10, 2) NOT NULL,
    `roll` DECIMAL(10, 2) NOT NULL,
    `win` BOOLEAN NOT NULL,
    `profit` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LimboBet_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LimboBet` ADD CONSTRAINT `LimboBet_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
