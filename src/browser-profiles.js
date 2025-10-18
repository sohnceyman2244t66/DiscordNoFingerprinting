// Complete Browser Profile Manager
// Manages persistent browser profiles with all data (cookies, passwords, extensions, etc.)

const Store = require('electron-store');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const { app } = require('electron');

class BrowserProfileManager {
    constructor() {
        // Store for profile metadata
        this.store = new Store({ name: 'browser-profiles' });

        // Base directory for all browser profiles
        this.profilesBaseDir = path.join(app.getPath('userData'), 'BrowserProfiles');

        // Ensure profiles directory exists
        this.initializeProfilesDirectory();

        // Current active profile
        this.currentProfile = null;
    }

    async initializeProfilesDirectory() {
        try {
            await fs.mkdir(this.profilesBaseDir, { recursive: true });
            console.log('Browser profiles directory initialized:', this.profilesBaseDir);
        } catch (error) {
            console.error('Failed to create profiles directory:', error);
        }
    }

    // Create a new browser profile with hardware fingerprint
    async createProfile(name, hardwareProfile, blockWebRTC = true) {
        const profileId = crypto.randomBytes(8).toString('hex');
        const profileDir = path.join(this.profilesBaseDir, `profile-${profileId}`);

        // Create profile directory structure
        await fs.mkdir(profileDir, { recursive: true });
        await fs.mkdir(path.join(profileDir, 'Default'), { recursive: true });
        await fs.mkdir(path.join(profileDir, 'Extensions'), { recursive: true });

        // Generate persistent values for this profile
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        ];

        // Create stable profile seed for deterministic randomness
        const profileSeed = parseInt(profileId.substring(0, 8), 16);

        // Create profile metadata with persistent values
        const profile = {
            id: profileId,
            name: name || `Profile ${new Date().toLocaleDateString()}`,
            directory: profileDir,
            hardware: hardwareProfile,
            blockWebRTC: blockWebRTC,  // Store WebRTC preference
            created: Date.now(),
            lastUsed: Date.now(),
            // Persistent browser characteristics
            userAgent: userAgents[profileSeed % userAgents.length],
            profileSeed: profileSeed,
            // Device IDs generated once per profile
            mediaDevices: {
                videoInput: `video-${profileId.substring(0, 16)}`,
                audioInput: `audio-${profileId.substring(16, 32)}`,
                audioOutput: `speaker-${profileId.substring(32, 48)}`
            },
            // Fixed battery state per profile
            battery: {
                charging: (profileSeed % 3) !== 0,  // 66% chance of charging
                level: 0.5 + (profileSeed % 50) / 100  // Between 0.5 and 1.0
            },
            stats: {
                launches: 0,
                totalTime: 0,
                sitesVisited: []
            }
        };

        // Save profile metadata
        const profiles = this.store.get('profiles', {});
        profiles[profileId] = profile;
        this.store.set('profiles', profiles);

        // Set Chrome preferences for the profile
        await this.initializeProfilePreferences(profileDir, hardwareProfile, blockWebRTC);

