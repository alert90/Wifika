-- CreateTable
CREATE TABLE `agent_sales` (
    `id` VARCHAR(191) NOT NULL,
    `agentId` VARCHAR(191) NOT NULL,
    `voucherCode` VARCHAR(191) NOT NULL,
    `profileName` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `agent_sales_agentId_idx`(`agentId`),
    INDEX `agent_sales_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agents` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `agents_phone_key`(`phone`),
    INDEX `agents_phone_idx`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `companies` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `logo` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `adminPhone` VARCHAR(191) NULL,
    `baseUrl` VARCHAR(191) NULL DEFAULT 'http://localhost:3000',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hotspot_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sharedUsers` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `agentAccess` BOOLEAN NOT NULL DEFAULT true,
    `costPrice` INTEGER NOT NULL,
    `eVoucherAccess` BOOLEAN NOT NULL DEFAULT true,
    `groupProfile` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `resellerFee` INTEGER NOT NULL DEFAULT 0,
    `sellingPrice` INTEGER NOT NULL,
    `speed` VARCHAR(191) NOT NULL,
    `validityUnit` ENUM('MINUTES', 'HOURS', 'DAYS', 'MONTHS') NOT NULL,
    `validityValue` INTEGER NOT NULL,

    UNIQUE INDEX `hotspot_profiles_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hotspot_vouchers` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `profileId` VARCHAR(191) NOT NULL,
    `status` ENUM('WAITING', 'ACTIVE', 'EXPIRED') NOT NULL DEFAULT 'WAITING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `batchCode` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NULL,
    `firstLoginAt` DATETIME(3) NULL,
    `lastUsedBy` VARCHAR(191) NULL,
    `orderId` VARCHAR(191) NULL,

    UNIQUE INDEX `hotspot_vouchers_code_key`(`code`),
    INDEX `hotspot_vouchers_batchCode_idx`(`batchCode`),
    INDEX `hotspot_vouchers_orderId_idx`(`orderId`),
    INDEX `hotspot_vouchers_profileId_idx`(`profileId`),
    INDEX `hotspot_vouchers_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoices` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `amount` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'OVERDUE', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `dueDate` DATETIME(3) NOT NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `paymentLink` VARCHAR(191) NULL,
    `paymentToken` VARCHAR(191) NULL,
    `customerName` VARCHAR(191) NULL,
    `customerPhone` VARCHAR(191) NULL,
    `customerUsername` VARCHAR(191) NULL,
    `sentReminders` TEXT NULL,

    UNIQUE INDEX `invoices_invoiceNumber_key`(`invoiceNumber`),
    UNIQUE INDEX `invoices_paymentToken_key`(`paymentToken`),
    INDEX `invoices_userId_idx`(`userId`),
    INDEX `invoices_status_idx`(`status`),
    INDEX `invoices_dueDate_idx`(`dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nas` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nasname` VARCHAR(191) NOT NULL,
    `shortname` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'mikrotik',
    `ipAddress` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `port` INTEGER NOT NULL DEFAULT 8728,
    `apiPort` INTEGER NOT NULL DEFAULT 8729,
    `secret` VARCHAR(191) NOT NULL DEFAULT 'secret123',
    `ports` INTEGER NOT NULL DEFAULT 1812,
    `server` VARCHAR(191) NULL,
    `community` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `vpnClientId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `nas_nasname_key`(`nasname`),
    UNIQUE INDEX `nas_vpnClientId_key`(`vpnClientId`),
    INDEX `nas_nasname_idx`(`nasname`),
    INDEX `nas_shortname_idx`(`shortname`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_gateways` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `midtransClientKey` VARCHAR(191) NULL,
    `midtransEnvironment` VARCHAR(191) NOT NULL DEFAULT 'sandbox',
    `midtransServerKey` VARCHAR(191) NULL,
    `provider` VARCHAR(191) NOT NULL,
    `xenditApiKey` VARCHAR(191) NULL,
    `xenditEnvironment` VARCHAR(191) NOT NULL DEFAULT 'sandbox',
    `xenditWebhookToken` VARCHAR(191) NULL,
    `duitkuMerchantCode` VARCHAR(191) NULL,
    `duitkuApiKey` VARCHAR(191) NULL,
    `duitkuEnvironment` VARCHAR(191) NOT NULL DEFAULT 'sandbox',
    `mpesaConsumerKey` VARCHAR(191) NULL,
    `mpesaConsumerSecret` VARCHAR(191) NULL,
    `mpesaPasskey` VARCHAR(191) NULL,
    `mpesaShortcode` VARCHAR(191) NULL,
    `mpesaEnvironment` VARCHAR(191) NOT NULL DEFAULT 'sandbox',
    `selcomApiKey` VARCHAR(191) NULL,
    `selcomSecretKey` VARCHAR(191) NULL,
    `selcomVendorName` VARCHAR(191) NULL,
    `selcomEnvironment` VARCHAR(191) NOT NULL DEFAULT 'sandbox',
    `pesapalMerchantId` VARCHAR(191) NULL,
    `pesapalApiKey` VARCHAR(191) NULL,
    `pesapalSecretKey` VARCHAR(191) NULL,
    `pesapalEnvironment` VARCHAR(191) NOT NULL DEFAULT 'sandbox',

    UNIQUE INDEX `payment_gateways_provider_key`(`provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `method` VARCHAR(191) NOT NULL,
    `gatewayId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL,
    `paidAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payments_gatewayId_idx`(`gatewayId`),
    INDEX `payments_invoiceId_idx`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `registration_requests` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `address` VARCHAR(191) NOT NULL,
    `profileId` VARCHAR(191) NOT NULL,
    `installationFee` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `rejectionReason` TEXT NULL,
    `invoiceId` VARCHAR(191) NULL,
    `pppoeUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `registration_requests_phone_key`(`phone`),
    UNIQUE INDEX `registration_requests_invoiceId_key`(`invoiceId`),
    UNIQUE INDEX `registration_requests_pppoeUserId_key`(`pppoeUserId`),
    INDEX `registration_requests_profileId_idx`(`profileId`),
    INDEX `registration_requests_status_idx`(`status`),
    INDEX `registration_requests_phone_idx`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pppoe_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `price` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `description` VARCHAR(191) NULL,
    `downloadSpeed` INTEGER NOT NULL,
    `groupName` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastSyncAt` DATETIME(3) NULL,
    `syncedToRadius` BOOLEAN NOT NULL DEFAULT false,
    `uploadSpeed` INTEGER NOT NULL,
    `validityUnit` ENUM('MINUTES', 'HOURS', 'DAYS', 'MONTHS') NOT NULL DEFAULT 'MONTHS',
    `validityValue` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `pppoe_profiles_name_key`(`name`),
    UNIQUE INDEX `pppoe_profiles_groupName_key`(`groupName`),
    INDEX `pppoe_profiles_groupName_idx`(`groupName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pppoe_users` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `profileId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `ipAddress` VARCHAR(191) NULL,
    `macAddress` VARCHAR(191) NULL,
    `comment` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `expiredAt` DATETIME(3) NULL,
    `address` VARCHAR(191) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `email` VARCHAR(191) NULL,
    `lastSyncAt` DATETIME(3) NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `syncedToRadius` BOOLEAN NOT NULL DEFAULT false,
    `routerId` VARCHAR(191) NULL,

    UNIQUE INDEX `pppoe_users_username_key`(`username`),
    INDEX `pppoe_users_profileId_idx`(`profileId`),
    INDEX `pppoe_users_routerId_idx`(`routerId`),
    INDEX `pppoe_users_status_idx`(`status`),
    INDEX `pppoe_users_username_idx`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `radacct` (
    `radacctid` BIGINT NOT NULL AUTO_INCREMENT,
    `acctsessionid` VARCHAR(64) NOT NULL,
    `acctuniqueid` VARCHAR(32) NOT NULL,
    `username` VARCHAR(64) NOT NULL,
    `groupname` VARCHAR(64) NOT NULL DEFAULT '',
    `realm` VARCHAR(64) NULL,
    `nasipaddress` VARCHAR(15) NOT NULL,
    `nasportid` VARCHAR(32) NULL,
    `nasporttype` VARCHAR(32) NULL,
    `acctstarttime` DATETIME(3) NULL,
    `acctupdatetime` DATETIME(3) NULL,
    `acctstoptime` DATETIME(3) NULL,
    `acctinterval` INTEGER NULL,
    `acctsessiontime` INTEGER NULL,
    `acctauthentic` VARCHAR(32) NULL,
    `connectinfo_start` VARCHAR(50) NULL,
    `connectinfo_stop` VARCHAR(50) NULL,
    `acctinputoctets` BIGINT NULL,
    `acctoutputoctets` BIGINT NULL,
    `calledstationid` VARCHAR(50) NOT NULL,
    `callingstationid` VARCHAR(50) NOT NULL,
    `acctterminatecause` VARCHAR(32) NOT NULL,
    `servicetype` VARCHAR(32) NULL,
    `framedprotocol` VARCHAR(32) NULL,
    `framedipaddress` VARCHAR(15) NOT NULL,
    `framedipv6address` VARCHAR(45) NOT NULL DEFAULT '',
    `framedipv6prefix` VARCHAR(45) NOT NULL DEFAULT '',
    `framedinterfaceid` VARCHAR(44) NOT NULL DEFAULT '',
    `delegatedipv6prefix` VARCHAR(45) NOT NULL DEFAULT '',

    UNIQUE INDEX `radacct_acctuniqueid_key`(`acctuniqueid`),
    INDEX `radacct_acctinterval_idx`(`acctinterval`),
    INDEX `radacct_acctsessionid_idx`(`acctsessionid`),
    INDEX `radacct_acctsessiontime_idx`(`acctsessiontime`),
    INDEX `radacct_acctstarttime_idx`(`acctstarttime`),
    INDEX `radacct_acctstoptime_idx`(`acctstoptime`),
    INDEX `radacct_framedipaddress_idx`(`framedipaddress`),
    INDEX `radacct_nasipaddress_idx`(`nasipaddress`),
    INDEX `radacct_username_idx`(`username`),
    PRIMARY KEY (`radacctid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `radcheck` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(64) NOT NULL,
    `attribute` VARCHAR(64) NOT NULL,
    `op` CHAR(2) NOT NULL DEFAULT ':=',
    `value` VARCHAR(253) NOT NULL,

    INDEX `radcheck_username_idx`(`username`),
    UNIQUE INDEX `radcheck_username_attribute_key`(`username`, `attribute`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `radgroupcheck` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `groupname` VARCHAR(64) NOT NULL,
    `attribute` VARCHAR(64) NOT NULL,
    `op` CHAR(2) NOT NULL DEFAULT '==',
    `value` VARCHAR(253) NOT NULL,

    INDEX `radgroupcheck_groupname_idx`(`groupname`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `radgroupreply` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `groupname` VARCHAR(64) NOT NULL,
    `attribute` VARCHAR(64) NOT NULL,
    `op` CHAR(2) NOT NULL DEFAULT ':=',
    `value` VARCHAR(253) NOT NULL,

    INDEX `radgroupreply_groupname_idx`(`groupname`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `radpostauth` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(64) NOT NULL,
    `pass` VARCHAR(64) NOT NULL,
    `reply` VARCHAR(32) NOT NULL,
    `authdate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `radpostauth_authdate_idx`(`authdate`),
    INDEX `radpostauth_username_idx`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `radreply` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(64) NOT NULL,
    `attribute` VARCHAR(64) NOT NULL,
    `op` CHAR(2) NOT NULL DEFAULT '=',
    `value` VARCHAR(253) NOT NULL,

    INDEX `radreply_username_idx`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `radusergroup` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(64) NOT NULL,
    `groupname` VARCHAR(64) NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 1,

    INDEX `radusergroup_groupname_idx`(`groupname`),
    INDEX `radusergroup_username_idx`(`username`),
    UNIQUE INDEX `radusergroup_username_groupname_key`(`username`, `groupname`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `nasIpAddress` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `startTime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `stopTime` DATETIME(3) NULL,
    `uploadBytes` BIGINT NOT NULL DEFAULT 0,
    `downloadBytes` BIGINT NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sessions_sessionId_key`(`sessionId`),
    INDEX `sessions_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'AGENT', 'USER') NOT NULL DEFAULT 'ADMIN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `voucher_orders` (
    `id` VARCHAR(191) NOT NULL,
    `orderNumber` VARCHAR(191) NOT NULL,
    `profileId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `customerName` VARCHAR(191) NOT NULL,
    `customerPhone` VARCHAR(191) NOT NULL,
    `customerEmail` VARCHAR(191) NULL,
    `totalAmount` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `paymentToken` VARCHAR(191) NULL,
    `paymentLink` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `voucher_orders_orderNumber_key`(`orderNumber`),
    UNIQUE INDEX `voucher_orders_paymentToken_key`(`paymentToken`),
    INDEX `voucher_orders_orderNumber_idx`(`orderNumber`),
    INDEX `voucher_orders_profileId_idx`(`profileId`),
    INDEX `voucher_orders_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `voucher_templates` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `htmlTemplate` TEXT NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vpn_clients` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `vpnIp` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `vpnType` VARCHAR(191) NOT NULL DEFAULT 'L2TP',
    `description` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `isRadiusServer` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `vpn_clients_vpnIp_key`(`vpnIp`),
    UNIQUE INDEX `vpn_clients_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vpn_servers` (
    `id` VARCHAR(191) NOT NULL,
    `host` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `port` INTEGER NOT NULL DEFAULT 8728,
    `subnet` VARCHAR(191) NOT NULL DEFAULT '10.20.30.0/24',
    `l2tpEnabled` BOOLEAN NOT NULL DEFAULT false,
    `sstpEnabled` BOOLEAN NOT NULL DEFAULT false,
    `pptpEnabled` BOOLEAN NOT NULL DEFAULT false,
    `isConfigured` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webhook_logs` (
    `id` VARCHAR(191) NOT NULL,
    `gateway` VARCHAR(191) NOT NULL,
    `gatewayId` VARCHAR(191) NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `transactionId` VARCHAR(191) NULL,
    `amount` INTEGER NULL,
    `payload` TEXT NULL,
    `response` TEXT NULL,
    `success` BOOLEAN NOT NULL DEFAULT true,
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `webhook_logs_createdAt_idx`(`createdAt`),
    INDEX `webhook_logs_gatewayId_idx`(`gatewayId`),
    INDEX `webhook_logs_gateway_idx`(`gateway`),
    INDEX `webhook_logs_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `whatsapp_history` (
    `id` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `response` TEXT NULL,
    `providerName` VARCHAR(191) NULL,
    `providerType` VARCHAR(191) NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `whatsapp_providers` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `apiKey` VARCHAR(191) NOT NULL,
    `apiUrl` VARCHAR(191) NOT NULL,
    `senderNumber` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `whatsapp_templates` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `whatsapp_templates_type_key`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `whatsapp_reminder_settings` (
    `id` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `reminderDays` TEXT NOT NULL,
    `reminderTime` VARCHAR(191) NOT NULL DEFAULT '09:00',
    `otpEnabled` BOOLEAN NOT NULL DEFAULT true,
    `otpExpiry` INTEGER NOT NULL DEFAULT 5,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `otpCode` VARCHAR(191) NULL,
    `otpExpiry` DATETIME(3) NULL,
    `token` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NULL,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `customer_sessions_token_key`(`token`),
    INDEX `customer_sessions_phone_idx`(`phone`),
    INDEX `customer_sessions_token_idx`(`token`),
    INDEX `customer_sessions_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transaction_categories` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('INCOME', 'EXPENSE') NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `transaction_categories_name_key`(`name`),
    INDEX `transaction_categories_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transactions` (
    `id` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `type` ENUM('INCOME', 'EXPENSE') NOT NULL,
    `amount` INTEGER NOT NULL,
    `description` TEXT NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reference` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `transactions_categoryId_idx`(`categoryId`),
    INDEX `transactions_type_idx`(`type`),
    INDEX `transactions_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cron_history` (
    `id` VARCHAR(191) NOT NULL,
    `jobType` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `duration` INTEGER NULL,
    `result` TEXT NULL,
    `error` TEXT NULL,

    INDEX `cron_history_jobType_idx`(`jobType`),
    INDEX `cron_history_status_idx`(`status`),
    INDEX `cron_history_startedAt_idx`(`startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `network_servers` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(191) NOT NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `routerId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `network_servers_routerId_idx`(`routerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `network_olts` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(191) NOT NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `followRoad` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `network_olt_routers` (
    `id` VARCHAR(191) NOT NULL,
    `oltId` VARCHAR(191) NOT NULL,
    `routerId` VARCHAR(191) NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `network_olt_routers_oltId_idx`(`oltId`),
    INDEX `network_olt_routers_routerId_idx`(`routerId`),
    UNIQUE INDEX `network_olt_routers_oltId_routerId_key`(`oltId`, `routerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `network_odcs` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `followRoad` BOOLEAN NOT NULL DEFAULT false,
    `oltId` VARCHAR(191) NOT NULL,
    `ponPort` INTEGER NOT NULL,
    `portCount` INTEGER NOT NULL DEFAULT 8,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `network_odcs_oltId_idx`(`oltId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `network_odps` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `followRoad` BOOLEAN NOT NULL DEFAULT false,
    `odcId` VARCHAR(191) NULL,
    `oltId` VARCHAR(191) NOT NULL,
    `ponPort` INTEGER NOT NULL,
    `portCount` INTEGER NOT NULL DEFAULT 8,
    `parentOdpId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `network_odps_odcId_idx`(`odcId`),
    INDEX `network_odps_oltId_idx`(`oltId`),
    INDEX `network_odps_parentOdpId_idx`(`parentOdpId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `odp_customer_assignments` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `odpId` VARCHAR(191) NOT NULL,
    `portNumber` INTEGER NOT NULL,
    `distance` DOUBLE NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `odp_customer_assignments_customerId_key`(`customerId`),
    INDEX `odp_customer_assignments_customerId_idx`(`customerId`),
    INDEX `odp_customer_assignments_odpId_idx`(`odpId`),
    UNIQUE INDEX `odp_customer_assignments_odpId_portNumber_key`(`odpId`, `portNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `map_settings` (
    `id` VARCHAR(191) NOT NULL,
    `osrmApiUrl` VARCHAR(191) NOT NULL DEFAULT 'http://router.project-osrm.org',
    `followRoad` BOOLEAN NOT NULL DEFAULT false,
    `defaultLat` DOUBLE NOT NULL DEFAULT -7.071273611475302,
    `defaultLon` DOUBLE NOT NULL DEFAULT 108.04475042198051,
    `defaultZoom` INTEGER NOT NULL DEFAULT 13,
    `mapTheme` VARCHAR(191) NOT NULL DEFAULT 'default',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `genieacs_settings` (
    `id` VARCHAR(191) NOT NULL,
    `host` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `link` VARCHAR(191) NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_isRead_idx`(`isRead`),
    INDEX `notifications_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_users` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `password` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'FINANCE', 'CUSTOMER_SERVICE', 'TECHNICIAN', 'MARKETING', 'VIEWER') NOT NULL DEFAULT 'CUSTOMER_SERVICE',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `phone` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `lastLogin` DATETIME(3) NULL,

    UNIQUE INDEX `admin_users_username_key`(`username`),
    UNIQUE INDEX `admin_users_email_key`(`email`),
    INDEX `admin_users_username_idx`(`username`),
    INDEX `admin_users_email_idx`(`email`),
    INDEX `admin_users_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `permissions_key_key`(`key`),
    INDEX `permissions_category_idx`(`category`),
    INDEX `permissions_key_idx`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `id` VARCHAR(191) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'FINANCE', 'CUSTOMER_SERVICE', 'TECHNICIAN', 'MARKETING', 'VIEWER') NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `role_permissions_role_idx`(`role`),
    INDEX `role_permissions_permissionId_idx`(`permissionId`),
    UNIQUE INDEX `role_permissions_role_permissionId_key`(`role`, `permissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_permissions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_permissions_userId_idx`(`userId`),
    INDEX `user_permissions_permissionId_idx`(`permissionId`),
    UNIQUE INDEX `user_permissions_userId_permissionId_key`(`userId`, `permissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `backup_history` (
    `id` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `filepath` VARCHAR(191) NULL,
    `filesize` BIGINT NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `method` VARCHAR(191) NOT NULL DEFAULT 'local',
    `error` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `backup_history_createdAt_idx`(`createdAt`),
    INDEX `backup_history_type_idx`(`type`),
    INDEX `backup_history_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `telegram_backup_settings` (
    `id` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `botToken` VARCHAR(191) NOT NULL,
    `chatId` VARCHAR(191) NOT NULL,
    `backupTopicId` VARCHAR(191) NOT NULL,
    `healthTopicId` VARCHAR(191) NULL,
    `schedule` VARCHAR(191) NOT NULL DEFAULT 'daily',
    `scheduleTime` VARCHAR(191) NOT NULL DEFAULT '02:00',
    `keepLastN` INTEGER NOT NULL DEFAULT 7,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
