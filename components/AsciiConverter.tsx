'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Script from 'next/script';
import Image from 'next/image';

// Define the interface for the window augmentation
declare global {
  interface Window {
    asciiConverter: {
      convertToAscii: (imgSource: HTMLImageElement | string, options?: AsciiOptions) => Promise<{text: string; image: string}>;
      initAsciiConverterUI: () => HTMLElement;
      getSettingsFromUI: () => AsciiOptions;
      defaults: AsciiOptions;
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

// Define the options interface for ASCII conversion
interface AsciiOptions {
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
  [key: string]: string | number | boolean;
}

// Utility function to debounce calls
const createDebounce = () => {
  let timeoutId: NodeJS.Timeout;
  return <T extends (...args: unknown[]) => void>(func: T, wait: number) => {
    return function (this: unknown, ...args: Parameters<T>) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), wait);
    };
  };
};

type AsciiConverterProps = {
  imageUrl?: string;
};

export default function AsciiConverter({ imageUrl }: AsciiConverterProps) {
  const [loading, setLoading] = useState(false);
  const [asciiText, setAsciiText] = useState<string>('');
  const [asciiImage, setAsciiImage] = useState<string | null>(null);
  const [conversionTime, setConversionTime] = useState<number | null>(null);
  const [currentImage, setCurrentImage] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  const optionsContainerRef = useRef<HTMLDivElement>(null);
  const asciiOutputRef = useRef<HTMLDivElement>(null);
  const debounce = useMemo(() => createDebounce(), []);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Load ASCII converter script
  useEffect(() => {
    if (isMounted && typeof window !== 'undefined') {
      setScriptLoaded(true);
    }
  }, [isMounted]);
  
  // Function to load an image from URL
  const loadImage = useCallback(async (url: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = url;
      });
      
      setCurrentImage(img);
      
      if (window.asciiConverter) {
        updateAsciiConversionCallback();
      }
    } catch (error) {
      console.error('Error loading image:', error);
      setError(error instanceof Error ? error.message : 'Failed to load image');
      setLoading(false);
    }
  }, [updateAsciiConversionCallback]);
  
  // Load image when URL changes
  useEffect(() => {
    if (imageUrl && scriptLoaded && isMounted) {
      loadImage(imageUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl, scriptLoaded, isMounted]);
  
  // Modify updateAsciiConversionCallback to remove rate limit check
  const updateAsciiConversionCallback = useCallback(async () => {
    if (!currentImage || !window.asciiConverter) return;
    
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
            // Type assertion for checkbox property since we know it's a boolean
            input.checked = !!defaults[settingName];
          } else {
            // Type assertion for input value since we need to convert to string
            input.value = String(defaults[settingName]);
            
            // Trigger change event for range inputs to update displayed value
            if (input.type === 'range') {
              const event = new Event('input');
              input.dispatchEvent(event);
            }
          }
        } else if (input instanceof HTMLSelectElement) {
          // Type assertion for select value
          input.value = typeof defaults[settingName] === 'string' 
            ? defaults[settingName] as string 
            : 'standard';
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
          {asciiImage && (
            <Image 
              src={asciiImage}
              alt="ASCII Art" 
              width={500}
              height={500}
              style={{ width: '100%', height: 'auto' }}
            />
          )}
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