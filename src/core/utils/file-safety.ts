import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';

export interface BackupInfo {
  originalPath: string;
  backupPath: string;
  checksum: string;
  timestamp: string;
}

export class FileSafetyManager {
  private backups: Map<string, BackupInfo> = new Map();
  private backupDir: string;

  constructor(projectRoot: string) {
    this.backupDir = path.join(projectRoot, '.vibeflow', 'backups', new Date().toISOString().replace(/:/g, '-'));
  }

  /**
   * Backup a file before modification
   */
  async backupFile(filePath: string): Promise<BackupInfo> {
    try {
      // Ensure backup directory exists
      await fs.mkdir(this.backupDir, { recursive: true });

      // Read original file
      const content = await fs.readFile(filePath, 'utf8');
      const checksum = this.calculateChecksum(content);

      // Create backup path
      const relativePath = path.relative(process.cwd(), filePath);
      const backupPath = path.join(this.backupDir, relativePath);
      const backupFileDir = path.dirname(backupPath);

      // Ensure backup subdirectory exists
      await fs.mkdir(backupFileDir, { recursive: true });

      // Write backup
      await fs.writeFile(backupPath, content);

      const backupInfo: BackupInfo = {
        originalPath: filePath,
        backupPath,
        checksum,
        timestamp: new Date().toISOString()
      };

      this.backups.set(filePath, backupInfo);
      console.log(`   📦 Backed up: ${relativePath}`);

      return backupInfo;
    } catch (error) {
      console.warn(`   ⚠️  Could not backup ${filePath}: ${error}`);
      throw error;
    }
  }

  /**
   * Restore a file from backup
   */
  async restoreFile(filePath: string): Promise<void> {
    const backup = this.backups.get(filePath);
    if (!backup) {
      throw new Error(`No backup found for ${filePath}`);
    }

    const backupContent = await fs.readFile(backup.backupPath, 'utf8');
    await fs.writeFile(filePath, backupContent);
    console.log(`   ✅ Restored: ${filePath}`);
  }

  /**
   * Restore all backed up files
   */
  async restoreAll(): Promise<void> {
    console.log('🔄 Restoring all files from backup...');
    for (const [filePath, _] of this.backups) {
      await this.restoreFile(filePath);
    }
    console.log(`✅ Restored ${this.backups.size} files`);
  }

  /**
   * Create a safe write operation with automatic backup
   */
  async safeWrite(filePath: string, content: string): Promise<void> {
    // Check if file exists
    const exists = await fs.access(filePath).then(() => true).catch(() => false);
    
    if (exists) {
      // Backup existing file
      await this.backupFile(filePath);
    }

    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Write new content
    await fs.writeFile(filePath, content);
  }

  /**
   * Get backup summary
   */
  getBackupSummary(): { count: number; location: string } {
    return {
      count: this.backups.size,
      location: this.backupDir
    };
  }

  private calculateChecksum(content: string): string {
    return createHash('md5').update(content).digest('hex');
  }
}