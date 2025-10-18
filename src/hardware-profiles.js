// Hardware Profile Manager
// Manages consistent hardware fingerprints across the browser session
// Military-grade consistency between UI and browser

const Store = require('electron-store');
const crypto = require('crypto');
const { hardwareDatabase, generateCompleteProfile } = require('./hardware-database');

class HardwareProfileManager {
    constructor() {
        this.store = new Store({ name: 'hardware-profiles' });
        this.currentProfile = null;
    }

    // Generate a new random profile with EXACT hardware models
    generateProfile(template = 'random') {
        const profiles = {
            'us-gamer': {
                name: 'US Gamer',
                ...this.generateGamerProfile()
            },
            'eu-office': {
                name: 'EU Office Worker',
                ...this.generateOfficeProfile()
            },
            'asia-student': {
                name: 'Asia Student',
                ...this.generateStudentProfile()
            },
            'random': {
                name: 'Random Profile',
                ...this.generateRandomProfile()
            }
        };

        const profile = profiles[template] || profiles['random'];

        // Ensure GPU has exact vendor and renderer
        if (!profile.hardware.gpuVendor || !profile.hardware.gpuRenderer) {
            this.ensureExactGPU(profile);
        }

        return profile;
    }

    generateGamerProfile() {
        const cpu = hardwareDatabase.cpus[4]; // i7-10700K
        const gpu = hardwareDatabase.gpus[1]; // RTX 3060
        const ram = hardwareDatabase.ram[1]; // 16GB 3200MHz
        const screen = hardwareDatabase.screens[2]; // 2560x1440 144Hz
        const locale = hardwareDatabase.locales[0]; // America/New_York

        return {
            hardware: {
                cpu: cpu.model,
                cores: cpu.cores,
                threads: cpu.threads,
                memory: ram.size,
                memorySpeed: ram.speed,
                memoryType: ram.type,
                gpuVendor: gpu.vendor,
                gpuRenderer: gpu.renderer,
                gpuVram: gpu.vram,
                screen: {
                    width: screen.width,
                    height: screen.height,
                    colorDepth: screen.colorDepth,
                    pixelDepth: screen.pixelDepth,
                    refreshRate: screen.refreshRate
                }
            },
            location: {
                timezone: locale.timezone,
                timezoneOffset: locale.offset,
                language: locale.language,
                languages: locale.languages,
                locale: locale.language
            }
        };
    }

    generateOfficeProfile() {
        const cpu = hardwareDatabase.cpus[0]; // i5-10400
        const gpu = hardwareDatabase.gpus[6]; // Intel UHD 630
        const ram = hardwareDatabase.ram[1]; // 16GB
        const screen = hardwareDatabase.screens[0]; // 1920x1080 60Hz
        const locale = hardwareDatabase.locales[6]; // Europe/Berlin

        return {
            hardware: {
                cpu: cpu.model,
                cores: cpu.cores,
                threads: cpu.threads,
                memory: ram.size,
                memorySpeed: ram.speed,
                memoryType: ram.type,
                gpuVendor: gpu.vendor,
                gpuRenderer: gpu.renderer,
                gpuVram: gpu.vram,
                screen: {
                    width: screen.width,
                    height: screen.height,
                    colorDepth: screen.colorDepth,
                    pixelDepth: screen.pixelDepth,
                    refreshRate: screen.refreshRate
                }
            },
            location: {
                timezone: locale.timezone,
                timezoneOffset: locale.offset,
                language: locale.language,
                languages: locale.languages,
                locale: locale.language
            }
        };
    }

    generateStudentProfile() {
        const cpu = hardwareDatabase.cpus[8]; // i3-10100
        const gpu = hardwareDatabase.gpus[6]; // Intel UHD
        const ram = hardwareDatabase.ram[0]; // 8GB
        const screen = hardwareDatabase.screens[3]; // 1366x768
        const locale = hardwareDatabase.locales[7]; // Asia/Tokyo

        return {
            hardware: {
                cpu: cpu.model,
                cores: cpu.cores,
                threads: cpu.threads,
                memory: ram.size,
                memorySpeed: ram.speed,
                memoryType: ram.type,
                gpuVendor: gpu.vendor,
                gpuRenderer: gpu.renderer,
                gpuVram: gpu.vram,
                screen: {
                    width: screen.width,
                    height: screen.height,
                    colorDepth: screen.colorDepth,
                    pixelDepth: screen.pixelDepth,
                    refreshRate: screen.refreshRate
                }
            },
            location: {
                timezone: locale.timezone,
                timezoneOffset: locale.offset,
                language: locale.language,
                languages: locale.languages,
                locale: locale.language
            }
        };
    }

