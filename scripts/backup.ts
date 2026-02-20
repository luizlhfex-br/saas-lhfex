#!/usr/bin/env tsx

/**
 * PostgreSQL Backup to S3
 * 
 * Performs pg_dump and uploads to MinIO/S3
 * Run manually or via cron job
 * 
 * Environment Variables:
 * - DATABASE_URL: PostgreSQL connection string
 * - S3_ENDPOINT: MinIO/S3 endpoint (default: http://localhost:9000)
 * - S3_BUCKET: Bucket name (default: lhfex-backups)
 * - S3_ACCESS_KEY: S3 access key
 * - S3_SECRET_KEY: S3 secret key
 * - BACKUP_RETENTION_DAYS: Days to keep backups (default: 30)
 */

import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { exec } from "child_process";
import { promisify } from "util";
import { createReadStream, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const execAsync = promisify(exec);

const S3_ENDPOINT = process.env.S3_ENDPOINT || "http://localhost:9000";
const S3_BUCKET = process.env.S3_BUCKET || "lhfex-backups";
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY;
const BACKUP_RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || "30", 10);

interface BackupResult {
  success: boolean;
  filename?: string;
  size?: number;
  duration?: number;
  error?: string;
}

async function createBackup(): Promise<BackupResult> {
  const startTime = Date.now();
  
  if (!process.env.DATABASE_URL) {
    return { success: false, error: "DATABASE_URL not configured" };
  }

  if (!S3_ACCESS_KEY || !S3_SECRET_KEY) {
    return { success: false, error: "S3 credentials not configured" };
  }

  // Parse DATABASE_URL
  const dbUrl = new URL(process.env.DATABASE_URL);
  const dbHost = dbUrl.hostname;
  const dbPort = dbUrl.port || "5432";
  const dbName = dbUrl.pathname.slice(1);
  const dbUser = dbUrl.username;
  const dbPassword = dbUrl.password;

  // Generate backup filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${timestamp}.sql.gz`;
  const tempFilePath = join(tmpdir(), filename);

  console.log(`🗄️  Starting PostgreSQL backup...`);
  console.log(`📁 Database: ${dbName}`);
  console.log(`📦 Backup file: ${filename}`);

  try {
    // Run pg_dump with compression
    const pgDumpCmd = `PGPASSWORD="${dbPassword}" pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} --no-owner --no-acl --clean --if-exists | gzip > "${tempFilePath}"`;
    
    await execAsync(pgDumpCmd, { maxBuffer: 100 * 1024 * 1024 }); // 100MB buffer

    if (!existsSync(tempFilePath)) {
      return { success: false, error: "Backup file not created" };
    }

    console.log(`✅ Backup created: ${tempFilePath}`);

    // Upload to S3/MinIO
    const s3Client = new S3Client({
      endpoint: S3_ENDPOINT,
      region: "us-east-1",
      credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY,
      },
      forcePathStyle: true, // Required for MinIO
    });

    const fileStream = createReadStream(tempFilePath);
    const uploadCommand = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: `postgresql/${filename}`,
      Body: fileStream,
      ContentType: "application/gzip",
      Metadata: {
        database: dbName,
        timestamp: new Date().toISOString(),
      },
    });

    await s3Client.send(uploadCommand);
    console.log(`☁️  Uploaded to S3: ${S3_BUCKET}/postgresql/${filename}`);

    // Get file size
    const { statSync } = await import("fs");
    const fileSize = statSync(tempFilePath).size;

    // Cleanup temp file
    unlinkSync(tempFilePath);
    console.log(`🗑️  Cleaned up temp file`);

    const duration = Date.now() - startTime;
    console.log(`✨ Backup completed in ${duration}ms (${(fileSize / 1024 / 1024).toFixed(2)}MB)`);

    // Cleanup old backups
    await cleanupOldBackups(s3Client);

    return {
      success: true,
      filename,
      size: fileSize,
      duration,
    };
  } catch (error) {
    console.error("❌ Backup failed:", error);
    
    // Cleanup temp file on error
    if (existsSync(tempFilePath)) {
      unlinkSync(tempFilePath);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function cleanupOldBackups(s3Client: S3Client): Promise<void> {
  console.log(`🧹 Cleaning up backups older than ${BACKUP_RETENTION_DAYS} days...`);

  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: "postgresql/",
    });

    const response = await s3Client.send(listCommand);
    if (!response.Contents) {
      console.log("No backups found");
      return;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - BACKUP_RETENTION_DAYS);

    const oldBackups = response.Contents.filter((obj) => {
      return obj.LastModified && obj.LastModified < cutoffDate;
    });

    if (oldBackups.length === 0) {
      console.log("No old backups to delete");
      return;
    }

    console.log(`Found ${oldBackups.length} old backups to delete`);

    for (const backup of oldBackups) {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: backup.Key,
      });
      await s3Client.send(deleteCommand);
      console.log(`🗑️  Deleted: ${backup.Key}`);
    }

    console.log(`✅ Cleanup completed`);
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
  }
}

// Run backup if executed directly
if (require.main === module) {
  createBackup()
    .then((result) => {
      if (result.success) {
        console.log("\n✅ Backup completed successfully");
        process.exit(0);
      } else {
        console.error("\n❌ Backup failed:", result.error);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error("\n❌ Unexpected error:", error);
      process.exit(1);
    });
}

export { createBackup, cleanupOldBackups };
