// Military-Grade Hardware Database
// Top 10 most common hardware for each component based on Steam Hardware Survey & market data

const hardwareDatabase = {
    // Most common CPUs (by market share)
    cpus: [
        { model: 'Intel Core i5-10400', cores: 6, threads: 12, baseSpeed: 2.9, maxSpeed: 4.3 },
        { model: 'Intel Core i7-9700K', cores: 8, threads: 8, baseSpeed: 3.6, maxSpeed: 4.9 },
        { model: 'Intel Core i5-11400', cores: 6, threads: 12, baseSpeed: 2.6, maxSpeed: 4.4 },
        { model: 'AMD Ryzen 5 3600', cores: 6, threads: 12, baseSpeed: 3.6, maxSpeed: 4.2 },
        { model: 'Intel Core i7-10700K', cores: 8, threads: 16, baseSpeed: 3.8, maxSpeed: 5.1 },
        { model: 'AMD Ryzen 7 3700X', cores: 8, threads: 16, baseSpeed: 3.6, maxSpeed: 4.4 },
        { model: 'Intel Core i9-10900K', cores: 10, threads: 20, baseSpeed: 3.7, maxSpeed: 5.3 },
        { model: 'AMD Ryzen 5 5600X', cores: 6, threads: 12, baseSpeed: 3.7, maxSpeed: 4.6 },
        { model: 'Intel Core i3-10100', cores: 4, threads: 8, baseSpeed: 3.6, maxSpeed: 4.3 },
        { model: 'AMD Ryzen 9 5900X', cores: 12, threads: 24, baseSpeed: 3.7, maxSpeed: 4.8 }
    ],

    // Most common GPUs (EXACT models from Steam Survey)
    gpus: [
        { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce GTX 1060', vram: 6 },
        { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce RTX 3060', vram: 12 },
        { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce GTX 1650', vram: 4 },
        { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce RTX 3060 Ti', vram: 8 },
        { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce GTX 1050 Ti', vram: 4 },
        { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce RTX 2060', vram: 6 },
        { vendor: 'Intel Inc.', renderer: 'Intel(R) UHD Graphics 630', vram: 0 },
        { vendor: 'AMD', renderer: 'AMD Radeon RX 580', vram: 8 },
        { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce RTX 3070', vram: 8 },
        { vendor: 'Intel Inc.', renderer: 'Intel(R) Iris(R) Xe Graphics', vram: 0 }
    ],

    // Common RAM configurations
    ram: [
        { size: 8, speed: 2666, type: 'DDR4' },
        { size: 16, speed: 3200, type: 'DDR4' },
        { size: 32, speed: 3600, type: 'DDR4' },
        { size: 16, speed: 2666, type: 'DDR4' },
        { size: 8, speed: 2400, type: 'DDR4' },
        { size: 32, speed: 3200, type: 'DDR4' },
        { size: 64, speed: 3600, type: 'DDR4' },
        { size: 12, speed: 2666, type: 'DDR4' },
        { size: 24, speed: 3200, type: 'DDR4' },
        { size: 16, speed: 3000, type: 'DDR4' }
    ],

    // Most common screen resolutions
    screens: [
        { width: 1920, height: 1080, refreshRate: 60, colorDepth: 24, pixelDepth: 24 },
        { width: 1920, height: 1080, refreshRate: 144, colorDepth: 24, pixelDepth: 24 },
        { width: 2560, height: 1440, refreshRate: 144, colorDepth: 24, pixelDepth: 24 },
        { width: 1366, height: 768, refreshRate: 60, colorDepth: 24, pixelDepth: 24 },
        { width: 3840, height: 2160, refreshRate: 60, colorDepth: 24, pixelDepth: 24 },
        { width: 1920, height: 1080, refreshRate: 240, colorDepth: 24, pixelDepth: 24 },
        { width: 2560, height: 1080, refreshRate: 75, colorDepth: 24, pixelDepth: 24 },
        { width: 1680, height: 1050, refreshRate: 60, colorDepth: 24, pixelDepth: 24 },
        { width: 1440, height: 900, refreshRate: 60, colorDepth: 24, pixelDepth: 24 },
        { width: 2560, height: 1440, refreshRate: 165, colorDepth: 24, pixelDepth: 24 }
    ],

    // Common operating systems
    os: [
        { name: 'Windows 10', version: '10.0.19045', platform: 'Win32', arch: 'x64' },
        { name: 'Windows 11', version: '10.0.22621', platform: 'Win32', arch: 'x64' },
        { name: 'Windows 10', version: '10.0.19044', platform: 'Win32', arch: 'x64' },
        { name: 'Windows 11', version: '10.0.22000', platform: 'Win32', arch: 'x64' },
        { name: 'Windows 10', version: '10.0.19043', platform: 'Win32', arch: 'x64' },
        { name: 'Windows 10', version: '10.0.19042', platform: 'Win32', arch: 'x64' },
        { name: 'Windows 10', version: '10.0.18363', platform: 'Win32', arch: 'x64' },
        { name: 'Windows 11', version: '10.0.22631', platform: 'Win32', arch: 'x64' },
        { name: 'Windows 10', version: '10.0.17763', platform: 'Win32', arch: 'x64' },
        { name: 'Windows 10', version: '10.0.19041', platform: 'Win32', arch: 'x64' }
    ],

    // Common audio devices
    audio: [
        { device: 'Realtek High Definition Audio', sampleRate: 48000, channels: 2 },
        { device: 'NVIDIA High Definition Audio', sampleRate: 48000, channels: 2 },
        { device: 'AMD High Definition Audio Device', sampleRate: 48000, channels: 2 },
        { device: 'Realtek Audio', sampleRate: 44100, channels: 2 },
        { device: 'USB Audio Device', sampleRate: 48000, channels: 2 },
        { device: 'Intel Display Audio', sampleRate: 48000, channels: 2 },
        { device: 'Conexant SmartAudio HD', sampleRate: 48000, channels: 2 },
        { device: 'VIA HD Audio', sampleRate: 48000, channels: 2 },
        { device: 'SteelSeries Arctis 7', sampleRate: 48000, channels: 2 },
        { device: 'Logitech G Pro X', sampleRate: 48000, channels: 2 }
    ],

    // Common network adapters
    network: [
        { adapter: 'Intel(R) Wi-Fi 6 AX200', type: 'WiFi', speed: 'ac' },
        { adapter: 'Realtek PCIe GbE Family Controller', type: 'Ethernet', speed: '1000' },
        { adapter: 'Intel(R) Ethernet Connection I219-V', type: 'Ethernet', speed: '1000' },
        { adapter: 'Realtek 8821CE Wireless LAN', type: 'WiFi', speed: 'ac' },
        { adapter: 'Intel(R) Wi-Fi 6E AX210', type: 'WiFi', speed: 'ax' },
        { adapter: 'Killer E2600 Gigabit Ethernet', type: 'Ethernet', speed: '1000' },
        { adapter: 'Broadcom 802.11ac Network Adapter', type: 'WiFi', speed: 'ac' },
        { adapter: 'Intel(R) Dual Band Wireless-AC 8265', type: 'WiFi', speed: 'ac' },
        { adapter: 'Realtek RTL8125 2.5GbE Controller', type: 'Ethernet', speed: '2500' },
        { adapter: 'MediaTek Wi-Fi 6 MT7921', type: 'WiFi', speed: 'ax' }
    ],

    // Common browsers
    browsers: [
        { name: 'Chrome', version: '120.0.6099.109', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        { name: 'Chrome', version: '119.0.6045.159', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36' },
        { name: 'Chrome', version: '121.0.6167.85', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36' },
        { name: 'Chrome', version: '118.0.5993.88', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36' },
        { name: 'Chrome', version: '122.0.6261.57', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' }
    ],

    // Common timezones & languages
    locales: [
        { timezone: 'America/New_York', offset: -300, language: 'en-US', languages: ['en-US', 'en'] },
        { timezone: 'America/Chicago', offset: -360, language: 'en-US', languages: ['en-US', 'en'] },
        { timezone: 'America/Los_Angeles', offset: -480, language: 'en-US', languages: ['en-US', 'en'] },
        { timezone: 'America/Denver', offset: -420, language: 'en-US', languages: ['en-US', 'en'] },
        { timezone: 'Europe/London', offset: 0, language: 'en-GB', languages: ['en-GB', 'en'] },
        { timezone: 'Europe/Paris', offset: -60, language: 'fr-FR', languages: ['fr-FR', 'fr', 'en-US', 'en'] },
        { timezone: 'Europe/Berlin', offset: -60, language: 'de-DE', languages: ['de-DE', 'de', 'en-US', 'en'] },
        { timezone: 'Asia/Tokyo', offset: -540, language: 'ja-JP', languages: ['ja-JP', 'ja', 'en-US', 'en'] },
        { timezone: 'Australia/Sydney', offset: -660, language: 'en-AU', languages: ['en-AU', 'en'] },
        { timezone: 'America/Toronto', offset: -300, language: 'en-CA', languages: ['en-CA', 'en'] }
    ],

    // Common WebGL extensions
    webglExtensions: [
        'ANGLE_instanced_arrays',
        'EXT_blend_minmax',
        'EXT_color_buffer_half_float',
        'EXT_disjoint_timer_query',
        'EXT_float_blend',
        'EXT_frag_depth',
        'EXT_shader_texture_lod',
        'EXT_texture_compression_bptc',
        'EXT_texture_compression_rgtc',
        'EXT_texture_filter_anisotropic',
        'KHR_parallel_shader_compile',
        'OES_element_index_uint',
        'OES_fbo_render_mipmap',
        'OES_standard_derivatives',
        'OES_texture_float',
        'OES_texture_float_linear',
        'OES_texture_half_float',
        'OES_texture_half_float_linear',
        'OES_vertex_array_object',
        'WEBGL_color_buffer_float',
        'WEBGL_compressed_texture_s3tc',
        'WEBGL_compressed_texture_s3tc_srgb',
        'WEBGL_debug_renderer_info',
        'WEBGL_debug_shaders',
        'WEBGL_depth_texture',
        'WEBGL_draw_buffers',
        'WEBGL_lose_context',
        'WEBGL_multi_draw'
    ]
};

// Helper function to get random item from category
function getRandomHardware(category) {
    const items = hardwareDatabase[category];
    if (!items || items.length === 0) return null;
    return items[Math.floor(Math.random() * items.length)];
}

// Get complete random profile
function generateCompleteProfile() {
    const cpu = getRandomHardware('cpus');
    const gpu = getRandomHardware('gpus');
    const ram = getRandomHardware('ram');
    const screen = getRandomHardware('screens');
    const os = getRandomHardware('os');
    const audio = getRandomHardware('audio');
    const network = getRandomHardware('network');
    const browser = getRandomHardware('browsers');
    const locale = getRandomHardware('locales');

    return {
        cpu,
        gpu,
        ram,
        screen,
        os,
        audio,
        network,
        browser,
        locale,
        webgl: {
            vendor: gpu.vendor,
            renderer: `ANGLE (${gpu.renderer}, Direct3D11 vs_5_0 ps_5_0)`,
            extensions: hardwareDatabase.webglExtensions.slice(0, 20 + Math.floor(Math.random() * 8))
        }
    };
}

// Validate hardware combination for realism
function validateHardwareCombination(profile) {
    // High-end GPU should have high-end CPU
    const highEndGPUs = ['RTX 3060', 'RTX 3070', 'RTX 3080', 'RTX 3090', 'RTX 4070', 'RTX 4080', 'RTX 4090'];
    const hasHighEndGPU = highEndGPUs.some(gpu => profile.gpu?.renderer?.includes(gpu));

    if (hasHighEndGPU) {
        // Should have at least 6 cores and 16GB RAM
        if (profile.cpu?.cores < 6) return false;
        if (profile.ram?.size < 16) return false;
    }

    // 4K screen should have good GPU
    if (profile.screen?.width >= 3840) {
        const lowEndGPUs = ['GTX 1050', 'GTX 1650', 'Intel(R) UHD', 'Intel(R) HD'];
        const hasLowEndGPU = lowEndGPUs.some(gpu => profile.gpu?.renderer?.includes(gpu));
        if (hasLowEndGPU) return false;
    }

    return true;
}

module.exports = {
    hardwareDatabase,
    getRandomHardware,
    generateCompleteProfile,
    validateHardwareCombination
};