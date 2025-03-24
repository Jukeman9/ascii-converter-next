/**
 * ASCII Art Converter
 * Converts images to ASCII art with configurable parameters
 */

// Additional character sets
const CHAR_SETS = {
    standard: '█▓▒░',
    extended: '@%#*+=-:. ',
    blocks: '█▓▒░▄▀■□▪▫',
    simple: '#. ',
};

// Default settings
const defaults = {
    width: 100,
    height: 0, // Will be calculated based on aspect ratio
    brightness: 100,
    contrast: 100,
    saturation: 100,
    grayscale: 0,
    invert: 0,
    hue: 0,
    sepia: 0,
    colorized: false,
    charSet: CHAR_SETS.standard,
    customChars: '',
    stretchWidth: 100, // New parameter for width stretching (%)
    stretchHeight: 100 // New parameter for height stretching (%)
};

/**
 * Main function to convert an image to ASCII art
 * @param {HTMLImageElement|string} imgSource - Image element or URL
 * @param {Object} options - Conversion options
 * @returns {Promise<Object>} - ASCII text and image data
 */
async function convertToAscii(imgSource, options = {}) {
    // Check for high resolution warning
    if (options.width > 500 && !options._highResolutionConfirmed) {
        const confirmHighRes = confirm(
            "Setting resolution above 500 may be resource-intensive and slow down your browser. " +
            "Do you want to continue with this high resolution?"
        );
        
        if (!confirmHighRes) {
            options.width = Math.min(options.width, 500);
        } else {
            options._highResolutionConfirmed = true;
        }
    }
    
    // Merge options with defaults
    const settings = { ...defaults, ...options };
    
    // Load image if source is a URL
    let img;
    if (typeof imgSource === 'string') {
        img = new Image();
        img.src = imgSource;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error('Failed to load image'));
        });
    } else {
        img = imgSource;
    }

    // Calculate height if not specified
    if (!settings.height) {
        const aspectRatio = (img.naturalHeight / img.naturalWidth) * 0.5;
        settings.height = Math.round(settings.width * aspectRatio);
    }
    
    // Apply stretch factors
    const effectiveWidth = Math.round(settings.width * (settings.stretchWidth / 100));
    const effectiveHeight = Math.round(settings.height * (settings.stretchHeight / 100));

    // Create canvas and draw image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = effectiveWidth;
    canvas.height = effectiveHeight;
    
    // Draw original image on canvas with sizing
    ctx.drawImage(img, 0, 0, effectiveWidth, effectiveHeight);
    
    // Get pixel data
    const imageData = ctx.getImageData(0, 0, effectiveWidth, effectiveHeight);
    let pixels = imageData.data;
    
    // Apply image adjustments
    applyImageAdjustments(pixels, settings);
    ctx.putImageData(imageData, 0, 0);
    
    // Character set selection
    let chars;
    
    // Determine character set
    if (settings.customChars && settings.customChars.length > 0) {
        chars = settings.customChars;
    } else if (settings.charSetType) {
        // Use predefined character set based on type
        chars = CHAR_SETS[settings.charSetType] || CHAR_SETS.standard;
    } else {
        chars = settings.charSet || CHAR_SETS.standard;
    }
    
    // Create ASCII output
    let ascii = '';
    let colorMap = [];
    
    // For each pixel row
    for (let y = 0; y < effectiveHeight; y++) {
        let row = '';
        let rowColors = [];
        
        // For each pixel in the row
        for (let x = 0; x < effectiveWidth; x++) {
            const idx = (y * effectiveWidth + x) * 4;
            
            // Get RGB values
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            
            // Calculate average brightness (0-255)
            const brightness = (r + g + b) / 3;
            
            // Map brightness to character in our set
            const charIdx = Math.floor(brightness / 256 * chars.length);
            const char = chars[Math.min(chars.length - 1, charIdx)];
            
            row += char;
            
            // Store color for this character if colorized output is enabled
            if (settings.colorized) {
                rowColors.push({ r, g, b });
            }
        }
        
        ascii += row + '\n';
        if (settings.colorized) {
            colorMap.push(rowColors);
        }
    }
    
    // Generate ASCII image
    const asciiImage = await createAsciiImage(ascii, effectiveWidth, effectiveHeight, settings, colorMap);
    
    return {
        text: ascii,
        image: asciiImage
    };
}

/**
 * Apply various image adjustments to pixel data
 * @param {Uint8ClampedArray} pixels - Image pixel data
 * @param {Object} settings - Adjustment settings
 */
