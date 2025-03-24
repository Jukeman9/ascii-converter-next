'use client';

import { useEffect, useState, useRef } from 'react';
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
  
  const optionsContainerRef = useRef<HTMLDivElement>(null);
  const asciiOutputRef = useRef<HTMLDivElement>(null);
  
  // Initialize the ASCII converter UI once the script is loaded
  useEffect(() => {
    if (!scriptLoaded || !optionsContainerRef.current) return;
    
    // Clear previous content
    while (optionsContainerRef.current.firstChild) {
      optionsContainerRef.current.removeChild(optionsContainerRef.current.firstChild);
    }
    
    const uiElement = window.asciiConverter.initAsciiConverterUI();
    optionsContainerRef.current.appendChild(uiElement);
    
    // Set up event listeners for real-time updates
    setupRealTimeConversion();
  }, [scriptLoaded]);
  
  // Load image when URL changes
  useEffect(() => {
    if (imageUrl && scriptLoaded) {
      loadImage(imageUrl);
    }
  }, [imageUrl, scriptLoaded]);
  
  // Set up real-time conversion based on settings changes
  const setupRealTimeConversion = () => {
    if (!optionsContainerRef.current) return;
    
    const inputFields = optionsContainerRef.current.querySelectorAll('input, select');
    inputFields.forEach(input => {
      input.addEventListener('input', debounce(() => {
        if (currentImage) {
          updateAsciiConversion();
        }
      }, 300));
      
      // Also add change event for select elements
      if (input instanceof HTMLSelectElement) {
        input.addEventListener('change', debounce(() => {
          if (currentImage) {
            updateAsciiConversion();
          }
        }, 300));
      }
    });
  };
  
  // Debounce function to avoid too many conversions
  const debounce = (func: Function, wait: number) => {
    let timeout: NodeJS.Timeout;
    return function() {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        func();
      }, wait);
    };
  };
  
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
  
  // Update ASCII conversion with current settings
  const updateAsciiConversion = async () => {
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
      updateAsciiConversion();
    }
  };
  
  return (
    <div className="ascii-results-container">
      <Script 
        src="/conv2ascii.js" 
        onLoad={() => setScriptLoaded(true)}
        onError={() => setError('Failed to load ASCII converter script')}
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