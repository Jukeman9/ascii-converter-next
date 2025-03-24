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
    ctx.drawImage(img, 0, 0, effectiveWidth, effectiveHeight);

    // Get image data
    const imageData = ctx.getImageData(0, 0, effectiveWidth, effectiveHeight);
    const pixels = imageData.data;
    
    // Store original pixels for colorized version
    const originalPixels = new Uint8ClampedArray(pixels);

    // Apply image adjustments
    applyImageAdjustments(pixels, settings);
    
    // Convert to ASCII
    let ascii = '';
    // Use custom characters if specified, otherwise use default charSet
    const chars = settings.customChars && settings.customChars.length > 0 
        ? settings.customChars 
        : settings.charSet;

    // Create a map to store color information for each ASCII character position
    let colorMap = [];
    if (settings.colorized) {
        colorMap = Array(effectiveHeight).fill().map(() => Array(effectiveWidth).fill(null));
    }

    for (let y = 0; y < effectiveHeight; y++) {
        for (let x = 0; x < effectiveWidth; x++) {
            const idx = (y * effectiveWidth + x) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            
            // Calculate brightness using luminance formula
            const brightness = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            
            // Map brightness to character with better distribution
            const charIndex = Math.min(chars.length - 1, Math.floor(chars.length * brightness / 256));
            ascii += chars[charIndex];
            
            // Store original color for this position
            if (settings.colorized) {
                colorMap[y][x] = {
                    r: originalPixels[idx],
                    g: originalPixels[idx + 1],
                    b: originalPixels[idx + 2]
                };
            }
        }
        ascii += '\n';
    }

    // Create ASCII image
    const asciiImage = await createAsciiImage(ascii, img.width, img.height, settings, colorMap);
    
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
    const length = pixels.length;
    
    // Contrast adjustment factor
    const contrastFactor = (259 * (settings.contrast / 100 + 255)) / (255 * (259 - settings.contrast / 100));
    
    for (let i = 0; i < length; i += 4) {
        let r = pixels[i];
        let g = pixels[i + 1];
        let b = pixels[i + 2];
        
        // Apply brightness
        if (settings.brightness !== 100) {
            const factor = settings.brightness / 100;
            r = truncate(r * factor);
            g = truncate(g * factor);
            b = truncate(b * factor);
        }
        
        // Apply contrast
        if (settings.contrast !== 100) {
            r = truncate(contrastFactor * (r - 128) + 128);
            g = truncate(contrastFactor * (g - 128) + 128);
            b = truncate(contrastFactor * (b - 128) + 128);
        }
        
        // Apply saturation
        if (settings.saturation !== 100) {
            const factor = settings.saturation / 100;
            const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
            r = truncate(gray + (r - gray) * factor);
            g = truncate(gray + (g - gray) * factor);
            b = truncate(gray + (b - gray) * factor);
        }
        
        // Apply grayscale
        if (settings.grayscale > 0) {
            const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
            const factor = settings.grayscale / 100;
            r = truncate(r * (1 - factor) + gray * factor);
            g = truncate(g * (1 - factor) + gray * factor);
            b = truncate(b * (1 - factor) + gray * factor);
        }
        
        // Apply inversion
        if (settings.invert > 0) {
            const factor = settings.invert / 100;
            r = truncate(r * (1 - factor) + (255 - r) * factor);
            g = truncate(g * (1 - factor) + (255 - g) * factor);
            b = truncate(b * (1 - factor) + (255 - b) * factor);
        }
        
        // Apply sepia
        if (settings.sepia > 0) {
            const factor = settings.sepia / 100;
            const sepiaR = 0.393 * r + 0.769 * g + 0.189 * b;
            const sepiaG = 0.349 * r + 0.686 * g + 0.168 * b;
            const sepiaB = 0.272 * r + 0.534 * g + 0.131 * b;
            
            r = truncate(r * (1 - factor) + sepiaR * factor);
            g = truncate(g * (1 - factor) + sepiaG * factor);
            b = truncate(b * (1 - factor) + sepiaB * factor);
        }
        
        // Apply hue rotation (simplified implementation)
        if (settings.hue !== 0) {
            // Convert RGB to HSL, adjust H, convert back
            const [h, s, l] = rgbToHsl(r, g, b);
            const newHue = (h + settings.hue / 360) % 1;
            const [newR, newG, newB] = hslToRgb(newHue, s, l);
            
            r = newR;
            g = newG;
            b = newB;
        }
        
        // Apply sharpness (simplified unsharp masking)
        // This would require access to neighboring pixels
        // Full implementation would need a separate pass
        
        pixels[i] = r;
        pixels[i + 1] = g;
        pixels[i + 2] = b;
    }
}