function applyImageAdjustments(pixels, settings) {
    // Apply brightness, contrast, saturation, etc.
    const brightness = (settings.brightness - 100) * 2.55; // Convert to -255 to 255 range
    const contrast = settings.contrast / 100;
    const saturation = settings.saturation / 100;
    const grayscaleLevel = settings.grayscale / 100;
    const invertLevel = settings.invert / 100;
    const hueRotation = settings.hue * 3.6; // Convert 0-100 to 0-360 degrees
    const sepiaLevel = settings.sepia / 100;
    
    for (let i = 0; i < pixels.length; i += 4) {
        let r = pixels[i];
        let g = pixels[i + 1];
        let b = pixels[i + 2];
        
        // Apply brightness
        r = truncate(r + brightness);
        g = truncate(g + brightness);
        b = truncate(b + brightness);
        
        // Apply contrast
        r = truncate(((r / 255 - 0.5) * contrast + 0.5) * 255);
        g = truncate(((g / 255 - 0.5) * contrast + 0.5) * 255);
        b = truncate(((b / 255 - 0.5) * contrast + 0.5) * 255);
        
        // Apply saturation
        const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b; // Luminance
        r = truncate(gray + saturation * (r - gray));
        g = truncate(gray + saturation * (g - gray));
        b = truncate(gray + saturation * (b - gray));
        
        // Apply grayscale
        if (grayscaleLevel > 0) {
            const grayPixel = 0.2989 * r + 0.5870 * g + 0.1140 * b;
            r = truncate(r * (1 - grayscaleLevel) + grayPixel * grayscaleLevel);
            g = truncate(g * (1 - grayscaleLevel) + grayPixel * grayscaleLevel);
            b = truncate(b * (1 - grayscaleLevel) + grayPixel * grayscaleLevel);
        }
        
        // Apply invert
        if (invertLevel > 0) {
            r = truncate(r * (1 - invertLevel) + (255 - r) * invertLevel);
            g = truncate(g * (1 - invertLevel) + (255 - g) * invertLevel);
            b = truncate(b * (1 - invertLevel) + (255 - b) * invertLevel);
        }
        
        // Apply hue rotation if needed
        if (hueRotation !== 0) {
            // Convert RGB to HSL
            let [h, s, l] = rgbToHsl(r, g, b);
            
            // Apply hue rotation
            h = (h + hueRotation) % 360;
            if (h < 0) h += 360;
            
            // Convert back to RGB
            const rgb = hslToRgb(h, s, l);
            r = rgb[0];
            g = rgb[1];
            b = rgb[2];
        }
        
        // Apply sepia
        if (sepiaLevel > 0) {
            const sepiaR = 0.393 * r + 0.769 * g + 0.189 * b;
            const sepiaG = 0.349 * r + 0.686 * g + 0.168 * b;
            const sepiaB = 0.272 * r + 0.534 * g + 0.131 * b;
            
            r = truncate(r * (1 - sepiaLevel) + sepiaR * sepiaLevel);
            g = truncate(g * (1 - sepiaLevel) + sepiaG * sepiaLevel);
            b = truncate(b * (1 - sepiaLevel) + sepiaB * sepiaLevel);
        }
        
        pixels[i] = r;
        pixels[i + 1] = g;
        pixels[i + 2] = b;
        // Alpha channel (pixels[i + 3]) remains unchanged
    }
}

/**
 * Convert RGB to HSL color space
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {Array} - [h, s, l] where h is in degrees (0-360) and s, l are percentages (0-100)
 */
function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        
        h *= 60;
    }
    
    return [h, s * 100, l * 100];
}

/**
 * Convert HSL to RGB color space
 * @param {number} h - Hue in degrees (0-360)
 * @param {number} s - Saturation percentage (0-100)
 * @param {number} l - Lightness percentage (0-100)
 * @returns {Array} - [r, g, b] values in range 0-255
 */
function hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    
    const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    };
    
    if (s === 0) {
        // achromatic
        const value = Math.round(l * 255);
        return [value, value, value];
    }
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const r = hue2rgb(p, q, (h / 360 + 1/3) % 1);
    const g = hue2rgb(p, q, h / 360 % 1);
    const b = hue2rgb(p, q, (h / 360 - 1/3) % 1);
    
    return [
        Math.round(r * 255),
        Math.round(g * 255),
        Math.round(b * 255)
    ];
}

/**
 * Create an image from ASCII text
 * @param {string} ascii - ASCII art text
 * @param {number} originalWidth - Width of original image
 * @param {number} originalHeight - Height of original image
 * @param {Object} options - Rendering options
 * @param {Array} colorMap - Color information if colorized
 * @returns {string} - Base64 encoded image
 */
async function createAsciiImage(ascii, originalWidth, originalHeight, options = {}, colorMap = []) {
    const lines = ascii.split('\n');
    const width = options.width * 2; // Double width to account for character aspect ratio
    const height = options.height;
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'black';
    
    // Calculate font size to fit
    const fontSize = height / lines.length;
    ctx.font = `${fontSize}px monospace`;
    
    // Draw ASCII
    for (let y = 0; y < lines.length; y++) {
        const line = lines[y];
        
        if (options.colorized && colorMap[y]) {
            // Draw colored text character by character
            for (let x = 0; x < line.length && x < colorMap[y].length; x++) {
                const char = line[x];
                const color = colorMap[y][x];
                ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
                ctx.fillText(char, x * fontSize / 2, (y + 1) * fontSize);
            }
        } else {
            // Draw monochrome text
            ctx.fillStyle = 'black';
            ctx.fillText(line, 0, (y + 1) * fontSize);
        }
    }
    
    // Convert to base64
    return canvas.toDataURL('image/png');
}

