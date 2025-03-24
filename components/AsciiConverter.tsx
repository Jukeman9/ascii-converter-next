'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Script from 'next/script';

// Define the interface for the window augmentation
declare global {
  interface Window {
    asciiConverter: {
      convertToAscii: (imgSource: HTMLImageElement | string, options?: any) => Promise<{text: string; image: string}>;
      initAsciiConverterUI: () => HTMLElement;
      getSettingsFromUI: () => any;
      defaults: {
        width: number;
        height: number;
        brightness: number;
        contrast: number;
        saturation: number;
        grayscale: number;
        invert: number;
        hue: number;
        sepia: number;
        colorized: boolean;
        charSet: string;
        customChars: string;
        stretchWidth: number;
        stretchHeight: number;
        [key: string]: any;
      };
      CHAR_SETS: {
        standard: string;
        extended: string;
        blocks: string;
        simple: string;
        [key: string]: string;
      };
    };
  }
}

// Utility function to debounce calls
const createDebounce = () => {
  let timeoutId: NodeJS.Timeout;
  return (func: Function, wait: number) => {
    return function (...args: any[]) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), wait);
    };
  };
};

// Add rate limit types
interface RateLimitResponse {
  allowed: boolean;
  remaining: number;
}

type AsciiConverterProps = {
  imageUrl?: string;
};