        console.log(`Created new browser profile: ${name} (${profileId})`);
        return profile;
    }

    // Initialize Chrome preferences for a profile
    async initializeProfilePreferences(profileDir, hardwareProfile, blockWebRTC = true) {
        const preferencesPath = path.join(profileDir, 'Default', 'Preferences');

        // Chrome preferences with configurable WebRTC protection and profile-specific settings
        const preferences = {
            "profile": {
                "name": hardwareProfile.name || "User",
                "created_time": Date.now().toString()
            },
            "webrtc": blockWebRTC ? {
                "ip_handling_policy": "disable_non_proxied_udp",
                "multiple_routes_enabled": false,
                "nonproxied_udp_enabled": false
            } : {
                "ip_handling_policy": "default_public_and_private_interfaces",
                "multiple_routes_enabled": true,
                "nonproxied_udp_enabled": true
            },
            "autofill": {
                "enabled": true,
                "profile_enabled": true,
                "credit_card_enabled": true
            },
            "credentials_enable_service": true,
            "credentials_enable_autosignin": true,
            "password_manager_enabled": true,
            "payments": {
                "can_make_payment_enabled": true
            },
            "translate": {
                "enabled": true
            },
            "spellcheck": {
                "dictionaries": [hardwareProfile.location?.language || "en-US"],
                "dictionary": hardwareProfile.location?.language || "en-US"
            },
            "intl": {
                "accept_languages": hardwareProfile.location?.languages?.join(',') || "en-US,en",
                "selected_languages": hardwareProfile.location?.languages || ["en-US", "en"]
            }
        };

        await fs.writeFile(preferencesPath, JSON.stringify(preferences, null, 2));

        // Create Local State file for additional settings
        const localStatePath = path.join(profileDir, 'Local State');
        const localState = {
            "os_crypt": {
                "encrypted_key": crypto.randomBytes(32).toString('base64')
            },
            "hardware_acceleration_mode": {
                "enabled": true
            }
        };

        await fs.writeFile(localStatePath, JSON.stringify(localState, null, 2));
    }

    // Load an existing profile
    async loadProfile(profileId) {
        const profiles = this.store.get('profiles', {});
        const profile = profiles[profileId];

        if (!profile) {
            throw new Error(`Profile ${profileId} not found`);
        }

        // Check if profile directory exists
        try {
            await fs.access(profile.directory);
        } catch (error) {
            console.error(`Profile directory missing for ${profileId}, recreating...`);
            await fs.mkdir(profile.directory, { recursive: true });
            await fs.mkdir(path.join(profile.directory, 'Default'), { recursive: true });
            await this.initializeProfilePreferences(profile.directory, profile.hardware);
        }

        // Update last used time
        profile.lastUsed = Date.now();
        profile.stats.launches++;
        profiles[profileId] = profile;
        this.store.set('profiles', profiles);

        this.currentProfile = profile;
        console.log(`Loaded browser profile: ${profile.name} (${profileId})`);
        return profile;
    }

    // Get all profiles
    getAllProfiles() {
        return this.store.get('profiles', {});
    }

    // Delete a profile
    async deleteProfile(profileId) {
        const profiles = this.store.get('profiles', {});
        const profile = profiles[profileId];

        if (!profile) {
            throw new Error(`Profile ${profileId} not found`);
        }

        // Delete profile directory
        try {
            await this.deleteDirectory(profile.directory);
            console.log(`Deleted profile directory: ${profile.directory}`);
        } catch (error) {
            console.error(`Failed to delete profile directory: ${error.message}`);
        }

        // Remove from store
        delete profiles[profileId];
        this.store.set('profiles', profiles);

        if (this.currentProfile?.id === profileId) {
            this.currentProfile = null;
        }

        console.log(`Deleted browser profile: ${profile.name} (${profileId})`);
    }

    // Recursive directory deletion
    async deleteDirectory(dirPath) {
        try {
            const files = await fs.readdir(dirPath);

            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stat = await fs.stat(filePath);

                if (stat.isDirectory()) {
                    await this.deleteDirectory(filePath);
                } else {
                    await fs.unlink(filePath);
                }
            }

            await fs.rmdir(dirPath);
        } catch (error) {
            console.error(`Error deleting directory ${dirPath}:`, error);
            throw error;
        }
    }

    // Get current profile
    getCurrentProfile() {
        if (!this.currentProfile) {
            // Try to load last used profile
            const profiles = this.getAllProfiles();
            const profileIds = Object.keys(profiles);

            if (profileIds.length > 0) {
                // Find most recently used profile
                const lastUsedId = profileIds.reduce((a, b) =>
                    profiles[a].lastUsed > profiles[b].lastUsed ? a : b
                );
                this.currentProfile = profiles[lastUsedId];
            }
        }
        return this.currentProfile;
    }

    // Set current profile
    setCurrentProfile(profile) {
        this.currentProfile = profile;
        this.store.set('lastUsedProfile', profile.id);
        return profile;
    }

    // Export profile (backup)
    async exportProfile(profileId, exportPath) {
        const profile = this.getAllProfiles()[profileId];
        if (!profile) {
            throw new Error(`Profile ${profileId} not found`);
        }

        const exportData = {
            metadata: profile,
            timestamp: Date.now(),
            version: '1.0.0'
        };

        // Create export directory
        const exportDir = path.join(exportPath, `profile-export-${profileId}`);
        await fs.mkdir(exportDir, { recursive: true });

        // Copy profile directory
        await this.copyDirectory(profile.directory, path.join(exportDir, 'data'));

        // Save metadata
        await fs.writeFile(
            path.join(exportDir, 'metadata.json'),
            JSON.stringify(exportData, null, 2)
        );

        console.log(`Exported profile to: ${exportDir}`);
        return exportDir;
    }

    // Import profile
    async importProfile(importPath) {
        const metadataPath = path.join(importPath, 'metadata.json');
        const dataPath = path.join(importPath, 'data');

        // Read metadata
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const importData = JSON.parse(metadataContent);

        // Generate new ID for imported profile
        const newProfileId = crypto.randomBytes(8).toString('hex');
        const newProfileDir = path.join(this.profilesBaseDir, `profile-${newProfileId}`);

        // Copy profile data
        await this.copyDirectory(dataPath, newProfileDir);

        // Update profile metadata
        const profile = {
            ...importData.metadata,
            id: newProfileId,
            directory: newProfileDir,
            name: `${importData.metadata.name} (Imported)`,
            created: Date.now(),
            lastUsed: Date.now()
        };

        // Save to store
        const profiles = this.store.get('profiles', {});
        profiles[newProfileId] = profile;
        this.store.set('profiles', profiles);

        console.log(`Imported profile: ${profile.name} (${newProfileId})`);
        return profile;
    }

    // Copy directory recursively
    async copyDirectory(source, destination) {
        await fs.mkdir(destination, { recursive: true });

        const files = await fs.readdir(source);

        for (const file of files) {
            const sourcePath = path.join(source, file);
            const destPath = path.join(destination, file);
            const stat = await fs.stat(sourcePath);

            if (stat.isDirectory()) {
                await this.copyDirectory(sourcePath, destPath);
            } else {
                await fs.copyFile(sourcePath, destPath);
            }
        }
    }

    // Clean old session data (optional)
    async cleanProfile(profileId) {
        const profile = this.getAllProfiles()[profileId];
        if (!profile) {
            throw new Error(`Profile ${profileId} not found`);
        }

        const cacheDir = path.join(profile.directory, 'Default', 'Cache');
        const tempDir = path.join(profile.directory, 'Default', 'Temp');

        try {
            await this.deleteDirectory(cacheDir);
            await this.deleteDirectory(tempDir);
            console.log(`Cleaned cache for profile: ${profile.name}`);
        } catch (error) {
            console.error(`Failed to clean profile: ${error.message}`);
        }
    }

    // Get profile statistics
    async getProfileStats(profileId) {
        const profile = this.getAllProfiles()[profileId];
        if (!profile) {
            throw new Error(`Profile ${profileId} not found`);
        }

        // Calculate directory size
        const dirSize = await this.getDirectorySize(profile.directory);

        return {
            ...profile.stats,
            diskSize: dirSize,
            formattedSize: this.formatBytes(dirSize)
        };
    }

    // Get directory size
    async getDirectorySize(dirPath) {
        let size = 0;

        try {
            const files = await fs.readdir(dirPath);

            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stat = await fs.stat(filePath);

                if (stat.isDirectory()) {
                    size += await this.getDirectorySize(filePath);
                } else {
                    size += stat.size;
                }
            }
        } catch (error) {
            console.error(`Error calculating directory size: ${error.message}`);
        }

        return size;
    }

    // Format bytes to human readable
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

module.exports = new BrowserProfileManager();