    generateRandomProfile() {
        const completeProfile = generateCompleteProfile();

        return {
            hardware: {
                cpu: completeProfile.cpu.model,
                cores: completeProfile.cpu.cores,
                threads: completeProfile.cpu.threads,
                memory: completeProfile.ram.size,
                memorySpeed: completeProfile.ram.speed,
                memoryType: completeProfile.ram.type,
                gpuVendor: completeProfile.gpu.vendor,
                gpuRenderer: completeProfile.gpu.renderer,
                gpuVram: completeProfile.gpu.vram,
                screen: {
                    width: completeProfile.screen.width,
                    height: completeProfile.screen.height,
                    colorDepth: completeProfile.screen.colorDepth,
                    pixelDepth: completeProfile.screen.pixelDepth,
                    refreshRate: completeProfile.screen.refreshRate
                },
                audio: completeProfile.audio.device,
                network: completeProfile.network.adapter,
                os: completeProfile.os.name,
                osVersion: completeProfile.os.version
            },
            location: {
                timezone: completeProfile.locale.timezone,
                timezoneOffset: completeProfile.locale.offset,
                language: completeProfile.locale.language,
                languages: completeProfile.locale.languages,
                locale: completeProfile.locale.language
            },
            browser: completeProfile.browser
        };
    }

    // Ensure profile has exact GPU vendor and renderer
    ensureExactGPU(profile) {
        if (!profile.hardware.gpuVendor || !profile.hardware.gpuRenderer) {
            // If only gpu type is specified, pick exact model
            if (profile.hardware.gpu === 'nvidia') {
                const gpu = hardwareDatabase.gpus[1]; // RTX 3060
                profile.hardware.gpuVendor = gpu.vendor;
                profile.hardware.gpuRenderer = gpu.renderer;
                profile.hardware.gpuVram = gpu.vram;
            } else if (profile.hardware.gpu === 'amd') {
                const gpu = hardwareDatabase.gpus[7]; // RX 580
                profile.hardware.gpuVendor = gpu.vendor;
                profile.hardware.gpuRenderer = gpu.renderer;
                profile.hardware.gpuVram = gpu.vram;
            } else {
                const gpu = hardwareDatabase.gpus[6]; // Intel UHD
                profile.hardware.gpuVendor = gpu.vendor;
                profile.hardware.gpuRenderer = gpu.renderer;
                profile.hardware.gpuVram = gpu.vram;
            }
        }
    }

    // Save profile to store
    saveProfile(profile) {
        const id = crypto.randomBytes(8).toString('hex');
        const profiles = this.store.get('profiles', {});
        profiles[id] = { ...profile, id, created: Date.now() };
        this.store.set('profiles', profiles);
        return id;
    }

    // Load profile from store
    loadProfile(id) {
        const profiles = this.store.get('profiles', {});
        return profiles[id];
    }

    // Get all saved profiles
    getAllProfiles() {
        return this.store.get('profiles', {});
    }

    // Delete profile
    deleteProfile(id) {
        const profiles = this.store.get('profiles', {});
        delete profiles[id];
        this.store.set('profiles', profiles);
    }

    // Set current active profile - DO NOT randomly change hardware!
    setCurrentProfile(profile) {
        // Ensure exact GPU is set
        if (!profile.hardware.gpuVendor || !profile.hardware.gpuRenderer) {
            this.ensureExactGPU(profile);
        }

        this.currentProfile = profile;
        this.store.set('currentProfile', profile);

        return profile;
    }

    // Get current active profile
    getCurrentProfile() {
        if (!this.currentProfile) {
            this.currentProfile = this.store.get('currentProfile');
            if (!this.currentProfile) {
                // Generate default profile if none exists
                this.currentProfile = this.generateProfile('random');
                this.store.set('currentProfile', this.currentProfile);
            }
        }
        return this.currentProfile;
    }

    // Export profile as JSON
    exportProfile(id) {
        const profile = this.loadProfile(id);
        return JSON.stringify(profile, null, 2);
    }

    // Import profile from JSON
    importProfile(jsonString) {
        try {
            const profile = JSON.parse(jsonString);
            delete profile.id; // Remove old ID
            return this.saveProfile(profile);
        } catch (error) {
            throw new Error('Invalid profile JSON');
        }
    }
}

module.exports = new HardwareProfileManager();