export default function AsciiConverter({ imageUrl }: AsciiConverterProps) {
  const [loading, setLoading] = useState(false);
  const [asciiText, setAsciiText] = useState<string>('');
  const [asciiImage, setAsciiImage] = useState<string>('');
  const [conversionTime, setConversionTime] = useState<number | null>(null);
  const [currentImage, setCurrentImage] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [rateLimitRemaining, setRateLimitRemaining] = useState<number | null>(null);
  
  const optionsContainerRef = useRef<HTMLDivElement>(null);
  const asciiOutputRef = useRef<HTMLDivElement>(null);
  const debounce = useRef(createDebounce()).current;
  
  // Handle initial client-side mounting
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Initialize the ASCII converter UI once the script is loaded
  useEffect(() => {
    if (!scriptLoaded || !optionsContainerRef.current || !isMounted) return;
    
    try {
      const uiElement = window.asciiConverter.initAsciiConverterUI();
      optionsContainerRef.current.appendChild(uiElement);
    } catch (error) {
      console.error('Error initializing ASCII converter UI:', error);
      setError('Failed to initialize ASCII converter. Please refresh the page.');
    }
  }, [scriptLoaded, isMounted]);
  
  // Load image when URL changes
  useEffect(() => {
    if (imageUrl && scriptLoaded && isMounted) {
      loadImage(imageUrl);
    }
  }, [imageUrl, scriptLoaded, isMounted]);
  
  // Check rate limit
  const checkRateLimit = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/rate-limit');
      const data: RateLimitResponse = await response.json();
      setRateLimitRemaining(data.remaining);
      return data.allowed;
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return false;
    }
  };

  // Modify updateAsciiConversionCallback to check rate limit
  const updateAsciiConversionCallback = useCallback(async () => {
    if (!currentImage || !window.asciiConverter) return;
    
    // Check rate limit before proceeding
    const isAllowed = await checkRateLimit();
    if (!isAllowed) {
      setError('Daily conversion limit reached. Please try again tomorrow.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const settings = window.asciiConverter.getSettingsFromUI();
      const result = await window.asciiConverter.convertToAscii(currentImage, settings);
      
      setAsciiText(result.text);
      setAsciiImage(result.image);
    } catch (error) {
      console.error('Error in real-time conversion:', error);
      setError(error instanceof Error ? error.message : 'Failed to update ASCII conversion');
    } finally {
      setLoading(false);
    }
  }, [currentImage]);

  // Memoize the debounced handler
  const handleInputChange = useMemo(
    () => debounce(() => {
      if (currentImage) {
        updateAsciiConversionCallback();
      }
    }, 300),
    [currentImage, updateAsciiConversionCallback, debounce]
  );
  
  // Set up event listeners for real-time updates
  useEffect(() => {
    const currentContainer = optionsContainerRef.current;
    if (!currentContainer || !currentImage) return;

    const inputFields = currentContainer.querySelectorAll('input, select');
    inputFields.forEach(input => {
      input.addEventListener('input', handleInputChange);
      if (input instanceof HTMLSelectElement) {
        input.addEventListener('change', handleInputChange);
      }
    });

    // Cleanup function to remove event listeners
    return () => {
      if (currentContainer) {
        const inputFields = currentContainer.querySelectorAll('input, select');
        inputFields.forEach(input => {
          input.removeEventListener('input', handleInputChange);
          if (input instanceof HTMLSelectElement) {
            input.removeEventListener('change', handleInputChange);
          }
        });
      }
    };
  }, [currentImage, handleInputChange]);
  
  // Load image from URL
  const loadImage = async (url: string) => {
    setError(null);
    
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          setCurrentImage(img);
          resolve();
        };
        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };
      });
      
      // Convert to ASCII automatically when image loads
      convertToAscii(img);
    } catch (error) {
      console.error('Error loading image:', error);
      setError(error instanceof Error ? error.message : 'Failed to load image');
    }
  };
  
  // Convert image to ASCII
  const convertToAscii = async (img: HTMLImageElement) => {
    if (!window.asciiConverter) return;
    
    setLoading(true);
    setError(null);
    
    const startTime = performance.now();
    
    try {
      // Get settings from UI
      const settings = window.asciiConverter.getSettingsFromUI();
      
      // Convert image to ASCII
      const result = await window.asciiConverter.convertToAscii(img, settings);
      
      // Display the result
      setAsciiText(result.text);
      setAsciiImage(result.image);
      
      const endTime = performance.now();
      setConversionTime((endTime - startTime) / 1000);
    } catch (error) {
      console.error('Error converting to ASCII:', error);
      setError(error instanceof Error ? error.message : 'Failed to convert image to ASCII');
    } finally {
      setLoading(false);
    }
  };
  
  // Reset settings to defaults
  const resetSettings = () => {
    if (!window.asciiConverter || !optionsContainerRef.current) return;
    
    const defaults = window.asciiConverter.defaults;
    
    // Reset all inputs to default values
    const inputs = optionsContainerRef.current.querySelectorAll('input, select');
    inputs.forEach((input) => {
      const inputId = input.id;
      const settingName = inputId.replace('ascii-', '');
      
      if (defaults.hasOwnProperty(settingName)) {
        if (input instanceof HTMLInputElement) {
          if (input.type === 'checkbox') {
            input.checked = defaults[settingName];
          } else {
            input.value = defaults[settingName];
            
            // Trigger change event for range inputs to update displayed value
            if (input.type === 'range') {
              const event = new Event('input');
              input.dispatchEvent(event);
            }
          }
        } else if (input instanceof HTMLSelectElement) {
          input.value = defaults[settingName] || 'standard';
        }
      }
    });
    
    // Update the conversion if an image is loaded
    if (currentImage) {
      updateAsciiConversionCallback();
    }
  };
  
  // If not mounted yet (during SSR), return a simple placeholder
  if (!isMounted) {
    return <div className="ascii-results-container">Loading ASCII converter...</div>;
  }
  
  return (
    <div className="ascii-results-container">
      <Script 
        src="/conv2ascii.js" 
        onLoad={() => setScriptLoaded(true)}
        onError={() => setError('Failed to load ASCII converter script')}
        strategy="afterInteractive"
      />
      
      <div className="ascii-preview">
        <h3>ASCII Preview</h3>
        
        {loading && <div className="loading">Converting to ASCII art...</div>}
        
        {error && (
          <div className="error-message">
            Error: {error}
          </div>
        )}
        
        <div className="ascii-image-wrapper">
          {asciiImage && <img src={asciiImage} alt="ASCII Art" />}
        </div>
        
        <div 
          ref={asciiOutputRef}
          className="ascii-output"
          style={{ 
            display: asciiText ? 'block' : 'none',
            fontFamily: 'monospace',
            whiteSpace: 'pre',
            overflowX: 'auto',
            backgroundColor: 'white',
            color: 'black',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #ddd',
            marginTop: '20px',
            textAlign: 'left',
            maxHeight: '600px',
            fontSize: '8px',
            lineHeight: 1,
            overflowY: 'auto'
          }}
        >
          {asciiText}
        </div>
        
        {conversionTime !== null && (
          <div className="timing">
            ASCII conversion time: {conversionTime.toFixed(2)}s
          </div>
        )}
      </div>

      <div className="ascii-settings">
        <h3>ASCII Settings</h3>
        <div ref={optionsContainerRef} id="ascii-options-container"></div>
        <button 
          onClick={resetSettings}
          style={{ marginTop: '20px' }}
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
} 