/**
 * Convert RGB to HSL color space
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
        
        h /= 6;
    }
    
    return [h, s, l];
}

/**
 * Convert HSL to RGB color space
 */
function hslToRgb(h, s, l) {
    let r, g, b;
    
    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    
    return [
        truncate(r * 255),
        truncate(g * 255),
        truncate(b * 255)
    ];
}

/**
 * Create an image from ASCII art
 * @param {string} ascii - ASCII text
 * @param {number} originalWidth - Original image width
 * @param {number} originalHeight - Original image height
 * @param {Object} options - Display options
 * @returns {string} - Data URL of the ASCII image
 */
async function createAsciiImage(ascii, originalWidth, originalHeight, options = {}, colorMap = []) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Get ASCII dimensions
    const lines = ascii.split('\n');
    const asciiWidth = lines[0] ? lines[0].length : 0;
    const asciiHeight = lines.length;
    
    // Calculate font size to maintain aspect ratio
    const fontSize = Math.min(12, Math.floor((asciiWidth * 12) / asciiHeight));
    
    // Calculate dimensions maintaining aspect ratio
    const charWidth = fontSize * 0.6; // Approximate width of monospace character
    const charHeight = fontSize; // Height of character without extra spacing
    
    // Set canvas dimensions based on character size and ASCII dimensions
    const canvasWidth = asciiWidth * charWidth;
    const canvasHeight = asciiHeight * charHeight;
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // Set font properties
    ctx.font = `${fontSize}px monospace`;
    ctx.textBaseline = 'top';
    
    // Set background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw ASCII text with colorization if enabled
    if (options.colorized && colorMap.length > 0) {
        lines.forEach((line, y) => {
            Array.from(line).forEach((char, x) => {
                if (colorMap[y] && colorMap[y][x]) {
                    const color = colorMap[y][x];
                    ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
                    ctx.fillText(char, x * charWidth, y * charHeight);
                }
            });
        });
    } else {
        // Draw in black if not colorized
        ctx.fillStyle = 'black';
        lines.forEach((line, i) => {
            ctx.fillText(line, 0, i * charHeight);
        });
    }
    
    // Convert to WebP with quality setting
    return canvas.toDataURL('image/webp', 0.8);
}

/**
 * Helper function to keep values in valid range
 * @param {number} value - Value to truncate
 * @returns {number} - Truncated value between 0 and 255
 */
function truncate(value) {
    return Math.min(255, Math.max(0, value));
}

/**
 * Initialize the ASCII converter UI
 */