/**
 * Ensure value is within 0-255 range
 * @param {number} value - Input value
 * @returns {number} - Clamped value
 */
function truncate(value) {
    return Math.min(255, Math.max(0, value));
}

/**
 * Create UI elements for the ASCII converter
 * @returns {HTMLElement} - Container with UI controls
 */
function initAsciiConverterUI() {
    const container = document.createElement('div');
    container.id = 'ascii-converter-options';
    
    // Character set selection
    const charSetDiv = document.createElement('div');
    const charSetLabel = document.createElement('label');
    charSetLabel.textContent = 'Character Set:';
    const charSetSelect = document.createElement('select');
    charSetSelect.id = 'ascii-charSetType';
    
    // Add char set options
    const charSetOptions = {
        'standard': 'Standard (█▓▒░)',
        'extended': 'Extended (@%#*+=-:. )',
        'blocks': 'Blocks (█▓▒░▄▀■□▪▫)',
        'simple': 'Simple (#. )'
    };
    
    Object.entries(charSetOptions).forEach(([value, text]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        charSetSelect.appendChild(option);
    });
    
    charSetDiv.appendChild(charSetLabel);
    charSetDiv.appendChild(charSetSelect);
    container.appendChild(charSetDiv);
    
    // Custom characters
    const customCharsDiv = document.createElement('div');
    const customCharsLabel = document.createElement('label');
    customCharsLabel.textContent = 'Custom Characters:';
    const customCharsInput = document.createElement('input');
    customCharsInput.type = 'text';
    customCharsInput.id = 'ascii-customChars';
    customCharsInput.placeholder = 'e.g. @#$%&*!;:+=-,.';
    
    customCharsDiv.appendChild(customCharsLabel);
    customCharsDiv.appendChild(customCharsInput);
    container.appendChild(customCharsDiv);
    
    // Create sliders for various parameters
    const sliders = [
        { id: 'width', label: 'Width:', min: 10, max: 500, value: defaults.width },
        { id: 'brightness', label: 'Brightness:', min: 0, max: 200, value: defaults.brightness },
        { id: 'contrast', label: 'Contrast:', min: 0, max: 200, value: defaults.contrast },
        { id: 'saturation', label: 'Saturation:', min: 0, max: 200, value: defaults.saturation },
        { id: 'grayscale', label: 'Grayscale:', min: 0, max: 100, value: defaults.grayscale },
        { id: 'invert', label: 'Invert:', min: 0, max: 100, value: defaults.invert },
        { id: 'hue', label: 'Hue Rotation:', min: 0, max: 100, value: defaults.hue },
        { id: 'sepia', label: 'Sepia:', min: 0, max: 100, value: defaults.sepia },
        { id: 'stretchWidth', label: 'Stretch Width (%):', min: 50, max: 200, value: defaults.stretchWidth },
        { id: 'stretchHeight', label: 'Stretch Height (%):', min: 50, max: 200, value: defaults.stretchHeight }
    ];
    
    sliders.forEach(({ id, label, min, max, value }) => {
        const div = document.createElement('div');
        const sliderLabel = document.createElement('label');
        sliderLabel.textContent = label;
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.id = 'ascii-' + id;
        slider.min = min;
        slider.max = max;
        slider.value = value;
        
        const valueDisplay = document.createElement('span');
        valueDisplay.textContent = value;
        slider.addEventListener('input', () => {
            valueDisplay.textContent = slider.value;
        });
        
        div.appendChild(sliderLabel);
        div.appendChild(slider);
        div.appendChild(valueDisplay);
        container.appendChild(div);
    });
    
    // Colorized option
    const colorDiv = document.createElement('div');
    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'Colorized:';
    const colorCheck = document.createElement('input');
    colorCheck.type = 'checkbox';
    colorCheck.id = 'ascii-colorized';
    colorCheck.checked = defaults.colorized;
    
    colorDiv.appendChild(colorLabel);
    colorDiv.appendChild(colorCheck);
    container.appendChild(colorDiv);
    
    return container;
}

/**
 * Get current settings from the UI controls
 * @returns {Object} - Current settings
 */
function getSettingsFromUI() {
    const settings = {};
    
    // Get values from all inputs
    const inputs = document.querySelectorAll('#ascii-converter-options input, #ascii-converter-options select');
    
    inputs.forEach(input => {
        const id = input.id.replace('ascii-', '');
        
        // Handle different input types
        if (input.type === 'checkbox') {
            settings[id] = input.checked;
        } else if (input.type === 'range' || input.type === 'number') {
            settings[id] = parseFloat(input.value);
        } else {
            settings[id] = input.value;
        }
    });
    
    return settings;
}

// For client side usage and compatibility with both browser globals and ES modules
const asciiConverter = {
    convertToAscii,
    initAsciiConverterUI,
    getSettingsFromUI,
    defaults,
    CHAR_SETS
};

// Make it work in browser globals and with ES modules
if (typeof window !== 'undefined') {
    window.asciiConverter = asciiConverter;
}

export default asciiConverter; 