function initAsciiConverterUI() {
    // Create UI container
    const container = document.createElement('div');
    container.id = 'ascii-converter-options';
    container.style.margin = '20px 0';
    
    // Add form fields
    const fields = [
        { name: 'width', label: 'Resolution', type: 'number', value: defaults.width, min: 10, max: 800 },
        { name: 'stretchWidth', label: 'Width (%)', type: 'range', value: defaults.stretchWidth, min: 50, max: 200 },
        { name: 'stretchHeight', label: 'Height (%)', type: 'range', value: defaults.stretchHeight, min: 50, max: 200 },
        { name: 'brightness', label: 'Brightness (%)', type: 'range', value: defaults.brightness, min: 0, max: 200 },
        { name: 'contrast', label: 'Contrast (%)', type: 'range', value: defaults.contrast, min: 0, max: 200 },
        { name: 'saturation', label: 'Saturation (%)', type: 'range', value: defaults.saturation, min: 0, max: 200 },
        { name: 'grayscale', label: 'Grayscale (%)', type: 'range', value: defaults.grayscale, min: 0, max: 100 },
        { name: 'invert', label: 'Invert Colors (%)', type: 'range', value: defaults.invert, min: 0, max: 100 },
        { name: 'hue', label: 'Hue Rotation (deg)', type: 'range', value: defaults.hue, min: 0, max: 360 },
        { name: 'sepia', label: 'Sepia (%)', type: 'range', value: defaults.sepia, min: 0, max: 100 },
        { name: 'charSetType', label: 'Character Set', type: 'select', value: 'standard', options: [
            { value: 'standard', label: 'Standard (█▓▒░)' },
            { value: 'extended', label: 'Extended (@%#*+=-:. )' },
            { value: 'blocks', label: 'Blocks (█▓▒░▄▀■□▪▫)' },
            { value: 'simple', label: 'Simple (#. )' },
            { value: 'custom', label: 'Custom (specify below)' }
        ]},
        { name: 'customChars', label: 'Custom Characters', type: 'text', value: defaults.customChars },
        { name: 'colorized', label: 'Colorized', type: 'checkbox', checked: defaults.colorized }
    ];
    
    fields.forEach(field => {
        const fieldContainer = document.createElement('div');
        fieldContainer.style.margin = '5px 0';
        
        const label = document.createElement('label');
        label.textContent = field.label + ': ';
        fieldContainer.appendChild(label);
        
        if (field.type === 'select') {
            const select = document.createElement('select');
            select.id = 'ascii-' + field.name;
            select.name = field.name;
            
            field.options.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option.value;
                optionElement.textContent = option.label;
                select.appendChild(optionElement);
            });
            
            select.value = field.value;
            fieldContainer.appendChild(select);
        } else {
            const input = document.createElement('input');
            input.type = field.type;
            input.id = 'ascii-' + field.name;
            input.name = field.name;
            
            if (field.type === 'checkbox') {
                input.checked = field.checked;
            } else {
                input.value = field.value;
                if (field.min !== undefined) input.min = field.min;
                if (field.max !== undefined) input.max = field.max;
                
                // Add value display for range inputs
                if (field.type === 'range') {
                    const valueDisplay = document.createElement('span');
                    valueDisplay.textContent = field.value;
                    valueDisplay.style.marginLeft = '5px';
                    
                    // Update display value when range changes
                    input.oninput = () => {
                        valueDisplay.textContent = input.value;
                        // We don't trigger the actual conversion here - the event listeners in the main HTML will handle that
                    };
                    
                    fieldContainer.appendChild(input);
                    fieldContainer.appendChild(valueDisplay);
                } else {
                    fieldContainer.appendChild(input);
                }
            }
            
            if (field.type !== 'range') {
                fieldContainer.appendChild(input);
            }
        }
        
        container.appendChild(fieldContainer);
    });
    
    return container;
}

/**
 * Get current settings from the UI
 * @returns {Object} - Current settings
 */
function getSettingsFromUI() {
    // Get the selected character set type
    const charSetType = document.getElementById('ascii-charSetType').value;
    let charSet = CHAR_SETS.standard; // Default
    
    // Set the character set based on selection
    if (charSetType !== 'custom') {
        charSet = CHAR_SETS[charSetType] || CHAR_SETS.standard;
    }
    
    return {
        width: parseInt(document.getElementById('ascii-width').value, 10) || defaults.width,
        height: parseInt(document.getElementById('ascii-height')?.value, 10) || defaults.height,
        brightness: parseInt(document.getElementById('ascii-brightness').value, 10),
        contrast: parseInt(document.getElementById('ascii-contrast').value, 10),
        saturation: parseInt(document.getElementById('ascii-saturation').value, 10),
        grayscale: parseInt(document.getElementById('ascii-grayscale').value, 10),
        invert: parseInt(document.getElementById('ascii-invert').value, 10),
        hue: parseInt(document.getElementById('ascii-hue').value, 10),
        sepia: parseInt(document.getElementById('ascii-sepia').value, 10),
        colorized: document.getElementById('ascii-colorized').checked,
        charSet: charSet,
        customChars: document.getElementById('ascii-customChars').value,
        stretchWidth: parseInt(document.getElementById('ascii-stretchWidth').value, 10) || defaults.stretchWidth,
        stretchHeight: parseInt(document.getElementById('ascii-stretchHeight').value, 10) || defaults.stretchHeight
    };
}

// Export functions
window.asciiConverter = {
    convertToAscii,
    initAsciiConverterUI,
    getSettingsFromUI,
    createAsciiImage,
    defaults
}; 